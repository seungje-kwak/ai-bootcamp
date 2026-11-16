"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BottomBar } from "@/components/BottomBar";
import { Brand } from "@/components/Brand";
import { CATEGORY_ICON, Icon, type IconName } from "@/components/Icon";
import { LanguageSelect } from "@/components/LanguageSelect";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { ceilTo, nowInJejuMinutes, planForWindow, SHORTEST_PLAN_MIN, toHHMM, toMinutes } from "@/lib/time";
import { loadOnboardingDraft, saveOnboardingDraft, saveTravelWindow } from "@/lib/trip-store";
import type { Category, UserProfileInput } from "@/lib/types";

// 6.2 Onboarding: five steps, one per screen. The values sent to POST /courses are unchanged;
// only the last step is richer: the traveler gives a start and an end time, and the screen
// says which of the two plan lengths the server offers (about 4 h or about 8 h) fits inside it.

const INTERESTS: Category[] = ["nature", "market", "cafe", "food", "culture", "photo"];
const FITNESS = [1, 2, 3] as const;
const WALKS = [10, 20, 30] as const;
const MOODS = ["great", "normal", "tired"] as const;
const MOOD_ICONS: IconName[] = ["moodGreat", "moodOkay", "moodTired"];
const DIETS = ["none", "vegan", "vegetarian", "halal"] as const;
const DIET_ICONS: IconName[] = ["food", "leaf", "sprout", "crescent"];
const STEP_COUNT = 5;
const DAY_END = 23 * 60 + 50;
const MINUTE_STEPS = [0, 10, 20, 30, 40, 50];

type Draft = {
  interests: Category[];
  fitness_level?: UserProfileInput["fitness_level"];
  max_walk_min?: UserProfileInput["max_walk_min"];
  avoid_slopes: boolean;
  condition_today?: UserProfileInput["condition_today"];
  diet?: UserProfileInput["diet"];
  start: string;
  end: string;
};
const EMPTY: Draft = { interests: [], avoid_slopes: false, start: "11:00", end: "16:00" };
type Saved = { step: number; draft: Draft };
type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "nocandidates" };

function Choice({
  selected,
  onClick,
  label,
  hint,
  icon,
  variant = "row",
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  variant?: "row" | "tile" | "pill";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`choice ${variant === "tile" ? "choice-tile" : variant === "pill" ? "choice-pill" : ""}`}
    >
      {icon && <span className="choice__icon">{icon}</span>}
      <span className="choice__text">
        <span className="choice__label">{label}</span>
        {hint && <span className="choice__hint">{hint}</span>}
      </span>
      <span className="choice__mark" aria-hidden="true">
        <Icon name="check" size={14} strokeWidth={2.4} />
      </span>
    </button>
  );
}

// Three bars, filled up to the level: reads as "how much energy" without a word.
function EnergyIcon({ level }: { level: 1 | 2 | 3 }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={4 + i * 6}
          y={15 - i * 5}
          width="4"
          height={5 + i * 5}
          rx="1.5"
          fill={i < level ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

function TimeField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  invalid: boolean;
}) {
  const { t } = useLocale();
  const T = t.onboarding.time;
  const total = toMinutes(value);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const minutes = MINUTE_STEPS.includes(minute) ? MINUTE_STEPS : [...MINUTE_STEPS, minute].sort((a, b) => a - b);
  const set = (m: number) => onChange(toHHMM(Math.min(DAY_END, Math.max(0, m))));
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="timefield" role="group" aria-label={label} data-invalid={invalid}>
      <span className="label">{label}</span>
      <div className="timefield__value">
        <select aria-label={`${label}: ${T.hour}`} value={hour} onChange={(e) => set(Number(e.target.value) * 60 + minute)}>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {pad(h)}
            </option>
          ))}
        </select>
        <span aria-hidden="true">:</span>
        <select aria-label={`${label}: ${T.minute}`} value={minute} onChange={(e) => set(hour * 60 + Number(e.target.value))}>
          {minutes.map((m) => (
            <option key={m} value={m}>
              {pad(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="timefield__steps">
        <button type="button" className="icon-btn" onClick={() => set(total - 30)} disabled={total <= 0} aria-label={`${label}: ${T.earlier}`}>
          <Icon name="minus" size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => set(total + 30)} disabled={total >= DAY_END} aria-label={`${label}: ${T.later}`}>
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { t } = useLocale();
  const O = t.onboarding;
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [showMissing, setShowMissing] = useState(false);
  const [nowMin, setNowMin] = useState<number | null>(null);
  const restored = useRef(false);
  const inFlight = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Answers survive a reload and the browser's back button (this tab only).
  useEffect(() => {
    const saved = loadOnboardingDraft<Saved>();
    if (saved?.draft && Array.isArray(saved.draft.interests)) {
      setD({ ...EMPTY, ...saved.draft });
      setStep(Math.min(STEP_COUNT - 1, Math.max(0, Number(saved.step) || 0)));
    }
    restored.current = true;
  }, []);
  useEffect(() => {
    if (restored.current) saveOnboardingDraft({ step, draft: d } satisfies Saved);
  }, [step, d]);

  // Jeju's clock, for the "start now" shortcut. Read on the client only, so it never mismatches the server render.
  useEffect(() => {
    const tick = () => setNowMin(nowInJejuMinutes());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const startMin = toMinutes(d.start);
  const endMin = toMinutes(d.end);
  const windowMin = endMin - startMin;
  const plan = planForWindow(windowMin);
  const timeError = windowMin <= 0 ? O.time.errOrder : !plan ? O.time.errShort : null;

  const valid = [
    d.interests.length > 0,
    d.fitness_level != null && d.max_walk_min != null,
    d.condition_today != null,
    d.diet != null,
    timeError === null,
  ];
  const firstInvalid = valid.indexOf(false);
  const canOpen = (i: number) => firstInvalid === -1 || i <= firstInvalid;

  function goTo(next: number) {
    setShowMissing(false);
    setStep(next);
    window.scrollTo({ top: 0 });
    // move keyboard / screen-reader focus to the new question
    requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }

  function setWindowLength(minutes: number) {
    const start = Math.min(startMin, DAY_END - minutes);
    setD({ ...d, start: toHHMM(start), end: toHHMM(start + minutes) });
  }
  const nowStart = nowMin == null ? null : ceilTo(nowMin, 10);
  const canStartNow = nowStart != null && nowStart + SHORTEST_PLAN_MIN <= DAY_END;
  function startNow() {
    if (nowStart == null) return;
    const length = Math.max(SHORTEST_PLAN_MIN, windowMin);
    setD({ ...d, start: toHHMM(nowStart), end: toHHMM(Math.min(DAY_END, nowStart + length)) });
  }

  async function submit() {
    if (inFlight.current || !valid.every(Boolean) || !plan) return;
    inFlight.current = true;
    setStatus({ kind: "loading" });
    const profile: UserProfileInput = {
      interests: d.interests,
      fitness_level: d.fitness_level!,
      max_walk_min: d.max_walk_min!,
      avoid_slopes: d.avoid_slopes,
      condition_today: d.condition_today!,
      diet: d.diet!,
      duration: plan.duration,
    };
    try {
      // The API takes start_time (HH:MM, Jeju time) and one of two durations.
      const course = await api.createCourse(profile, d.start);
      saveTravelWindow(course.id, { start: d.start, end: d.end });
      router.push(`/course/${course.id}`);
    } catch (e) {
      inFlight.current = false;
      setStatus({ kind: e instanceof ApiError && e.code === "NO_CANDIDATES" ? "nocandidates" : "error" });
    }
  }

  function onNext() {
    if (!valid[step]) {
      setShowMissing(true);
      return;
    }
    if (step < STEP_COUNT - 1) goTo(step + 1);
    else submit();
  }

  if (status.kind === "loading") {
    return (
      <main className="onb__loading" role="status" aria-live="polite">
        <div className="spinner" />
        <p className="display" style={{ fontSize: 24 }}>
          {O.loadingTitle}
        </p>
        <p className="fine">{O.loadingSub}</p>
      </main>
    );
  }

  const join = t.stop.listJoin;
  const answers: (string | null)[] = [
    d.interests.length ? d.interests.map((c) => O.interests[c].label).join(join) : null,
    d.fitness_level != null || d.max_walk_min != null
      ? [
          d.fitness_level != null ? O.energies[d.fitness_level - 1].label : null,
          d.max_walk_min != null ? O.walkOptions[WALKS.indexOf(d.max_walk_min)] : null,
          d.avoid_slopes ? O.slopesOn : null,
        ]
          .filter(Boolean)
          .join(join)
      : null,
    d.condition_today != null ? O.moods[MOODS.indexOf(d.condition_today)].label : null,
    d.diet != null ? O.diets[DIETS.indexOf(d.diet)].label : null,
    timeError === null ? `${t.stop.timeRange(d.start, d.end)} (${t.common.duration(windowMin)})` : null,
  ];

  const S = O.steps[step];

  return (
    <main className="onb with-bottom-bar">
      <header className="topbar page" style={{ maxWidth: 1080 }}>
        <Brand label={t.common.home} />
        <LanguageSelect />
      </header>

      <div className="onb__grid page">
        <section className="card onb__main" aria-labelledby="onb-title">
          <ol className="onb__steps">
            {O.steps.map((s, i) => {
              const state = i === step ? "current" : i < step || (valid[i] && canOpen(i)) ? "done" : "todo";
              return (
                <li key={s.name}>
                  <button
                    type="button"
                    className="onb__step w-full"
                    data-state={state}
                    disabled={i !== step && !canOpen(i)}
                    aria-current={i === step ? "step" : undefined}
                    onClick={() => i !== step && goTo(i)}
                  >
                    <span>{s.name}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="label onb__count">{O.progress(step + 1, STEP_COUNT)}</p>
          <h1 id="onb-title" ref={titleRef} tabIndex={-1} className="display onb__title" style={{ outline: "none" }}>
            {S.title}
          </h1>
          <p className="onb__sub">{S.sub}</p>

          <div className="onb__fields" key={step}>
            {step === 0 && (
              <div className="choice-grid" role="group" aria-label={S.title}>
                {INTERESTS.map((c) => {
                  const on = d.interests.includes(c);
                  return (
                    <Choice
                      key={c}
                      variant="tile"
                      selected={on}
                      icon={<Icon name={CATEGORY_ICON[c]} size={22} />}
                      label={O.interests[c].label}
                      hint={O.interests[c].hint}
                      onClick={() => setD({ ...d, interests: on ? d.interests.filter((x) => x !== c) : [...d.interests, c] })}
                    />
                  );
                })}
              </div>
            )}

            {step === 1 && (
              <>
                <div className="onb__group" role="group" aria-label={O.energyLabel}>
                  <span className="label">{O.energyLabel}</span>
                  <div className="choice-list">
                    {FITNESS.map((v) => (
                      <Choice
                        key={v}
                        selected={d.fitness_level === v}
                        icon={<EnergyIcon level={v} />}
                        label={O.energies[v - 1].label}
                        hint={O.energies[v - 1].hint}
                        onClick={() => setD({ ...d, fitness_level: v })}
                      />
                    ))}
                  </div>
                </div>
                <div className="onb__group" role="group" aria-label={O.walkLabel}>
                  <span className="label">{O.walkLabel}</span>
                  <div className="choice-row3">
                    {WALKS.map((v, i) => (
                      <Choice key={v} variant="pill" selected={d.max_walk_min === v} label={O.walkOptions[i]} onClick={() => setD({ ...d, max_walk_min: v })} />
                    ))}
                  </div>
                </div>
                <div className="onb__group">
                  <label className="switch-row">
                    <span>
                      <span className="choice__label">{O.avoidSlopes}</span>
                      <span className="choice__hint">{O.avoidSlopesHint}</span>
                    </span>
                    <span className="switch">
                      <input type="checkbox" role="switch" checked={d.avoid_slopes} onChange={(e) => setD({ ...d, avoid_slopes: e.target.checked })} />
                      <span className="switch__track" aria-hidden="true" />
                    </span>
                  </label>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="choice-list" role="group" aria-label={S.title}>
                {MOODS.map((v, i) => (
                  <Choice
                    key={v}
                    selected={d.condition_today === v}
                    icon={<Icon name={MOOD_ICONS[i]} size={22} />}
                    label={O.moods[i].label}
                    hint={O.moods[i].hint}
                    onClick={() => setD({ ...d, condition_today: v })}
                  />
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="choice-list" role="group" aria-label={S.title}>
                {DIETS.map((v, i) => (
                  <Choice
                    key={v}
                    selected={d.diet === v}
                    icon={<Icon name={DIET_ICONS[i]} size={22} />}
                    label={O.diets[i].label}
                    hint={O.diets[i].hint}
                    onClick={() => setD({ ...d, diet: v })}
                  />
                ))}
              </div>
            )}

            {step === 4 && (
              <>
                <div className="onb__group" role="group" aria-label={O.time.quick}>
                  <span className="label">{O.time.quick}</span>
                  <div className="time-quick">
                    <Choice variant="pill" selected={windowMin === 240} label={O.time.hours4} onClick={() => setWindowLength(240)} />
                    <Choice variant="pill" selected={windowMin === 480} label={O.time.hours8} onClick={() => setWindowLength(480)} />
                    {canStartNow && nowStart != null && (
                      <Choice variant="pill" selected={startMin === nowStart} label={O.time.startNow(toHHMM(nowStart))} onClick={startNow} />
                    )}
                  </div>
                </div>

                <div className="onb__group">
                  <span className="label">{O.time.own}</span>
                  <div className="time-fields">
                    <TimeField label={O.time.start} value={d.start} invalid={timeError !== null} onChange={(v) => setD({ ...d, start: v })} />
                    <TimeField label={O.time.end} value={d.end} invalid={timeError !== null} onChange={(v) => setD({ ...d, end: v })} />
                  </div>

                  <div className="time-summary" data-invalid={timeError !== null} aria-live="polite">
                    {timeError || !plan ? (
                      <p role="alert">{timeError}</p>
                    ) : (
                      <>
                        <div className="time-summary__total">
                          <span>{O.time.total}</span>
                          <strong>{t.common.duration(windowMin)}</strong>
                        </div>
                        <p>{O.time.plan(t.common.duration(plan.planMin), d.start, toHHMM(startMin + plan.planMin))}</p>
                        <p>{plan.spareMin > 0 ? O.time.spare(t.common.duration(plan.spareMin)) : O.time.exact}</p>
                      </>
                    )}
                  </div>
                  <p className="fine mt-3">
                    {O.time.why} {O.time.kst}
                  </p>
                </div>
              </>
            )}
          </div>

          {status.kind === "error" && (
            <div role="alert" className="notice notice-error mt-6">
              <Icon name="alert" size={20} />
              <div>
                <p>{O.errorGeneric}</p>
                <button type="button" className="text-link mt-1" style={{ color: "inherit" }} onClick={submit}>
                  {t.common.retry}
                </button>
              </div>
            </div>
          )}
          {status.kind === "nocandidates" && (
            <div role="alert" className="notice notice-error mt-6">
              <Icon name="alert" size={20} />
              <div>
                <p>{O.errorNoCandidates}</p>
                <button
                  type="button"
                  className="text-link mt-1"
                  style={{ color: "inherit" }}
                  onClick={() => {
                    setStatus({ kind: "idle" });
                    goTo(0);
                  }}
                >
                  {O.changeAnswers}
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="card onb__aside" aria-label={O.summaryTitle}>
          <h2 className="section-title">{O.summaryTitle}</h2>
          <dl className="onb__answers">
            {O.steps.map((s, i) => (
              <div key={s.name} className="onb__answer">
                <dt>{s.name}</dt>
                <dd data-empty={answers[i] === null}>{answers[i] ?? O.notChosen}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      <BottomBar>
        {showMissing && !valid[step] && (
          <p className="onb__hint" role="alert">
            {S.missing}
          </p>
        )}
        <div className="onb__footer">
          <button type="button" className="btn btn-secondary" onClick={() => (step === 0 ? router.push("/") : goTo(step - 1))}>
            {t.common.back}
          </button>
          <button type="button" className="btn btn-primary" aria-disabled={!valid[step]} onClick={onNext}>
            {step < STEP_COUNT - 1 ? O.next : O.create}
          </button>
        </div>
      </BottomBar>
    </main>
  );
}

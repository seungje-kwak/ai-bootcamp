"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { V9Header } from "@/components/V9Header";
import { api, ApiError } from "@/lib/api";
import type { Area, Category, UserProfileInput } from "@/lib/types";
import { MESSAGES, useLocale } from "@/lib/i18n";
import { ceilTo, nowInJejuMinutes, windowError } from "@/lib/time";
import { loadOnboardingDraft, saveOnboardingDraft } from "@/lib/trip-store";
import { TRIP_TIME, defaultEnd, endForStart, endOptions, startOptions, toHHMM, toMin } from "@/lib/tripTime";
import { useV6Copy } from "@/lib/v6-copy";

// 6.2 Onboarding: six steps, one per screen. Step 5 picks the area of Jeju (prd-start-area) and
// step 6 the start and end of the day (prd-trip-time); the server fits the stops inside that window.

const INTERESTS: { value: Category; icon: string }[] = [
  { value: "nature", icon: "🌿" },
  { value: "market", icon: "🧺" },
  { value: "cafe", icon: "☕" },
  { value: "food", icon: "🥢" },
  { value: "culture", icon: "🏛️" },
  { value: "photo", icon: "📷" },
];
const WALKS = [10, 20, 30] as const;
const MOODS = ["great", "normal", "tired"] as const;
const DIETS = ["none", "vegan", "vegetarian", "halal"] as const;
type Draft = {
  interests: Category[];
  fitness_level?: 1 | 2 | 3;
  max_walk_min?: 10 | 20 | 30;
  avoid_slopes: boolean;
  condition_today?: "great" | "normal" | "tired";
  diet?: "none" | "vegan" | "vegetarian" | "halal";
  area_id?: string;
  startTime: string;
  endTime: string;
};
type Saved = { step: number; draft: Draft };
type AreaList = { kind: "loading" } | { kind: "error" } | { kind: "ok"; areas: Area[] };
const AREA_GROUPS: Area["group"][] = ["jeju", "seogwipo"];
const AREA_STEP = 4,
  TIME_STEP = 5,
  STEP_COUNT = 6;
type Status = "idle" | "loading" | "error" | "nocandidates" | "badarea" | "badtime";

/** TT O19: Jeju's clock rounded up to the half hour. Before 08:00 -> 08:00, after 16:00 -> 10:00. */
function defaultStartMin(): number {
  const rounded = ceilTo(nowInJejuMinutes(), TRIP_TIME.step);
  if (rounded < TRIP_TIME.minStart) return TRIP_TIME.minStart;
  if (rounded > TRIP_TIME.maxStart) return TRIP_TIME.fallbackStart;
  return rounded;
}
/** Drafts from before the half-hour rule can hold times like 11:10. */
const snap = (hhmm: string) => toHHMM(ceilTo(toMin(hhmm), TRIP_TIME.step));

function Choice({ selected, onClick, children, disabled = false }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} className={`v9-choice ${selected ? "is-selected" : ""}`} onClick={onClick}>
      {children}
      <span className="v9-choice-tick" aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
    </button>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { locale } = useLocale();
  const c = useV6Copy(locale);
  const M = MESSAGES[locale];
  const O = M.onboarding;
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({ interests: [], avoid_slopes: false, startTime: "10:00", endTime: "14:00" });
  const [status, setStatus] = useState<Status>("idle");
  const [nowStart, setNowStart] = useState<number | null>(null);
  const inflight = useRef(false);
  // Saving starts only once the restored answers are in state; otherwise the empty first render would
  // overwrite the saved draft before it is read (React runs effects twice in development).
  const [restored, setRestored] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [areaList, setAreaList] = useState<AreaList>({ kind: "loading" });

  // Answers survive a reload and the browser's back button (this tab only). With no draft, the day
  // starts at Jeju's current time rounded up (read on the client only, so it never mismatches the server render).
  useEffect(() => {
    const saved = loadOnboardingDraft<Saved>();
    if (saved?.draft && Array.isArray(saved.draft.interests)) {
      const start = snap(saved.draft.startTime ?? "10:00");
      const end = snap(saved.draft.endTime ?? "14:00");
      setD({ ...saved.draft, startTime: start, endTime: end });
      setStep(Math.min(STEP_COUNT - 1, Math.max(0, Number(saved.step) || 0)));
    } else {
      const start = defaultStartMin();
      setD((prev) => ({ ...prev, startTime: toHHMM(start), endTime: toHHMM(defaultEnd(start)) }));
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored) saveOnboardingDraft({ step, draft: d } satisfies Saved);
  }, [restored, step, d]);

  // Jeju's clock, for the "start now" shortcut.
  useEffect(() => {
    const tick = () => setNowStart(ceilTo(nowInJejuMinutes(), TRIP_TIME.step));
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const loadAreas = useCallback(async () => {
    setAreaList({ kind: "loading" });
    try {
      setAreaList({ kind: "ok", areas: (await api.areas()).areas });
    } catch {
      setAreaList({ kind: "error" });
    }
  }, []);
  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  const areas = areaList.kind === "ok" ? areaList.areas : [];
  const area = areas.find((a) => a.id === d.area_id);
  const areaName = (a: Area) => (locale === "ko" ? a.name_ko : a.name_en);
  const startMin = toMin(d.startTime),
    endMin = toMin(d.endTime);
  const minutes = endMin - startMin;
  // Same limits as the backend (lib/time.ts windowError): start 08:00-16:00, end by 22:00, 2-10 hours.
  const timeErrorKey = windowError(startMin, endMin);
  const timeError = timeErrorKey ? O.time[timeErrorKey] : null;
  const valid = [
    d.interests.length > 0,
    d.fitness_level != null && d.max_walk_min != null,
    d.condition_today != null,
    d.diet != null,
    area?.selectable === true,
    timeError === null,
  ];
  const canStartNow = nowStart != null && nowStart >= TRIP_TIME.minStart && nowStart <= TRIP_TIME.maxStart;

  function goTo(next: number) {
    setStep(next);
    window.scrollTo({ top: 0 });
    // move keyboard / screen-reader focus to the new question
    requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }
  function setTimes(start: number, end: number) {
    setD({ ...d, startTime: toHHMM(start), endTime: toHHMM(end) });
    if (status === "badtime") setStatus("idle");
  }
  // TT O21: a new start keeps the end when it is still allowed, otherwise start + 4 h (capped).
  const setStart = (start: number) => setTimes(start, endForStart(start, endMin));
  const setLength = (length: number) => {
    const start = Math.max(TRIP_TIME.minStart, Math.min(startMin, TRIP_TIME.maxStart, TRIP_TIME.maxEnd - length));
    setTimes(start, start + length);
  };
  const startNow = () => {
    if (!canStartNow || nowStart == null) return;
    const length = Math.min(TRIP_TIME.maxLength, Math.max(TRIP_TIME.minLength, minutes));
    setTimes(nowStart, Math.min(TRIP_TIME.maxEnd, nowStart + length));
  };

  async function submit() {
    if (inflight.current || !valid.every(Boolean) || !d.area_id) return;
    inflight.current = true;
    setStatus("loading");
    const profile: UserProfileInput = {
      interests: d.interests,
      fitness_level: d.fitness_level!,
      max_walk_min: d.max_walk_min!,
      avoid_slopes: d.avoid_slopes,
      condition_today: d.condition_today!,
      diet: d.diet!,
    };
    try {
      // start_time and end_time are HH:MM, Jeju time.
      const course = await api.createCourse(profile, d.area_id, d.startTime, d.endTime);
      router.push(`/course/${course.id}`);
    } catch (e) {
      inflight.current = false;
      const code = e instanceof ApiError ? e.code : null;
      if (code === "INVALID_AREA") {
        // The area stopped being available: back to the area step with a fresh list.
        setD((prev) => ({ ...prev, area_id: undefined }));
        setStatus("badarea");
        goTo(AREA_STEP);
        loadAreas();
        return;
      }
      setStatus(code === "NO_CANDIDATES" ? "nocandidates" : code === "INVALID_TIME_WINDOW" ? "badtime" : "error");
    }
  }

  const join = M.stop.listJoin;
  const answers: (string | null)[] = [
    d.interests.length ? d.interests.map((x) => O.interests[x].label).join(join) : null,
    d.fitness_level != null || d.max_walk_min != null
      ? [d.fitness_level != null ? O.energies[d.fitness_level - 1].label : null, d.max_walk_min != null ? O.walkOptions[WALKS.indexOf(d.max_walk_min)] : null, d.avoid_slopes ? O.slopesOn : null]
          .filter(Boolean)
          .join(join)
      : null,
    d.condition_today != null ? O.moods[MOODS.indexOf(d.condition_today)].label : null,
    d.diet != null ? O.diets[DIETS.indexOf(d.diet)].label : null,
    area ? areaName(area) : null,
    timeError === null ? `${M.stop.timeRange(d.startTime, d.endTime)} (${M.common.duration(minutes)})` : null,
  ];

  const stepTitle = step === AREA_STEP ? O.steps[AREA_STEP].title : c.stepTitles[step === TIME_STEP ? 4 : step];
  const stepDesc = step === AREA_STEP ? O.steps[AREA_STEP].sub : c.stepDescs[step === TIME_STEP ? 4 : step];

  if (status === "loading") {
    return (
      <main className="v9-site v9-onboarding">
        <V9Header />
        <div className="v9-onboarding-loading" role="status" aria-live="polite">
          <div className="spinner" />
          <h1>{O.loadingTitle}</h1>
          <p className="v9-fineprint">{O.loadingSub}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="v9-site v9-onboarding">
      <V9Header />
      <div className="v9-onboarding-inner">
        <div className="v9-step-head">
          <span>{c.personalize}</span>
          <span>
            {String(step + 1).padStart(2, "0")} / {String(STEP_COUNT).padStart(2, "0")}
          </span>
        </div>
        <div className="v9-progress">
          <span style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }} />
        </div>
        <h1 className="v9-form-title" ref={titleRef} tabIndex={-1} style={{ outline: "none" }}>
          {stepTitle}
        </h1>
        <p className="v9-form-desc">{stepDesc}</p>
        <section className="v9-form-content" aria-label={stepTitle} key={step}>
          {step === 0 && (
            <div className="v9-choices v9-interests">
              {INTERESTS.map((o, i) => (
                <Choice
                  key={o.value}
                  selected={d.interests.includes(o.value)}
                  onClick={() => setD({ ...d, interests: d.interests.includes(o.value) ? d.interests.filter((x) => x !== o.value) : [...d.interests, o.value] })}
                >
                  <span className="v9-choice-symbol">{o.icon}</span>
                  <span>{c.interest[i]}</span>
                </Choice>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="v9-fields-stack">
              <h2 className="v9-field-label">{c.fitness}</h2>
              <div className="v9-choices v9-single">
                {([1, 2, 3] as const).map((v, i) => (
                  <Choice key={v} selected={d.fitness_level === v} onClick={() => setD({ ...d, fitness_level: v })}>
                    <span className="v9-choice-symbol">{["🌤️", "🚶", "🥾"][i]}</span>
                    {c.fitnessChoices[i]}
                  </Choice>
                ))}
              </div>
              <h2 className="v9-field-label">{c.walk}</h2>
              <div className="v9-pills">
                {WALKS.map((v, i) => (
                  <button key={v} type="button" aria-pressed={d.max_walk_min === v} className={d.max_walk_min === v ? "is-selected" : ""} onClick={() => setD({ ...d, max_walk_min: v })}>
                    {c.walkChoices[i]}
                  </button>
                ))}
              </div>
              <label className="v9-checkline">
                <span>
                  {c.avoid}
                  <small className="block text-xs font-normal text-muted">{O.avoidSlopesHint}</small>
                </span>
                <input type="checkbox" role="switch" checked={d.avoid_slopes} onChange={(e) => setD({ ...d, avoid_slopes: e.target.checked })} />
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="v9-choices v9-single">
              {MOODS.map((v, i) => (
                <Choice key={v} selected={d.condition_today === v} onClick={() => setD({ ...d, condition_today: v })}>
                  <span className="v9-choice-symbol">{["😊", "🙂", "🥱"][i]}</span>
                  {c.condition[i]}
                </Choice>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="v9-choices v9-single">
              {DIETS.map((v, i) => (
                <Choice key={v} selected={d.diet === v} onClick={() => setD({ ...d, diet: v })}>
                  <span className="v9-choice-symbol">{["🍽️", "🥬", "🌱", "☪️"][i]}</span>
                  {c.diet[i]}
                </Choice>
              ))}
            </div>
          )}
          {step === AREA_STEP && areaList.kind === "loading" && (
            <div className="flex items-center gap-3" role="status">
              <div className="spinner" />
              <p className="v9-form-desc" style={{ margin: 0 }}>
                {O.area.loading}
              </p>
            </div>
          )}
          {step === AREA_STEP && areaList.kind === "error" && (
            <div role="alert" className="v9-form-error">
              <p>{O.area.loadError}</p>
              <button type="button" onClick={loadAreas}>
                {M.common.retry}
              </button>
            </div>
          )}
          {step === AREA_STEP && areaList.kind === "ok" && (
            <div className="v9-fields-stack">
              {status === "badarea" && (
                <p role="alert" className="v9-form-error">
                  {O.area.badArea}
                </p>
              )}
              {AREA_GROUPS.map((group) => (
                <div key={group} role="group" aria-label={O.area.groups[group]} className="v9-fields-stack">
                  <h2 className="v9-field-label">{O.area.groups[group]}</h2>
                  <div className="v9-choices v9-single">
                    {areas
                      .filter((a) => a.group === group)
                      .map((a) => (
                        <Choice
                          key={a.id}
                          disabled={!a.selectable}
                          selected={d.area_id === a.id}
                          onClick={() => {
                            setD({ ...d, area_id: a.id });
                            if (status === "badarea") setStatus("idle");
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block">{a.selectable ? areaName(a) : `${areaName(a)} · ${O.area.comingSoon}`}</span>
                            {locale === "en" && a.description_en && <small className="block text-xs font-normal text-muted">{a.description_en}</small>}
                          </span>
                        </Choice>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {step === TIME_STEP && (
            <div className="v9-time-panel">
              <div className="v9-time-presets" role="group" aria-label={O.time.quick}>
                {canStartNow && nowStart != null && (
                  <button type="button" aria-pressed={startMin === nowStart} onClick={startNow}>
                    {O.time.startNow(toHHMM(nowStart))}
                  </button>
                )}
                <button type="button" aria-pressed={minutes === 240} onClick={() => setLength(240)}>
                  {c.four}
                </button>
                <button type="button" aria-pressed={minutes === 480} onClick={() => setLength(480)}>
                  {c.eight}
                </button>
              </div>
              <div className="v9-time-cards">
                <label>
                  <span>{c.start}</span>
                  <select value={startMin} onChange={(e) => setStart(Number(e.target.value))}>
                    {startOptions().map((v) => (
                      <option key={v} value={v}>
                        {toHHMM(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{c.end}</span>
                  <select value={endMin} onChange={(e) => setTimes(startMin, Number(e.target.value))}>
                    {endOptions(startMin).map((v) => (
                      <option key={v} value={v}>
                        {toHHMM(v)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={`v9-time-summary ${timeError ? "is-warning" : ""}`} role="status" aria-live="polite">
                {timeError ?? (
                  <>
                    <strong>
                      {c.timeSummary}: {d.startTime} — {d.endTime}
                    </strong>
                    <span>
                      {M.common.duration(minutes)} · {O.time.fit}
                    </span>
                  </>
                )}
              </div>
              {status === "badtime" && (
                <p role="alert" className="v9-form-error">
                  {O.errorBadTime}
                </p>
              )}
              <p className="v9-policy">
                {O.time.why} {O.time.kst}
              </p>
            </div>
          )}
        </section>
        {status === "error" && (
          <div role="alert" className="v9-form-error">
            <p>{O.errorGeneric}</p>
            <button type="button" onClick={submit}>
              {M.common.retry}
            </button>
          </div>
        )}
        {status === "nocandidates" && (
          <div role="alert" className="v9-form-error">
            <p>{O.errorNoCandidates}</p>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                goTo(0);
              }}
            >
              {O.changeAnswers}
            </button>
          </div>
        )}
        <div className="v9-step-actions">
          <button type="button" className="v9-outline" onClick={() => (step === 0 ? router.push("/") : goTo(step - 1))}>
            {c.back}
          </button>
          <button type="button" className="v9-primary" disabled={!valid[step]} onClick={() => (step === TIME_STEP ? submit() : goTo(step + 1))}>
            {step === TIME_STEP ? c.create : c.next}
          </button>
        </div>
        {!valid[step] && <p className="v9-fineprint">{O.steps[step].missing}</p>}

        <details className="v9-answers">
          <summary>{O.summaryTitle}</summary>
          <dl>
            {O.steps.map((s, i) => (
              <div key={s.name}>
                <dt>
                  <button type="button" className="underline-offset-2 hover:underline" disabled={i > step && !valid.slice(0, i).every(Boolean)} onClick={() => goTo(i)}>
                    {s.name}
                  </button>
                </dt>
                <dd data-empty={answers[i] === null}>{answers[i] ?? O.notChosen}</dd>
              </div>
            ))}
          </dl>
        </details>
        <p className="v9-fineprint v9-onboard-footnote">{c.simulation}</p>
      </div>
    </main>
  );
}

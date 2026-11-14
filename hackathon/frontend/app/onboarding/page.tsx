"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Area, Category, UserProfileInput } from "@/lib/types";
import { PrimaryButton } from "@/components/States";
import { defaultEnd, defaultStart, endForStart, endOptions, lengthLabel, startOptions, toHHMM } from "@/lib/tripTime";

// 6.2 — values are the API contract (8.9).
const INTERESTS: { label: string; value: Category; icon: string }[] = [
  { label: "Nature", value: "nature", icon: "🌳" },
  { label: "Markets", value: "market", icon: "🏪" },
  { label: "Cafés", value: "cafe", icon: "☕" },
  { label: "Local food", value: "food", icon: "🥢" },
  { label: "Culture & history", value: "culture", icon: "🏯" },
  { label: "Photo spots", value: "photo", icon: "📷" },
];

type Draft = {
  interests: Category[];
  fitness_level?: 1 | 2 | 3;
  max_walk_min?: 10 | 20 | 30;
  avoid_slopes: boolean;
  condition_today?: "great" | "normal" | "tired";
  diet?: "none" | "vegan" | "vegetarian" | "halal";
  area_id?: string;
  start: number; // minutes from midnight
  end: number;
};

const TITLES = [
  "What do you enjoy?",
  "How do you like to move?",
  "How do you feel today?",
  "Any food needs?",
  "Where will you spend your day?",
  "When is your day?",
];
const AREA_STEP = 4;
const TIME_STEP = 5;

const AREA_GROUPS: { group: Area["group"]; title: string }[] = [
  { group: "jeju", title: "Jeju City side (north)" },
  { group: "seogwipo", title: "Seogwipo side (south)" },
];

type AreaList = { kind: "loading" } | { kind: "error" } | { kind: "ok"; areas: Area[] };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "nocandidates" }
  | { kind: "badtime" }
  | { kind: "badarea" };

// Same border, corners and text size as Choice.
const SELECT_CLASS =
  "mt-2 w-full rounded-2xl border-2 border-line bg-white px-4 py-3.5 text-[16px] font-medium text-ink focus:border-sea focus:outline-none";

function TimeSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  options: number[];
  onChange: (min: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <select id={id} className={SELECT_CLASS} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((m) => (
          <option key={m} value={m}>
            {toHHMM(m)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Choice({
  selected,
  onClick,
  disabled = false,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left text-[16px] font-medium transition-colors ${
        disabled
          ? "border-line bg-white text-ink opacity-50 cursor-not-allowed"
          : selected
            ? "border-sea bg-sea-soft text-ink"
            : "border-line bg-white text-ink hover:border-sea/40"
      }`}
    >
      {children}
    </button>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => {
    // The device clock; the traveler is in Jeju, so this is taken as Korean time.
    const start = defaultStart(new Date());
    return { interests: [], avoid_slopes: false, start, end: defaultEnd(start) };
  });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [areaList, setAreaList] = useState<AreaList>({ kind: "loading" });
  const inFlight = useRef(false);

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

  const valid = [
    d.interests.length > 0,
    d.fitness_level != null && d.max_walk_min != null,
    d.condition_today != null,
    d.diet != null,
    areaList.kind === "ok" && areaList.areas.some((a) => a.id === d.area_id && a.selectable),
    endOptions(d.start).includes(d.end),
  ];

  async function submit() {
    if (inFlight.current) return; // US-01: only one request even on double tap
    inFlight.current = true;
    setStatus({ kind: "loading" });
    const profile: UserProfileInput = {
      interests: d.interests,
      fitness_level: d.fitness_level!,
      max_walk_min: d.max_walk_min!,
      avoid_slopes: d.avoid_slopes,
      condition_today: d.condition_today!,
      diet: d.diet!,
    };
    try {
      const course = await api.createCourse(profile, d.area_id!, toHHMM(d.start), toHHMM(d.end));
      router.push(`/course/${course.id}`);
    } catch (e) {
      inFlight.current = false;
      const code = e instanceof ApiError ? e.code : null;
      if (code === "INVALID_AREA") {
        // The area stopped being available: back to the area step with a fresh list.
        setD((prev) => ({ ...prev, area_id: undefined }));
        setStep(AREA_STEP);
        setStatus({ kind: "badarea" });
        loadAreas();
        return;
      }
      setStatus({
        kind: code === "NO_CANDIDATES" ? "nocandidates" : code === "INVALID_TIME_WINDOW" ? "badtime" : "error",
      });
    }
  }

  if (status.kind === "loading") {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="spinner" />
        <p className="text-lg font-semibold">Building your day from verified places…</p>
        <p className="text-sm text-muted">This can take up to a minute.</p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="px-5 pt-6">
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {step + 1} / {TITLES.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden">
          <div className="h-full bg-sea transition-all" style={{ width: `${((step + 1) / TITLES.length) * 100}%` }} />
        </div>
        <h1 className="mt-6 text-2xl font-bold">{TITLES[step]}</h1>
        {step === 0 && <p className="mt-1 text-muted">Pick one or more.</p>}
      </header>

      <section className="flex-1 px-5 py-5 space-y-3">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {INTERESTS.map((o) => {
              const on = d.interests.includes(o.value);
              return (
                <Choice
                  key={o.value}
                  selected={on}
                  onClick={() =>
                    setD({
                      ...d,
                      interests: on ? d.interests.filter((x) => x !== o.value) : [...d.interests, o.value],
                    })
                  }
                >
                  <span className="block text-2xl">{o.icon}</span>
                  <span className="mt-1 block">{o.label}</span>
                </Choice>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="font-semibold">Energy level</p>
              {(
                [
                  ["Take it easy", 1],
                  ["Average", 2],
                  ["Active", 3],
                ] as const
              ).map(([label, v]) => (
                <Choice key={v} selected={d.fitness_level === v} onClick={() => setD({ ...d, fitness_level: v })}>
                  {label}
                </Choice>
              ))}
            </div>
            <div className="space-y-2">
              <p className="font-semibold">How long can you walk at a time?</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["10 min", 10],
                    ["20 min", 20],
                    ["30 min or more", 30],
                  ] as const
                ).map(([label, v]) => (
                  <Choice key={v} selected={d.max_walk_min === v} onClick={() => setD({ ...d, max_walk_min: v })}>
                    <span className="block text-center text-sm">{label}</span>
                  </Choice>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-2xl border-2 border-line px-4 py-3.5">
              <span className="font-medium">Avoid uphill</span>
              <input
                type="checkbox"
                className="h-6 w-6 accent-[#1f7a8c]"
                checked={d.avoid_slopes}
                onChange={(e) => setD({ ...d, avoid_slopes: e.target.checked })}
              />
            </label>
          </div>
        )}

        {step === 2 &&
          (
            [
              ["Great", "great", "😄"],
              ["Okay", "normal", "🙂"],
              ["A bit tired", "tired", "🥱"],
            ] as const
          ).map(([label, v, icon]) => (
            <Choice key={v} selected={d.condition_today === v} onClick={() => setD({ ...d, condition_today: v })}>
              <span className="mr-2">{icon}</span>
              {label}
            </Choice>
          ))}

        {step === 3 &&
          (
            [
              ["No restrictions", "none"],
              ["Vegan", "vegan"],
              ["Vegetarian", "vegetarian"],
              ["Halal", "halal"],
            ] as const
          ).map(([label, v]) => (
            <Choice key={v} selected={d.diet === v} onClick={() => setD({ ...d, diet: v })}>
              {label}
            </Choice>
          ))}

        {step === AREA_STEP && areaList.kind === "loading" && (
          <div className="flex items-center gap-3 rounded-2xl border border-line p-4" role="status">
            <div className="spinner" />
            <p className="font-medium">Loading areas…</p>
          </div>
        )}
        {step === AREA_STEP && areaList.kind === "error" && (
          <div role="alert" className="rounded-2xl bg-tangerine-soft border border-[#f6c99a] p-4">
            <p className="font-semibold">We couldn&apos;t load the areas.</p>
            <PrimaryButton className="mt-3 w-full" onClick={loadAreas}>
              Try again
            </PrimaryButton>
          </div>
        )}
        {step === AREA_STEP && areaList.kind === "ok" && (
          <div className="space-y-6">
            {status.kind === "badarea" && (
              <p role="alert" className="rounded-2xl bg-tangerine-soft border border-[#f6c99a] p-4 font-semibold">
                That area isn&apos;t available right now. Please pick another.
              </p>
            )}
            {AREA_GROUPS.map(({ group, title }) => (
              <div key={group} className="space-y-2">
                <h2 className="font-semibold">{title}</h2>
                {areaList.areas
                  .filter((a) => a.group === group)
                  .map((a) => (
                    <Choice
                      key={a.id}
                      selected={d.area_id === a.id}
                      disabled={!a.selectable}
                      onClick={() => {
                        setD({ ...d, area_id: a.id });
                        if (status.kind === "badarea") setStatus({ kind: "idle" });
                      }}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span>{a.name_en}</span>
                        {!a.selectable && <span className="shrink-0 text-xs font-semibold">Coming soon</span>}
                      </span>
                      <span className="mt-0.5 block text-sm font-normal text-muted">{a.description_en}</span>
                    </Choice>
                  ))}
              </div>
            ))}
          </div>
        )}

        {step === TIME_STEP && (
          <div className="space-y-5">
            <TimeSelect
              id="trip-start"
              label="Start"
              value={d.start}
              options={startOptions()}
              onChange={(start) => {
                setD({ ...d, start, end: endForStart(start, d.end) });
                if (status.kind === "badtime") setStatus({ kind: "idle" });
              }}
            />
            <TimeSelect
              id="trip-end"
              label="End"
              value={d.end}
              options={endOptions(d.start)}
              onChange={(end) => {
                setD({ ...d, end });
                if (status.kind === "badtime") setStatus({ kind: "idle" });
              }}
            />
            <p className="text-muted" aria-live="polite">
              {lengthLabel(d.start, d.end)}
            </p>
            {status.kind === "badtime" && (
              <p role="alert" className="rounded-2xl bg-tangerine-soft border border-[#f6c99a] p-4 font-semibold">
                Please check your start and end time.
              </p>
            )}
          </div>
        )}

        {status.kind === "error" && (
          <div role="alert" className="rounded-2xl bg-tangerine-soft border border-[#f6c99a] p-4">
            <p className="font-semibold">That took longer than expected.</p>
            <PrimaryButton className="mt-3 w-full" onClick={submit}>
              Try again
            </PrimaryButton>
          </div>
        )}
        {status.kind === "nocandidates" && (
          <div role="alert" className="rounded-2xl bg-tangerine-soft border border-[#f6c99a] p-4">
            <p className="font-semibold">We couldn&apos;t find enough places for these choices.</p>
            <PrimaryButton
              className="mt-3 w-full"
              onClick={() => {
                setStatus({ kind: "idle" });
                setStep(0);
              }}
            >
              Change my answers
            </PrimaryButton>
          </div>
        )}
      </section>

      <footer className="sticky bottom-0 bg-white border-t border-line px-5 py-4 flex gap-3">
        <button
          type="button"
          onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}
          className="rounded-2xl border border-line px-5 py-3.5 font-semibold"
        >
          Back
        </button>
        {step < TITLES.length - 1 ? (
          <PrimaryButton className="flex-1" disabled={!valid[step]} onClick={() => setStep(step + 1)}>
            Next
          </PrimaryButton>
        ) : (
          <PrimaryButton className="flex-1" disabled={!valid.every(Boolean)} onClick={submit}>
            Create my day
          </PrimaryButton>
        )}
      </footer>
    </main>
  );
}

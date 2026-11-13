"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { JejuMap } from "@/components/JejuMap";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { moveLabel, StopCard } from "@/components/StopCard";
import { api, ApiError } from "@/lib/api";
import type { Course, CourseItem, ReplanReason } from "@/lib/types";
import { useCourse } from "@/lib/useCourse";

const BUTTONS: { reason: ReplanReason; label: string; icon: string }[] = [
  { reason: "rain", label: "It's raining", icon: "🌧️" },
  { reason: "closed", label: "It's closed", icon: "🚫" },
  { reason: "hungry", label: "I'm hungry", icon: "🍜" },
  { reason: "tired", label: "I'm tired", icon: "🥱" },
];

function successText(reason: ReplanReason, closedName: string) {
  switch (reason) {
    case "rain":
      return "Plan updated. Indoor stops for the rest of your day.";
    case "closed":
      return `Thanks, we've noted that ${closedName} was closed. Here's an alternative.`;
    case "hungry":
      return "Added a place to eat nearby.";
    case "tired":
      return "Plan updated. Easier stops with less walking.";
  }
}

type Replan =
  | { kind: "idle" }
  | { kind: "loading"; reason: ReplanReason }
  | { kind: "error"; reason: ReplanReason; noCandidates: boolean };

// 6.4 Trip mode
export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const { course, setCourse, state, reload } = useCourse(id);
  const [cur, setCur] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [replan, setReplan] = useState<Replan>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const [confirmClosed, setConfirmClosed] = useState(false);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(false);
  const inFlight = useRef(false);

  // first visit: the item the server marks as current (Q-11: progress lives in the browser until a replan)
  useEffect(() => {
    if (course && cur === null) {
      const c = course.items.find((i) => i.status === "current") ?? course.items[0];
      setCur(c ? c.order : null);
    }
  }, [course, cur]);

  const items: CourseItem[] = useMemo(() => {
    if (!course || cur === null) return [];
    return course.items.map((i) => ({
      ...i,
      status: i.order < cur ? "done" : i.order === cur ? "current" : "upcoming",
    }));
  }, [course, cur]);

  if (state.kind === "loading") return <CourseSkeleton />;
  if (state.kind === "notfound")
    return <MessageScreen title="We couldn't find this plan." action={<NewPlanLink />} />;
  if (state.kind === "error" || !course)
    return (
      <MessageScreen title="Something went wrong." action={<PrimaryButton onClick={reload}>Retry</PrimaryButton>} />
    );

  const current = items.find((i) => i.status === "current");
  const upcoming = items.filter((i) => i.status === "upcoming");
  const done = items.filter((i) => i.status === "done");
  const busy = replan.kind === "loading";

  function next() {
    if (!current) return;
    const after = items.find((i) => i.order > current.order);
    setToast(null);
    setNewKeys(new Set());
    if (after) {
      setCur(after.order);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else setFinished(true);
  }

  async function doReplan(reason: ReplanReason) {
    if (!current || inFlight.current || !course) return;
    inFlight.current = true;
    setConfirmClosed(false);
    setToast(null);
    setReplan({ kind: "loading", reason });
    const closedName = current.place.name_en;
    const before = new Set(course.items.map((i) => `${i.order}:${i.place_id}`));
    try {
      const updated: Course = await api.replan(course.id, reason, current.order);
      setCourse(updated);
      const c = updated.items.find((i) => i.status === "current");
      setCur(c ? c.order : current.order);
      setNewKeys(new Set(updated.items.map((i) => `${i.order}:${i.place_id}`).filter((k) => !before.has(k))));
      setReplan({ kind: "idle" });
      setToast(successText(reason, closedName));
    } catch (e) {
      setReplan({ kind: "error", reason, noCandidates: e instanceof ApiError && e.code === "NO_CANDIDATES" });
    } finally {
      inFlight.current = false;
    }
  }

  if (finished) {
    return (
      <MessageScreen
        title={course.locked_count > 0 ? "That's the end of your preview" : "Day complete 🎉"}
        body={
          course.locked_count > 0
            ? `${course.locked_count} more stops are waiting in your full day.`
            : "Thanks for exploring Jeju City at your own pace."
        }
        action={
          <div className="flex flex-col gap-3 w-full">
            {course.locked_count > 0 && (
              <Link
                href={`/course/${course.id}/purchase`}
                className="rounded-2xl bg-tangerine text-white font-semibold py-3.5 px-6"
              >
                Unlock full day
              </Link>
            )}
            <Link href={`/course/${course.id}`} className="rounded-2xl bg-sea text-white font-semibold py-3.5 px-6">
              Back to my plan
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <main className="pb-44">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-line px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/course/${course.id}`} className="text-sea text-sm font-semibold" aria-label="Back to plan">
            ←
          </Link>
          <h1 className="text-xl font-bold">Now</h1>
          {course.user_profile.conditions.indoor_only && (
            <span className="rounded-full bg-sea-soft text-sea px-2 py-0.5 text-xs font-bold">Indoor plan</span>
          )}
          {course.user_profile.conditions.low_walking && (
            <span className="rounded-full bg-leaf/10 text-leaf px-2 py-0.5 text-xs font-bold">Easy pace</span>
          )}
        </div>
        <button onClick={() => setShowMap((v) => !v)} className="text-sm font-semibold text-sea">
          {showMap ? "Hide map" : "Map"}
        </button>
      </header>

      {toast && (
        <div role="status" className="mx-4 mt-3 rounded-xl bg-sea text-white px-4 py-3 text-sm font-medium">
          {toast}
        </div>
      )}

      {showMap && (
        <section className="px-4 mt-3">
          <JejuMap items={items} tripMode />
        </section>
      )}

      {current && (
        <section className="px-4 mt-4">
          {moveLabel(current) && <p className="mb-2 text-sm text-muted">🧭 {moveLabel(current)} from your last stop</p>}
          <StopCard
            item={current}
            tier={course.tier}
            diet={course.user_profile.diet}
            size="large"
            isNew={newKeys.has(`${current.order}:${current.place_id}`)}
          >
            <PrimaryButton className="mt-3 w-full" onClick={next} disabled={busy}>
              Done, next stop
            </PrimaryButton>
          </StopCard>
        </section>
      )}

      <section className="px-4 mt-6">
        <h2 className="text-sm font-bold text-muted uppercase tracking-wide">Next</h2>
        {replan.kind === "loading" ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line p-4">
            <div className="spinner" />
            <p className="font-medium">Re-planning the rest of your day…</p>
          </div>
        ) : replan.kind === "error" ? (
          <div role="alert" className="mt-3 rounded-2xl bg-tangerine-soft border border-[#f6c99a] p-4">
            <p className="font-semibold">
              {replan.noCandidates
                ? "No other places fit right now. Your current plan is unchanged."
                : "We couldn't re-plan just now. Your current plan is unchanged."}
            </p>
            <div className="mt-3 flex gap-2">
              {!replan.noCandidates && (
                <PrimaryButton onClick={() => doReplan(replan.reason)}>Retry</PrimaryButton>
              )}
              <button onClick={() => setReplan({ kind: "idle" })} className="rounded-2xl border border-line px-4 font-semibold">
                Dismiss
              </button>
            </div>
          </div>
        ) : upcoming.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-sand px-4 py-3 text-muted">
            {course.locked_count > 0
              ? `This is the last stop in your preview. ${course.locked_count} more in the full day.`
              : "This is your last stop."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {upcoming.map((i) => (
              <li key={i.order} className="flex items-center gap-3 px-4 py-3">
                <span className="w-12 shrink-0 font-semibold tabular-nums">{i.start_time}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {i.place.name_en}
                    {newKeys.has(`${i.order}:${i.place_id}`) && (
                      <span className="ml-2 rounded-full bg-tangerine text-white px-1.5 py-0.5 text-[10px] font-bold align-middle">
                        New
                      </span>
                    )}
                  </p>
                  {moveLabel(i) && <p className="text-xs text-muted">{moveLabel(i)}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <details className="px-4 mt-6">
          <summary className="cursor-pointer text-sm font-bold text-muted uppercase tracking-wide">
            Earlier ({done.length})
          </summary>
          <ul className="mt-2 space-y-1 opacity-50">
            {done.map((i) => (
              <li key={i.order} className="flex gap-3 text-sm">
                <span className="w-12 tabular-nums">{i.start_time}</span>
                <span className="line-through">{i.place.name_en}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="mx-auto max-w-[430px] bg-white/95 backdrop-blur border-t border-line px-3 pt-2 pb-3">
          <p className="px-1 pb-1.5 text-xs text-muted">Something changed?</p>
          <div className="grid grid-cols-4 gap-2">
            {BUTTONS.map((b) => (
              <button
                key={b.reason}
                disabled={busy || !current}
                onClick={() => (b.reason === "closed" ? setConfirmClosed(true) : doReplan(b.reason))}
                className="flex flex-col items-center gap-0.5 rounded-xl border border-line bg-white py-2 text-[12px] font-semibold disabled:opacity-40 active:bg-sand"
              >
                <span className="text-xl" aria-hidden>
                  {b.icon}
                </span>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {confirmClosed && current && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-[430px] rounded-t-3xl bg-white p-6">
            <p className="text-lg font-bold">Report {current.place.name_en} as closed and get an alternative?</p>
            <div className="mt-5 flex flex-col gap-2">
              <PrimaryButton onClick={() => doReplan("closed")}>Yes, it&apos;s closed</PrimaryButton>
              <button onClick={() => setConfirmClosed(false)} className="rounded-2xl border border-line py-3.5 font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

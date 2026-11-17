"use client";

import Link from "next/link";
import { V9Header } from "@/components/V9Header";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { JejuMap } from "@/components/JejuMap";
import { MealGapRow, withMealGaps } from "@/components/MealGapCard";
import { QuickNavigator } from "@/components/QuickNavigator";
import { WindowSummary } from "@/components/WindowSummary";
import { MESSAGES, travelMessages, useLocale, type Messages } from "@/lib/i18n";
import { localizedPlaceName } from "@/lib/localized-place";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { MoveInfo, StopCard } from "@/components/StopCard";
import { api, ApiError } from "@/lib/api";
import { addMinutes } from "@/lib/time";
import { loadTripProgress, saveTripProgress } from "@/lib/trip-store";
import type { Course, CourseItem, ReplanReason } from "@/lib/types";
import { useCourse } from "@/lib/useCourse";

const BUTTONS: { reason: ReplanReason; icon: string }[] = [
  { reason: "rain", icon: "🌧️" },
  { reason: "closed", icon: "🚫" },
  { reason: "hungry", icon: "🍜" },
  { reason: "tired", icon: "🥱" },
];

function successText(T: Messages["trip"], reason: ReplanReason, closedName: string) {
  switch (reason) {
    case "rain":
      return T.successRain;
    case "closed":
      return T.successClosed(closedName);
    case "hungry":
      return T.successHungry;
    case "tired":
      return T.successTired;
  }
}

function moveText(T: Messages["trip"], item: CourseItem) {
  if (item.move_method == null || item.move_min == null) return null;
  return item.move_method === "walk" ? T.walkTo(item.move_min) : item.move_method === "taxi" ? T.taxiTo(item.move_min) : T.busTo(item.move_min);
}

// Identifies one exact itinerary, so progress saved for an older version of the plan is ignored.
const signatureOf = (course: Course) => course.items.map((i) => `${i.order}:${i.place_id}`).join(",");

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
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  const M = MESSAGES[locale];
  const T = M.trip;

  // "Show on map" on a card opens the map first, then selects the place once it is mounted.
  // When the map is already open, its own listener handles the event; re-sending it would loop.
  const [pendingPlaceId, setPendingPlaceId] = useState<number | null>(null);
  const showMapRef = useRef(showMap);
  showMapRef.current = showMap;
  useEffect(() => {
    const revealMap = (event: Event) => {
      const placeId = (event as CustomEvent<{ placeId: number }>).detail?.placeId;
      if (!showMapRef.current && typeof placeId === "number") setPendingPlaceId(placeId);
      setShowMap(true);
    };
    window.addEventListener("mypace:select-place", revealMap);
    return () => window.removeEventListener("mypace:select-place", revealMap);
  }, []);
  useEffect(() => {
    if (!showMap || pendingPlaceId == null) return;
    const placeId = pendingPlaceId;
    const timer = window.setTimeout(() => window.dispatchEvent(new CustomEvent("mypace:select-place", { detail: { placeId } })), 0);
    setPendingPlaceId(null);
    return () => window.clearTimeout(timer);
  }, [showMap, pendingPlaceId]);

  // First visit: the item the server marks as current (Q-11: progress lives in the browser until a replan).
  // A reload in the same tab resumes where the traveler was, as long as the itinerary is the same one.
  useEffect(() => {
    if (course && cur === null) {
      const serverCurrent = course.items.find((i) => i.status === "current") ?? course.items[0];
      const saved = loadTripProgress(course.id);
      if (saved && saved.signature === signatureOf(course) && course.items.some((i) => i.order === saved.order)) {
        setCur(Math.max(saved.order, serverCurrent?.order ?? 0));
        setFinished(saved.finished);
      } else {
        setCur(serverCurrent ? serverCurrent.order : null);
      }
    }
  }, [course, cur]);

  useEffect(() => {
    if (course && cur !== null) saveTripProgress(course.id, { order: cur, finished, signature: signatureOf(course) });
  }, [course, cur, finished]);

  useEffect(() => {
    if (confirmClosed) cancelRef.current?.focus();
  }, [confirmClosed]);

  const items: CourseItem[] = useMemo(() => {
    if (!course || cur === null) return [];
    return course.items.map((i) => ({
      ...i,
      status: i.order < cur ? "done" : i.order === cur ? "current" : "upcoming",
    }));
  }, [course, cur]);

  if (state.kind === "loading") return <CourseSkeleton />;
  if (state.kind === "notfound") return <MessageScreen icon="alert" title={M.states.notFound} body={M.states.notFoundBody} action={<NewPlanLink />} />;
  if (state.kind === "error" || !course)
    return <MessageScreen icon="alert" title={M.states.error} body={M.states.errorBody} action={<PrimaryButton onClick={reload}>{M.common.retry}</PrimaryButton>} />;

  const current = items.find((i) => i.status === "current");
  const upcoming = items.filter((i) => i.status === "upcoming");
  const done = items.filter((i) => i.status === "done");
  // US-P07: free meal times from the current stop on go in the "Next" list, in time order.
  const nextGaps = (course.meal_gaps ?? []).filter((g) => !current || g.start_time >= current.start_time);
  const busy = replan.kind === "loading";
  const previous = current ? items.filter((i) => i.order < current.order).pop() : undefined;
  const after = current ? upcoming[0] : undefined;

  function next() {
    if (!current) return;
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
    const closedName = localizedPlaceName(current.place, locale); // captured before the response replaces it
    const before = new Set(course.items.map((i) => `${i.order}:${i.place_id}`));
    try {
      const updated: Course = await api.replan(course.id, reason, current.order);
      setCourse(updated);
      const c = updated.items.find((i) => i.status === "current");
      setCur(c ? c.order : current.order);
      setNewKeys(new Set(updated.items.map((i) => `${i.order}:${i.place_id}`).filter((k) => !before.has(k))));
      setReplan({ kind: "idle" });
      // prd-recommendation-p1 US-P08: no restaurant nearby -> the server kept the next 45 minutes free instead.
      const addedFood = updated.items.some((i) => !before.has(`${i.order}:${i.place_id}`) && i.place.category === "food");
      setToast(reason === "hungry" && !addedFood ? T.successHungryGap : successText(T, reason, closedName));
    } catch (e) {
      setReplan({ kind: "error", reason, noCandidates: e instanceof ApiError && e.code === "NO_CANDIDATES" });
    } finally {
      inFlight.current = false;
    }
  }

  if (finished) {
    const preview = course.locked_count > 0;
    return (
      <MessageScreen
        icon={preview ? "lock" : "check"}
        title={preview ? T.endPreviewTitle : T.endTitle}
        body={preview ? T.endPreviewBody(course.locked_count) : T.endBody}
        action={
          <div className="flex flex-col gap-3 w-full">
            {preview && (
              <Link href={`/course/${course.id}/purchase`} className="rounded-2xl bg-tangerine text-white font-semibold py-3.5 px-6">
                {M.course.unlock}
              </Link>
            )}
            <Link href={`/course/${course.id}`} className="rounded-2xl bg-sea text-white font-semibold py-3.5 px-6">
              {T.backToPlan}
            </Link>
            <button
              type="button"
              className="rounded-2xl border border-line py-3.5 px-6 font-semibold"
              onClick={() => {
                const first = course.items.find((i) => i.status === "current") ?? course.items[0];
                setFinished(false);
                setCur(first ? first.order : null);
              }}
            >
              {T.again}
            </button>
          </div>
        }
      />
    );
  }

  const position = current ? items.findIndex((i) => i.order === current.order) + 1 : 0;
  const thenMove = after ? moveText(T, after) : null;

  return (
    <main className="trip-page v9-trip">
      <V9Header />
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-line px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link href={`/course/${course.id}`} className="text-sea text-sm font-semibold" aria-label={T.backAria}>
              ←
            </Link>
            <h1 className="text-xl font-bold">{tx.now}</h1>
            {current && <span className="text-sm text-muted tabular-nums">{T.progress(position, items.length)}</span>}
            {course.user_profile.conditions.indoor_only && <span className="rounded-full bg-sea-soft text-sea px-2 py-0.5 text-xs font-bold">{tx.indoorPlan}</span>}
            {course.user_profile.conditions.low_walking && <span className="rounded-full bg-leaf/10 text-leaf px-2 py-0.5 text-xs font-bold">{tx.easyPace}</span>}
          </div>
          <button type="button" onClick={() => setShowMap((v) => !v)} className="text-sm font-semibold text-sea" aria-expanded={showMap} aria-controls="trip-map">
            {showMap ? tx.hideMap : tx.map}
          </button>
        </div>
        <div className="trip-meter" aria-hidden="true">
          {items.map((i) => (
            <span key={i.order} data-state={i.status} />
          ))}
        </div>
      </header>

      <div className="px-4 mt-3">
        <WindowSummary course={course} />
      </div>
      {toast && (
        <div role="status" className="mx-4 mt-3 flex items-start gap-3 rounded-xl bg-sea text-white px-4 py-3 text-sm font-medium">
          <span className="flex-1">{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label={M.common.dismiss} className="leading-none">
            ✕
          </button>
        </div>
      )}

      {showMap && (
        <section className="px-4 mt-3" id="trip-map">
          <JejuMap items={items} tripMode />
          <p className="v9-fineprint mt-2">{M.course.lineNote}</p>
        </section>
      )}

      {current && (
        <section className="px-4 mt-4" aria-label={T.now}>
          {/* What to do now, and what comes next: readable at a glance, mid-trip. */}
          <div className="trip-guide">
            <p>{T.guideNow(localizedPlaceName(current.place, locale), addMinutes(current.start_time, current.stay_min))}</p>
            <p>{after && thenMove ? T.guideThen(thenMove, localizedPlaceName(after.place, locale)) : T.guideLast}</p>
          </div>
          <MoveInfo item={current} from={previous} />
          <StopCard
            item={current}
            tier={course.tier}
            diet={course.user_profile.diet}
            size="large"
            status="current"
            isNew={newKeys.has(`${current.order}:${current.place_id}`)}
          >
            <PrimaryButton className="mt-3 w-full" onClick={next} disabled={busy}>
              {after ? T.doneNext : T.doneLast}
            </PrimaryButton>
          </StopCard>
        </section>
      )}

      <section className="px-4 mt-6">
        <h2 className="text-sm font-bold text-muted uppercase tracking-wide">{tx.next}</h2>
        {replan.kind === "loading" ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line p-4" role="status">
            <div className="spinner" />
            <p className="font-medium">{T.replanning}</p>
          </div>
        ) : replan.kind === "error" ? (
          <div role="alert" className="mt-3 rounded-2xl bg-tangerine-soft border border-[#f6c99a] p-4">
            <p className="font-semibold">{replan.noCandidates ? T.replanNoCandidates : T.replanError}</p>
            <div className="mt-3 flex gap-2">
              {!replan.noCandidates && <PrimaryButton onClick={() => doReplan(replan.reason)}>{M.common.retry}</PrimaryButton>}
              <button type="button" onClick={() => setReplan({ kind: "idle" })} className="rounded-2xl border border-line px-4 font-semibold">
                {M.common.dismiss}
              </button>
            </div>
          </div>
        ) : upcoming.length === 0 && nextGaps.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-sand px-4 py-3 text-muted">{course.locked_count > 0 ? T.lastPreview(course.locked_count) : T.lastStop}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {withMealGaps(upcoming, nextGaps).map((e) => {
              if (e.kind === "gap") return <MealGapRow key={`gap-${e.gap.meal}-${e.gap.start_time}`} gap={e.gap} />;
              const i = e.item;
              return (
                <li key={i.order} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-12 shrink-0 font-semibold tabular-nums">{i.start_time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {localizedPlaceName(i.place, locale)}
                      {newKeys.has(`${i.order}:${i.place_id}`) && (
                        <span className="ml-2 rounded-full bg-tangerine text-white px-1.5 py-0.5 text-[10px] font-bold align-middle">{tx.new}</span>
                      )}
                    </p>
                    {i.move_method != null && i.move_min != null && <p className="text-xs text-muted">{M.move.summary(M.move.method[i.move_method], i.move_min)}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <details className="px-4 mt-6">
          <summary className="cursor-pointer text-sm font-bold text-muted uppercase tracking-wide">{T.completed(done.length)}</summary>
          <ul className="mt-2 space-y-1 opacity-50">
            {done.map((i) => (
              <li key={i.order} className="flex gap-3 text-sm">
                <span className="w-12 tabular-nums">{i.start_time}</span>
                <span className="line-through">{localizedPlaceName(i.place, locale)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <QuickNavigator currentStopId={current ? `stop-${current.order}` : undefined} trip />

      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="mx-auto max-w-[840px] bg-white/95 backdrop-blur border-t border-line px-3 pt-2 pb-3">
          <p className="px-1 pb-1.5 text-xs text-muted">{T.replanTitle}</p>
          <div className="grid grid-cols-4 gap-2">
            {BUTTONS.map((b) => (
              <button
                key={b.reason}
                type="button"
                disabled={busy || !current}
                onClick={() => (b.reason === "closed" ? setConfirmClosed(true) : doReplan(b.reason))}
                className="flex flex-col items-center gap-0.5 rounded-xl border border-line bg-white py-2 text-[12px] font-semibold disabled:opacity-40 active:bg-sand"
              >
                <span className="text-xl" aria-hidden>
                  {b.icon}
                </span>
                {T.reasons[b.reason]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {confirmClosed && current && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="closed-title"
          onClick={(e) => e.target === e.currentTarget && setConfirmClosed(false)}
          onKeyDown={(e) => e.key === "Escape" && setConfirmClosed(false)}
        >
          <div className="w-full max-w-[560px] rounded-t-3xl bg-white p-6">
            <p id="closed-title" className="text-lg font-bold">
              {T.confirmClosed(localizedPlaceName(current.place, locale))}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <PrimaryButton onClick={() => doReplan("closed")}>{T.yesClosed}</PrimaryButton>
              <button ref={cancelRef} type="button" onClick={() => setConfirmClosed(false)} className="rounded-2xl border border-line py-3.5 font-semibold">
                {M.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

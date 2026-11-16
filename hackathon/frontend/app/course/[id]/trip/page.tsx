"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomBar } from "@/components/BottomBar";
import { Icon, type IconName } from "@/components/Icon";
import { JejuMap } from "@/components/JejuMap";
import { LanguageSelect } from "@/components/LanguageSelect";
import { MealGapRow, withMealGaps } from "@/components/MealGapCard";
import { QuickNavigator } from "@/components/QuickNavigator";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { hasMove, MoveLeg, StopCard } from "@/components/StopCard";
import { api, ApiError } from "@/lib/api";
import { useLocale, type Messages } from "@/lib/i18n";
import { localizedPlaceName } from "@/lib/localized-place";
import { scrollBehavior, scrollToId } from "@/lib/motion";
import { addMinutes } from "@/lib/time";
import { loadTripProgress, saveTripProgress } from "@/lib/trip-store";
import type { Course, CourseItem, ReplanReason } from "@/lib/types";
import { useCourse } from "@/lib/useCourse";

const REASONS: { reason: ReplanReason; icon: IconName }[] = [
  { reason: "rain", icon: "rain" },
  { reason: "closed", icon: "closed" },
  { reason: "hungry", icon: "hungry" },
  { reason: "tired", icon: "tired" },
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
  const [selected, setSelected] = useState<number | null>(null);
  const inFlight = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { locale, t } = useLocale();
  const T = t.trip;

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
  if (state.kind === "notfound") {
    return <MessageScreen icon="alert" title={t.states.notFound} body={t.states.notFoundBody} action={<NewPlanLink />} />;
  }
  if (state.kind === "error" || !course) {
    return (
      <MessageScreen
        icon="alert"
        title={t.states.error}
        body={t.states.errorBody}
        action={<PrimaryButton onClick={reload}>{t.common.retry}</PrimaryButton>}
      />
    );
  }

  const current = items.find((i) => i.status === "current");
  const upcoming = items.filter((i) => i.status === "upcoming");
  const done = items.filter((i) => i.status === "done");
  // US-P07: free meal times from the current stop on go in the "Next" list, in time order
  const nextGaps = (course.meal_gaps ?? []).filter((g) => !current || g.start_time >= current.start_time);
  const busy = replan.kind === "loading";
  const previous = current ? items.filter((i) => i.order < current.order).pop() : undefined;
  const after = current ? upcoming[0] : undefined;

  function next() {
    if (!current) return;
    setToast(null);
    setNewKeys(new Set());
    setSelected(null);
    if (after) {
      setCur(after.order);
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    } else setFinished(true);
  }

  async function doReplan(reason: ReplanReason) {
    if (!current || inFlight.current || !course) return;
    inFlight.current = true;
    setConfirmClosed(false);
    setToast(null);
    setReplan({ kind: "loading", reason });
    const closedName = localizedPlaceName(current.place, locale);
    const before = new Set(course.items.map((i) => `${i.order}:${i.place_id}`));
    try {
      const updated: Course = await api.replan(course.id, reason, current.order);
      setCourse(updated);
      const c = updated.items.find((i) => i.status === "current");
      setCur(c ? c.order : current.order);
      setNewKeys(new Set(updated.items.map((i) => `${i.order}:${i.place_id}`).filter((k) => !before.has(k))));
      setReplan({ kind: "idle" });
      // prd-recommendation-p1 US-P08: no restaurant nearby -> the server kept the next 45 minutes free instead
      const addedFood = updated.items.some(
        (i) => !before.has(`${i.order}:${i.place_id}`) && i.place.category === "food",
      );
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
          <>
            {preview && (
              <Link href={`/course/${course.id}/purchase`} className="btn btn-accent">
                {t.course.unlock}
              </Link>
            )}
            <Link href={`/course/${course.id}`} className={`btn ${preview ? "btn-secondary" : "btn-primary"}`}>
              {T.backToPlan}
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const first = course.items.find((i) => i.status === "current") ?? course.items[0];
                setFinished(false);
                setCur(first ? first.order : null);
              }}
            >
              {T.again}
            </button>
          </>
        }
      />
    );
  }

  const position = current ? items.findIndex((i) => i.order === current.order) + 1 : 0;
  const thenMove = after ? moveText(T, after) : null;

  return (
    <main className="trip with-bottom-bar">
      <header className="trip__bar">
        <div className="page">
          <div className="trip__bar-inner">
            <Link href={`/course/${course.id}`} className="icon-btn" aria-label={T.backAria}>
              <Icon name="arrowLeft" size={20} />
            </Link>
            <div className="trip__heading">
              <h1>{T.title}</h1>
              {current && <p>{T.progress(position, items.length)}</p>}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm trip__map-toggle"
              aria-expanded={showMap}
              aria-controls="trip-map"
              onClick={() => setShowMap((v) => !v)}
            >
              <Icon name="map" size={18} />
              {showMap ? T.hideMap : T.map}
            </button>
            <LanguageSelect compact />
          </div>
          <div className="trip__meter" aria-hidden="true">
            {items.map((i) => (
              <span key={i.order} data-state={i.status} />
            ))}
          </div>
        </div>
      </header>

      <div className="trip__grid page">
        <section className="min-w-0" aria-label={T.now}>
          {(course.user_profile.conditions.indoor_only || course.user_profile.conditions.low_walking) && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {course.user_profile.conditions.indoor_only && (
                <li className="chip chip-sea">
                  <Icon name="home" size={14} />
                  {T.indoorPlan}
                </li>
              )}
              {course.user_profile.conditions.low_walking && (
                <li className="chip chip-leaf">
                  <Icon name="bench" size={14} />
                  {T.easyPace}
                </li>
              )}
            </ul>
          )}

          {toast && (
            <div role="status" className="toast">
              <Icon name="check" size={20} />
              <span>{toast}</span>
              <button type="button" onClick={() => setToast(null)} aria-label={t.common.dismiss}>
                <Icon name="close" size={18} />
              </button>
            </div>
          )}

          {current && (
            <>
              {/* What to do now, and what comes next: readable at a glance, mid-trip. */}
              <div className="guide">
                <p className="label">{T.now}</p>
                <p>{T.guideNow(localizedPlaceName(current.place, locale), addMinutes(current.start_time, current.stay_min))}</p>
                <p>{after && thenMove ? T.guideThen(thenMove, localizedPlaceName(after.place, locale)) : T.guideLast}</p>
              </div>

              {hasMove(current) && <MoveLeg from={previous} to={current} />}
              <StopCard
                item={current}
                tier={course.tier}
                diet={course.user_profile.diet}
                size="large"
                status="current"
                isNew={newKeys.has(`${current.order}:${current.place_id}`)}
                onShowOnMap={() => {
                  setShowMap(true);
                  setSelected(current.order);
                  requestAnimationFrame(() => document.getElementById("trip-map")?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" }));
                }}
              >
                <PrimaryButton className="btn-block mt-3" onClick={next} disabled={busy}>
                  {after ? T.doneNext : T.doneLast}
                </PrimaryButton>
              </StopCard>
            </>
          )}
        </section>

        <aside className="trip__side">
          <section className="card panel trip__map" id="trip-map" data-open={showMap} aria-label={T.map} style={{ scrollMarginTop: 96 }}>
            <JejuMap
              items={items}
              tripMode
              selectedOrder={selected}
              onSelectOrder={setSelected}
              onViewStop={(order) => current && order === current.order && scrollToId(`stop-${order}`)}
            />
            <p className="fine mt-3">{t.course.lineNote}</p>
          </section>

          <section className="card panel" aria-labelledby="next-title">
            <div className="panel__head">
              <h2 id="next-title" className="section-title">
                {T.next}
              </h2>
            </div>
            {replan.kind === "loading" ? (
              <div className="flex items-center gap-3 py-2" role="status">
                <div className="spinner" />
                <p className="font-semibold">{T.replanning}</p>
              </div>
            ) : replan.kind === "error" ? (
              <div role="alert" className="notice notice-error">
                <Icon name="alert" size={20} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{replan.noCandidates ? T.replanNoCandidates : T.replanError}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!replan.noCandidates && (
                      <PrimaryButton className="btn-sm" onClick={() => doReplan(replan.reason)}>
                        {t.common.retry}
                      </PrimaryButton>
                    )}
                    <button type="button" onClick={() => setReplan({ kind: "idle" })} className="btn btn-secondary btn-sm">
                      {t.common.dismiss}
                    </button>
                  </div>
                </div>
              </div>
            ) : upcoming.length === 0 && nextGaps.length === 0 ? (
              <p className="text-[15px] text-muted">{course.locked_count > 0 ? T.lastPreview(course.locked_count) : T.lastStop}</p>
            ) : (
              <ol className="next-list">
                {withMealGaps(upcoming, nextGaps).map((e) => {
                  if (e.kind === "gap") return <MealGapRow key={`gap-${e.gap.meal}-${e.gap.start_time}`} gap={e.gap} />;
                  const i = e.item;
                  return (
                  <li key={i.order}>
                    <span className="stop-no" aria-hidden="true">
                      {i.order}
                    </span>
                    <time>{i.start_time}</time>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {localizedPlaceName(i.place, locale)}
                        {newKeys.has(`${i.order}:${i.place_id}`) && (
                          <span className="chip chip-solid ml-2 align-middle" style={{ padding: "1px 7px", fontSize: 11 }}>
                            {t.stop.isNew}
                          </span>
                        )}
                      </p>
                      {i.move_method != null && i.move_min != null && (
                        <small>{t.move.summary(t.move.method[i.move_method], i.move_min)}</small>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ol>
            )}
          </section>

          {done.length > 0 && (
            <details className="card panel">
              <summary className="section-title flex cursor-pointer items-center justify-between" style={{ listStyle: "none" }}>
                {T.completed(done.length)}
                <Icon name="chevronDown" size={18} />
              </summary>
              <ol className="done-list mt-2">
                {done.map((i) => (
                  <li key={i.order}>
                    <span className="stop-no is-done" aria-hidden="true">
                      <Icon name="check" size={15} strokeWidth={2.4} />
                    </span>
                    <time>{i.start_time}</time>
                    <span className="truncate">{localizedPlaceName(i.place, locale)}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </aside>
      </div>

      <QuickNavigator targetId={current ? `stop-${current.order}` : undefined} mode="current" />

      <BottomBar label={T.replanTitle}>
        <p className="label replan__title">{T.replanTitle}</p>
        <div className="replan">
          {REASONS.map((b) => (
            <button
              key={b.reason}
              type="button"
              disabled={busy || !current}
              onClick={() => (b.reason === "closed" ? setConfirmClosed(true) : doReplan(b.reason))}
            >
              <Icon name={b.icon} size={22} />
              {T.reasons[b.reason]}
            </button>
          ))}
        </div>
      </BottomBar>

      {confirmClosed && current && (
        <div
          className="sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="closed-title"
          onClick={(e) => e.target === e.currentTarget && setConfirmClosed(false)}
          onKeyDown={(e) => e.key === "Escape" && setConfirmClosed(false)}
        >
          <div className="sheet">
            <p id="closed-title" className="display" style={{ fontSize: 22 }}>
              {T.confirmClosed(localizedPlaceName(current.place, locale))}
            </p>
            <div className="mt-6 grid gap-2.5">
              <PrimaryButton onClick={() => doReplan("closed")}>{T.yesClosed}</PrimaryButton>
              <button ref={cancelRef} type="button" onClick={() => setConfirmClosed(false)} className="btn btn-secondary">
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

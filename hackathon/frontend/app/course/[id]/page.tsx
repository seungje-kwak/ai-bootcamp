"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BottomBar } from "@/components/BottomBar";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { JejuMap } from "@/components/JejuMap";
import { LanguageSelect } from "@/components/LanguageSelect";
import { QuickNavigator } from "@/components/QuickNavigator";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { hasMove, MoveLeg, StopCard } from "@/components/StopCard";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { localizedPlaceName } from "@/lib/localized-place";
import { scrollBehavior, scrollToId } from "@/lib/motion";
import { courseSpan, PLAN_MINUTES, toMinutes } from "@/lib/time";
import { loadTravelWindow, type TravelWindow } from "@/lib/trip-store";
import type { Place } from "@/lib/types";
import { useCourse } from "@/lib/useCourse";

// 6.3 Result page: summary, route map, timeline, the lock card for previews, and "Start my day".
export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { course, state, reload } = useCourse(id);
  const { locale, t } = useLocale();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [travelWindow, setTravelWindow] = useState<TravelWindow | null>(null);

  useEffect(() => {
    api
      .places()
      .then((r) => setPlaces(r.places))
      .catch(() => setPlaces([]));
  }, []);
  useEffect(() => setTravelWindow(loadTravelWindow(id)), [id]);

  // Map -> timeline: on a wide screen both are visible, so bring the card into view as well.
  const selectFromMap = useCallback((order: number | null) => {
    setSelected(order);
    if (order != null && window.matchMedia("(min-width: 1024px)").matches) scrollToId(`stop-${order}`);
  }, []);
  const viewStop = useCallback((order: number) => {
    setSelected(order);
    scrollToId(`stop-${order}`);
  }, []);
  // Timeline -> map: select the pin and bring the map into view (it sits above the list on a phone).
  const showOnMap = useCallback((order: number) => {
    setSelected(order);
    document.getElementById("route-map")?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
  }, []);

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

  const C = t.course;
  const items = course.items;
  const free = course.tier === "free";
  const span = courseSpan(items);
  const planMin = PLAN_MINUTES[course.user_profile.duration];

  // The window the traveler asked for is kept in this browser only. Use it when it belongs to this
  // course (same start time); the free time is what is left after the plan's length, or after the
  // real last stop when the whole course is visible.
  const win = travelWindow && span && travelWindow.start === span.start ? travelWindow : null;
  const spareMin = win
    ? free || course.locked_count > 0
      ? toMinutes(win.end) - (toMinutes(win.start) + planMin)
      : toMinutes(win.end) - toMinutes(span!.end)
    : 0;

  return (
    <main className="course with-bottom-bar" id="course-top">
      <header className="topbar page">
        <Brand label={t.common.home} />
        <LanguageSelect />
      </header>

      <section className="course__head page">
        <span className={`chip ${free ? "chip-coral" : "chip-sea"}`}>{free ? C.tierFree : C.tierPremium}</span>
        <h1 className="display course__title">{C.title}</h1>

        {span && (
          <dl className="facts">
            <div className="fact">
              <dt>
                <Icon name="pin" size={15} />
                {C.factStops}
              </dt>
              <dd>
                {course.total_items}
                {course.locked_count > 0 && <small>{C.previewShown(items.length, course.total_items)}</small>}
              </dd>
            </div>
            <div className="fact">
              <dt>
                <Icon name="clock" size={15} />
                {C.factStart}
              </dt>
              <dd>{span.start}</dd>
            </div>
            <div className="fact">
              <dt>
                <Icon name="flag" size={15} />
                {course.locked_count > 0 ? C.factFinishPreview : C.factFinish}
              </dt>
              <dd>{span.end}</dd>
            </div>
            <div className="fact">
              <dt>
                <Icon name="route" size={15} />
                {C.factLength}
              </dt>
              <dd>{C.planLength(t.common.duration(planMin))}</dd>
            </div>
          </dl>
        )}

        <div className="course__notes">
          {win && (
            <p>
              {C.yourWindow(win.start, win.end)} {spareMin >= 10 && C.freeAfter(t.common.duration(spareMin))}
            </p>
          )}
          <p className="fine">{C.timesNote}</p>
        </div>
      </section>

      <div className="course__grid page">
        <section aria-labelledby="itinerary-title" className="min-w-0">
          <h2 id="itinerary-title" className="section-title mb-3">
            {C.itinerary}
          </h2>
          {items.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="font-semibold">{C.empty}</p>
              <div className="mt-4">
                <NewPlanLink />
              </div>
            </div>
          ) : (
            <ol className="timeline">
              {items.map((it, i) => (
                <li key={`${it.order}:${it.place_id}`}>
                  {hasMove(it) && <MoveLeg from={i > 0 ? items[i - 1] : undefined} to={it} />}
                  <StopCard
                    item={it}
                    tier={course.tier}
                    diet={course.user_profile.diet}
                    selected={selected === it.order}
                    onShowOnMap={() => showOnMap(it.order)}
                  />
                </li>
              ))}
            </ol>
          )}

          {course.locked_count > 0 && (
            <div className="locked">
              <span className="locked__icon">
                <Icon name="lock" size={22} />
              </span>
              <h3>{C.locked(course.locked_count)}</h3>
              <p>{C.lockedBody}</p>
              <Link href={`/course/${course.id}/purchase`} className="btn btn-accent">
                {C.unlock}
              </Link>
            </div>
          )}
        </section>

        <aside className="course__side">
          <section className="card panel" id="route-map" aria-labelledby="map-title" style={{ scrollMarginTop: 16 }}>
            <div className="panel__head">
              <h2 id="map-title" className="section-title">
                {C.mapTitle}
              </h2>
            </div>
            <JejuMap items={items} places={places} selectedOrder={selected} onSelectOrder={selectFromMap} onViewStop={viewStop} />
            <p className="fine mt-3">
              {C.mapHint} {C.lineNote}
            </p>
          </section>

          {items.length > 0 && (
            <section className="card panel" aria-labelledby="overview-title">
              <div className="panel__head">
                <h2 id="overview-title" className="section-title">
                  {C.overview}
                </h2>
              </div>
              <ol className="overview">
                {items.map((it) => (
                  <li key={it.order}>
                    <button type="button" aria-current={selected === it.order ? "true" : undefined} onClick={() => viewStop(it.order)}>
                      <span className="stop-no" aria-hidden="true">
                        {it.order}
                      </span>
                      <time>{it.start_time}</time>
                      <span>{localizedPlaceName(it.place, locale)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>

      <QuickNavigator targetId={items.length ? `stop-${items[0].order}` : undefined} mode="first" />

      <BottomBar>
        <div className="flex justify-center lg:justify-end">
          <Link href={`/course/${course.id}/trip`} className="btn btn-primary btn-block" style={{ maxWidth: 440 }}>
            {C.start}
          </Link>
        </div>
      </BottomBar>
    </main>
  );
}

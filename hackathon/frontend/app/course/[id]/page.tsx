"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { V9Header } from "@/components/V9Header";
import { JejuMap } from "@/components/JejuMap";
import { MealGapCard, withMealGaps } from "@/components/MealGapCard";
import { QuickNavigator } from "@/components/QuickNavigator";
import { WindowSummary } from "@/components/WindowSummary";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { MoveInfo, StopCard } from "@/components/StopCard";
import { api } from "@/lib/api";
import { MESSAGES, useLocale, travelMessages } from "@/lib/i18n";
import { localizedPlaceName } from "@/lib/localized-place";
import { scrollToId } from "@/lib/motion";
import { courseSpan } from "@/lib/time";
import { useV6Copy } from "@/lib/v6-copy";
import { type Area, DEFAULT_AREA_ID, type Place } from "@/lib/types";
import { useCourse } from "@/lib/useCourse";

// Taxi fares come per leg from /api/route-estimate (Kakao Mobility); without that service no number is shown.
const FARE_HELP = {
  en: "Each taxi leg shows the road distance and fare once the route service answers. Without it, only the planned time is shown.",
  ko: "택시 구간마다 경로 서비스가 응답하면 도로 거리와 예상 요금이 표시돼요. 연결되지 않았을 때는 예상 이동 시간만 보여요.",
  zh: "路线服务响应后，每段出租车行程会显示道路距离和预计车费。未连接时只显示预计时间。",
  ja: "経路サービスが応答すると、タクシー区間ごとに道路距離と予想料金を表示します。未接続の場合は予定時間のみです。",
} as const;

// 6.3 Result page: summary, route map, timeline (with free meal times), the lock card for previews,
// "Shuffle my day" before the day starts, and "Start my day".
export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { course, state, reload } = useCourse(id);
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [shuffle, setShuffle] = useState<"idle" | "loading" | "error">("idle");
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  const M = MESSAGES[locale];
  const C = M.course;
  const c = useV6Copy(locale);

  // Courses saved before areas existed have no area_id; they are Jeju City courses (prd-start-area FR-13).
  const areaId = course ? (course.user_profile.area_id ?? DEFAULT_AREA_ID) : null;
  const area = areas.find((a) => a.id === areaId);
  const center = useMemo(() => (area ? { lat: area.center_lat, lng: area.center_lng } : undefined), [area]);

  useEffect(() => {
    api.areas().then((r) => setAreas(r.areas)).catch(() => setAreas([])); // area name and map centre only; failure is fine
  }, []);
  useEffect(() => {
    if (!areaId) return;
    // Only the places of the traveler's area (prd-start-area US-A02). Markers only; failure is fine.
    api.places(areaId).then((r) => setPlaces(r.places)).catch(() => setPlaces([]));
  }, [areaId]);

  // Map -> timeline: bring the card into view and mark it.
  const viewStop = useCallback((order: number) => {
    setSelected(order);
    scrollToId(`stop-${order}`);
  }, []);
  // Timeline -> map: select the pin (the map opens its card and scrolls into view).
  const showOnMap = useCallback((order: number, placeId: number) => {
    setSelected(order);
    window.dispatchEvent(new CustomEvent("mypace:select-place", { detail: { placeId } }));
  }, []);

  if (state.kind === "loading") return <CourseSkeleton />;
  if (state.kind === "notfound") return <MessageScreen icon="alert" title={M.states.notFound} body={M.states.notFoundBody} action={<NewPlanLink />} />;
  if (state.kind === "error" || !course)
    return <MessageScreen icon="alert" title={M.states.error} body={M.states.errorBody} action={<PrimaryButton onClick={reload}>{M.common.retry}</PrimaryButton>} />;

  const items = course.items;
  const free = course.tier === "free";
  const span = courseSpan(items);
  const areaName = area ? (locale === "ko" ? area.name_ko : area.name_en) : C.jeju;
  // prd-recommendation-p1 US-P16: only before the day has started.
  const canShuffle = !items.some((i) => i.status === "done");

  async function shuffleDay() {
    if (!course || shuffle === "loading") return;
    setShuffle("loading");
    try {
      const next = await api.shuffleCourse(course.id);
      router.push(`/course/${next.id}`); // a new page: the browser's back button returns to this plan
    } catch {
      setShuffle("error");
    }
  }

  return (
    <main className="v9-site v9-course" id="course-top">
      <V9Header />
      <div className="v9-route-grid">
        <section className="v9-map-column" aria-label={tx.mapTitle}>
          <div className="v9-map-panel" id="route-map">
            <div className="v9-map-heading">
              <p className="v9-eyebrow">JEJU ISLAND</p>
              <h2>{c.mapTitle}</h2>
              <small>{C.mapHint}</small>
            </div>
            <JejuMap items={items} places={places} center={center} onSelectOrder={setSelected} onViewStop={viewStop} />
            <div className="v9-map-footer">
              <span>{C.lineNote}</span>
              <a href={`https://map.kakao.com/?q=${encodeURIComponent(area?.name_ko ?? "제주도")}`} target="_blank" rel="noopener noreferrer">
                {c.kakaoMap}
              </a>
            </div>
          </div>

          {items.length > 0 && (
            <section className="v9-overview" aria-labelledby="overview-title">
              <h2 id="overview-title">{C.overview}</h2>
              <ol>
                {items.map((it) => (
                  <li key={it.order}>
                    <button type="button" aria-current={selected === it.order ? "true" : undefined} onClick={() => viewStop(it.order)}>
                      <span className="v9-overview__no" aria-hidden="true">
                        {it.order}
                      </span>
                      <time>{it.start_time}</time>
                      <span className="v9-overview__name">{localizedPlaceName(it.place, locale)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </section>

        <section className="v9-route-content" aria-label={tx.timeline}>
          <p className="v9-eyebrow">YOUR PERSONAL ITINERARY</p>
          <h1>{C.title(areaName)}</h1>
          <p className="v9-route-intro">{c.routeIntro}</p>
          <div className="v9-route-tags">
            <span className={free ? "is-preview" : "is-premium"}>{free ? C.tierFree : C.tierPremium}</span>
            <span>
              {course.total_items} {tx.stops}
              {course.locked_count > 0 ? ` · ${C.previewShown(items.length, course.total_items)}` : ""}
            </span>
            {span && (
              <span>
                ◷ {span.start} — {span.end}
              </span>
            )}
          </div>
          <WindowSummary course={course} />
          <p className="v9-fineprint">{C.timesNote}</p>

          {canShuffle && (
            <div className="v9-shuffle">
              <button type="button" className="v9-outline" onClick={shuffleDay} disabled={shuffle === "loading"} aria-busy={shuffle === "loading"}>
                <span aria-hidden="true">✦</span>
                {shuffle === "loading" ? C.shuffling : C.shuffle}
              </button>
              {shuffle === "error" && (
                <p role="alert" className="v9-form-error">
                  {C.shuffleError}
                </p>
              )}
            </div>
          )}

          {items.length === 0 ? (
            <div className="v9-empty">
              <p>{C.empty}</p>
              <NewPlanLink />
            </div>
          ) : (
            <ol className="v9-timeline">
              {withMealGaps(items, course.meal_gaps).map((e) => {
                if (e.kind === "gap")
                  return (
                    <li key={`gap-${e.gap.meal}-${e.gap.start_time}`} className="v9-stop-stack">
                      <MealGapCard gap={e.gap} />
                    </li>
                  );
                const it = e.item;
                const i = items.indexOf(it);
                return (
                  <li key={`${it.order}:${it.place_id}`} className="v9-stop-stack">
                    <MoveInfo item={it} from={i > 0 ? items[i - 1] : undefined} />
                    <StopCard
                      item={it}
                      tier={course.tier}
                      diet={course.user_profile.diet}
                      selected={selected === it.order}
                      onShowOnMap={() => showOnMap(it.order, it.place_id)}
                    />
                  </li>
                );
              })}
            </ol>
          )}

          {course.locked_count > 0 && (
            <Link href={`/course/${course.id}/purchase`} className="v9-upgrade">
              <span className="v9-upgrade__text">
                <strong>{C.locked(course.locked_count)}</strong>
                <small>{C.lockedBody}</small>
              </span>
              <span>{C.unlock} ↗</span>
            </Link>
          )}

          <div className="v9-transport-help">
            <h2>🚕 {c.travelHelp}</h2>
            <p>{FARE_HELP[locale]}</p>
            <p className="v9-fineprint">{c.fareNotice}</p>
          </div>
          <div className="v9-route-actions">
            <Link href="/onboarding" className="v9-outline">
              {c.edit}
            </Link>
            <Link href={`/course/${course.id}/trip`} className="v9-primary">
              {C.start}
            </Link>
          </div>
        </section>
      </div>
      <QuickNavigator currentStopId={items.length ? `stop-${items[0].order}` : undefined} />
    </main>
  );
}

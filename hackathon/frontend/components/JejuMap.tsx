"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MESSAGES, useLocale, travelMessages } from "@/lib/i18n";
import { contentHelp, localizedDescription, localizedPlaceName } from "@/lib/localized-place";
import { MAP_CONFIG } from "@/config/map";
import type { Category, CourseItem, Place } from "@/lib/types";
import { MapCategoryLegend, CATEGORY_OPTIONS } from "./MapCategoryLegend";
import { KakaoMap } from "./KakaoMap";
import { FallbackMap } from "./FallbackMap";
import { PhotoCredit, PlacePhoto } from "./PlacePhoto";

type Selected = { place: Place; stay: number; order?: number };
export type MapSelect = (s: Selected) => void;

// 7장: Kakao map when NEXT_PUBLIC_KAKAO_MAP_KEY is set and the SDK loads; otherwise the fallback SVG (7.1).
// Both draw the same markers and line; the bottom card (7.7) lives here so it is shared.
export function JejuMap({
  items,
  places = [],
  tripMode = false,
  center,
  onSelectOrder,
  onViewStop,
}: {
  items: CourseItem[];
  places?: Place[];
  tripMode?: boolean;
  /** The chosen area's centre, for a course with no stops. Pass a stable object. */
  center?: { lat: number; lng: number };
  /** Map -> timeline: which course stop is picked on the map (null when the card closes). */
  onSelectOrder?: (order: number | null) => void;
  /** "See this stop" in the bottom card scrolls the timeline to that stop. */
  onViewStop?: (order: number) => void;
}) {
  const [selected, setSelectedState] = useState<Selected | null>(null);
  const selectOrderRef = useRef(onSelectOrder);
  selectOrderRef.current = onSelectOrder;
  const setSelected = useCallback((s: Selected | null) => {
    setSelectedState(s);
    selectOrderRef.current?.(s?.order ?? null);
  }, []);
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  const selectedDescription = selected ? localizedDescription(selected.place, locale) : null;
  const [mapFailure, setMapFailure] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(() => new Set(CATEGORY_OPTIONS.map(c => c.id)));
  const toggleCategory = (cat: Category) => setActiveCategories(prev => { const next = new Set(prev); if (next.has(cat)) next.delete(cat); else next.add(cat); return next; });
  const useKakao = Boolean(MAP_CONFIG.kakaoKey) && !mapFailure;

  useEffect(() => {
    function handleSelection(e: Event) {
      const id = (e as CustomEvent<{ placeId: number }>).detail?.placeId;
      const item = items.find((it) => it.place_id === id);
      const place = item?.place ?? places.find((candidate) => candidate.id === id);
      if (!place) return;
      setSelected({ place, stay: item?.stay_min ?? place.avg_stay_min, order: item?.order });
      document.getElementById("course-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.addEventListener("mypace:select-place", handleSelection);
    return () => window.removeEventListener("mypace:select-place", handleSelection);
  }, [items, places, setSelected]);

  return (
    <div id="course-map" className="relative">
      {useKakao ? (
        <KakaoMap
          key={mapAttempt}
          items={items}
          places={places}
          tripMode={tripMode}
          activeCategories={activeCategories}
          focusPlace={selected?.place ?? null}
          center={center}
          onSelect={setSelected}
          onError={(e) => {
            console.warn("Kakao Maps SDK could not load:", e);
            setMapFailure(true);
          }}
        />
      ) : (
        <div className="v9-fallback-map">
          <FallbackMap items={items} places={places} tripMode={tripMode} activeCategories={activeCategories} onSelect={setSelected}/>
          <p className="v9-fallback-notice" role="status">
            {locale === "ko" ? "현재는 일러스트 개념도입니다. 실제 도로 경로나 위치를 정확히 나타내지 않으며, 카카오맵 연결 후 실제 지도로 전환됩니다." : locale === "en" ? "Illustrated overview only, not a real road map or precise route. Connect Kakao Maps for a live map." : locale === "zh" ? "目前为示意地图，并非真实道路或精确路线。连接 Kakao 地图后显示真实地图。" : "現在はイメージ図です。実際の道路・正確な経路ではありません。Kakaoマップ接続後に切り替わります。"}
          </p>
          {Boolean(MAP_CONFIG.kakaoKey) && <button className="v9-map-retry" type="button" onClick={() => {setMapFailure(false);setMapAttempt(n=>n+1);}}>{locale === "ko" ? "카카오맵 다시 연결" : locale === "en" ? "Retry Kakao Maps" : locale === "zh" ? "重试 Kakao 地图" : "Kakaoマップを再試行"}</button>}
        </div>
      )}

      <MapCategoryLegend active={activeCategories} onToggle={toggleCategory} />

      {selected && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label={tx.close} onClick={() => setSelected(null)} />
          <div className="absolute inset-x-2 bottom-2 z-40 overflow-hidden rounded-2xl bg-white shadow-xl border border-line">
            <div className="flex">
              <div className="w-28 shrink-0">
                <PlacePhoto place={selected.place} className="h-full min-h-[112px]" />
              </div>
              <div className="min-w-0 flex-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold leading-tight">
                    {selected.order ? `${selected.order}. ` : ""}
                    {localizedPlaceName(selected.place, locale)}
                  </p>
                  <button onClick={() => setSelected(null)} className="text-muted text-lg leading-none" aria-label={tx.close}>
                    ×
                  </button>
                </div>
                {selectedDescription && <p className="mt-1 text-xs text-muted line-clamp-2">{selectedDescription.text}</p>}
                {locale !== "en" && selectedDescription && !selectedDescription.hasTranslation && selectedDescription.original && (
                  <details className="mt-2 text-xs text-sea">
                    <summary className="cursor-pointer">{contentHelp(locale).originalDescription}</summary>
                    <p className="mt-1 text-muted" lang="en">{selectedDescription.original}</p>
                  </details>
                )}
                <p className="mt-1 text-xs font-medium text-sea">{tx.stay} {selected.stay} {tx.min}</p>
                {selected.order != null && onViewStop && (
                  <button
                    type="button"
                    className="mt-1 text-xs font-bold text-sea underline underline-offset-2"
                    onClick={() => {
                      const order = selected.order!;
                      setSelected(null);
                      onViewStop(order);
                    }}
                  >
                    {MESSAGES[locale].map.viewStop}
                  </button>
                )}
                {selected.order == null && <p className="mt-1 text-xs text-muted">{MESSAGES[locale].map.notOnRoute}</p>}
                <PhotoCredit place={selected.place} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

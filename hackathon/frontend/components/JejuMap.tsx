"use client";

import { useState } from "react";
import { type LatLng, MAP_CONFIG, toPercent } from "@/config/map";
import { kakaoPlaceUrl } from "@/lib/directions";
import { useLocale } from "@/lib/i18n";
import { localizedPlaceName } from "@/lib/localized-place";
import type { CourseItem, Place } from "@/lib/types";
import { FallbackMap } from "./FallbackMap";
import { Icon } from "./Icon";
import { KakaoMap } from "./KakaoMap";
import { PlaceDescription } from "./LocalizedText";
import { PhotoCredit, PlacePhoto } from "./PlacePhoto";

/** What a tap on the map picked: a numbered stop of the course, or another place nearby. */
export type MapPick = { kind: "stop"; order: number } | { kind: "place"; place: Place };

// 7장: Kakao map when NEXT_PUBLIC_KAKAO_MAP_KEY is set and the SDK loads; otherwise the stand-in map (7.1).
// Both draw the same numbered markers and line. The selection and the detail card (7.7) live here,
// so they behave the same on either map and stay in step with the timeline.
// `center` is the first view when the course has no stops: the center of the traveler's area.
export function JejuMap({
  items,
  places = [],
  tripMode = false,
  selectedOrder,
  onSelectOrder,
  onViewStop,
  center,
}: {
  items: CourseItem[];
  places?: Place[];
  tripMode?: boolean;
  /** Controlled selection shared with the timeline. Leave undefined to let the map keep its own. */
  selectedOrder?: number | null;
  onSelectOrder?: (order: number | null) => void;
  /** "See this stop": scroll the timeline to that card. */
  onViewStop?: (order: number) => void;
  center?: LatLng;
}) {
  const { locale, t } = useLocale();
  const [innerOrder, setInnerOrder] = useState<number | null>(null);
  const [other, setOther] = useState<Place | null>(null);
  const [kakaoFailed, setKakaoFailed] = useState(false);
  const useKakao = Boolean(MAP_CONFIG.kakaoKey) && !kakaoFailed;

  const order = selectedOrder !== undefined ? selectedOrder : innerOrder;
  const setOrder = (next: number | null) => {
    setInnerOrder(next);
    onSelectOrder?.(next);
  };
  const stop = order != null ? items.find((i) => i.order === order) : undefined;

  function pick(p: MapPick) {
    if (p.kind === "stop") {
      setOther(null);
      setOrder(order === p.order ? null : p.order);
    } else {
      setOrder(null);
      setOther(other?.id === p.place.id ? null : p.place);
    }
  }
  function close() {
    setOther(null);
    setOrder(null);
  }

  const shared = {
    items,
    places,
    tripMode,
    selectedOrder: order ?? null,
    selectedPlaceId: stop ? null : (other?.id ?? null),
    onPick: pick,
  };
  const place = stop?.place ?? other;
  // The fallback SVG cannot show a stop outside the old town: no map then, the page still lists the stops.
  const fitsFallback = items.every((it) => toPercent(it.place.lat, it.place.lng, MAP_CONFIG.fallbackBounds).inBounds);
  if (!useKakao && !fitsFallback) return null;

  return (
    <div className="map">
      {useKakao ? (
        <KakaoMap
          {...shared}
          center={center}
          onError={(e) => {
            console.warn("Kakao map unavailable, using the stand-in map:", e);
            setKakaoFailed(true);
          }}
        />
      ) : (
        <FallbackMap {...shared} />
      )}

      {place && (
        <div className="map__popup" role="region" aria-live="polite" aria-label={localizedPlaceName(place, locale)}>
          <div className="map__popup-photo">
            <PlacePhoto place={place} className="" compact />
          </div>
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="fine font-semibold" style={{ color: stop ? "var(--sea)" : undefined }}>
                  {stop ? `${t.stop.order(stop.order)}, ${stop.start_time}` : t.map.notOnRoute}
                </p>
                <h3>{localizedPlaceName(place, locale)}</h3>
                {locale !== "ko" && (
                  <p lang="ko" className="fine">
                    {place.name_ko}
                  </p>
                )}
              </div>
              <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={close} aria-label={t.map.close}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <PlaceDescription place={place} className="map__popup-desc" />
            <p className="fine mt-1.5 font-semibold" style={{ color: "var(--ink-soft)" }}>
              {t.stop.stay(stop ? stop.stay_min : place.avg_stay_min)}
            </p>
            <div className="map__popup-actions">
              {stop && onViewStop && (
                <button type="button" className="text-link" onClick={() => onViewStop(stop.order)}>
                  {t.map.viewStop}
                  <Icon name="chevronRight" size={15} />
                </button>
              )}
              <a className="text-link" href={kakaoPlaceUrl(place)} target="_blank" rel="noopener noreferrer">
                {t.map.openKakao}
                <Icon name="external" size={14} />
              </a>
            </div>
            <PhotoCredit place={place} />
          </div>
        </div>
      )}
    </div>
  );
}

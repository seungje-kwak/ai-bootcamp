"use client";

import { useEffect, useRef, useState } from "react";
import { type LatLng, MAP_CONFIG, toPercent } from "@/config/map";
import { type KakaoMaps, type KLayer, type KMap, loadKakaoMaps } from "@/lib/kakao";
import type { CourseItem, Place } from "@/lib/types";
import { CATEGORY_META } from "./CategoryIcon";
import type { MapSelect } from "./JejuMap";

const MARKER_PX = 28;

// HTML markers (7.5) built by hand: CustomOverlay takes a DOM element, not React.
function courseMarker(it: CourseItem, tripMode: boolean, onClick: () => void) {
  const meta = CATEGORY_META[it.place.category];
  const current = tripMode && it.status === "current";
  const done = tripMode && it.status === "done";
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${it.order}. ${it.place.name_en}`);
  el.style.cssText = [
    "position:relative",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    `width:${MARKER_PX}px`,
    `height:${MARKER_PX}px`,
    "border-radius:9999px",
    "border:2px solid #fff",
    `background:${meta.color}`,
    current
      ? "box-shadow:0 0 0 4px rgba(242,140,40,.5),0 4px 6px rgba(0,0,0,.2);transform:scale(1.25)"
      : "box-shadow:0 4px 6px rgba(0,0,0,.2)",
    done ? "opacity:.4" : "",
    "cursor:pointer",
    "padding:0",
  ].join(";");
  const icon = document.createElement("span");
  icon.textContent = meta.icon;
  icon.setAttribute("aria-hidden", "true");
  icon.style.cssText = "font-size:13px;line-height:1";
  const badge = document.createElement("span");
  badge.textContent = String(it.order);
  badge.style.cssText =
    "position:absolute;right:-6px;top:-6px;min-width:17px;height:17px;padding:0 2px;border-radius:9999px;" +
    "background:var(--ink);color:#fff;font-size:10px;font-weight:700;line-height:17px;text-align:center";
  el.append(icon, badge);
  el.addEventListener("click", onClick);
  return el;
}

function otherMarker(p: Place, onClick: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", p.name_en);
  el.textContent = CATEGORY_META[p.category].icon;
  el.style.cssText =
    "width:18px;height:18px;border-radius:9999px;background:rgba(255,255,255,.85);border:1px solid #fff;" +
    "font-size:10px;line-height:1;opacity:.75;cursor:pointer;padding:0;box-shadow:0 1px 2px rgba(0,0,0,.2)";
  el.addEventListener("click", onClick);
  return el;
}

// 7장: Kakao map with course markers, order numbers and a dashed line.
// Calls onError if the SDK cannot be loaded, so the parent can switch to the fallback SVG.
export function KakaoMap({
  items,
  places,
  tripMode,
  center,
  onSelect,
  onError,
}: {
  items: CourseItem[];
  places: Place[];
  tripMode: boolean;
  center?: LatLng;
  onSelect: MapSelect;
  onError: (e: unknown) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const kakaoRef = useRef<KakaoMaps | null>(null);
  const mapRef = useRef<KMap | null>(null);
  const layersRef = useRef<KLayer[]>([]);
  const fitRef = useRef<() => void>(() => {});
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const [ready, setReady] = useState(false);
  const centerLat = center?.lat ?? MAP_CONFIG.center.lat;
  const centerLng = center?.lng ?? MAP_CONFIG.center.lng;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !boxRef.current) return;
        kakaoRef.current = maps;
        mapRef.current = new maps.Map(boxRef.current, {
          center: new maps.LatLng(MAP_CONFIG.center.lat, MAP_CONFIG.center.lng),
          level: MAP_CONFIG.level,
        });
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) errorRef.current(e);
      });
    return () => {
      cancelled = true;
      layersRef.current.forEach((l) => l.setMap(null));
      layersRef.current = [];
    };
  }, []);

  // Draw markers and the line; fit the view to the course (7.4, 7.6).
  useEffect(() => {
    const maps = kakaoRef.current;
    const map = mapRef.current;
    if (!ready || !maps || !map) return;

    layersRef.current.forEach((l) => l.setMap(null));
    const layers: KLayer[] = [];
    const ll = (p: Place) => new maps.LatLng(p.lat, p.lng);
    const inBounds = (p: Place) => toPercent(p.lat, p.lng).inBounds; // 7.5: never draw out-of-bounds points

    const courseIds = new Set(items.map((i) => i.place_id));
    for (const p of places) {
      if (courseIds.has(p.id) || !inBounds(p)) continue;
      layers.push(
        new maps.CustomOverlay({
          map,
          position: ll(p),
          content: otherMarker(p, () => selectRef.current({ place: p, stay: p.avg_stay_min })),
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: 1,
          clickable: true,
        }),
      );
    }

    const stops = [...items].sort((a, b) => a.order - b.order).filter((it) => inBounds(it.place));
    if (stops.length > 1) {
      layers.push(
        new maps.Polyline({
          map,
          path: stops.map((it) => ll(it.place)),
          strokeWeight: 3,
          strokeColor: MAP_CONFIG.routeColor,
          strokeOpacity: 0.9,
          strokeStyle: "shortdash",
        }),
      );
    }
    for (const it of stops) {
      const current = tripMode && it.status === "current";
      layers.push(
        new maps.CustomOverlay({
          map,
          position: ll(it.place),
          content: courseMarker(it, tripMode, () =>
            selectRef.current({ place: it.place, stay: it.stay_min, order: it.order }),
          ),
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: current ? 4 : 3,
          clickable: true,
        }),
      );
    }
    layersRef.current = layers;

    fitRef.current = () => {
      if (stops.length === 0) {
        map.setLevel(MAP_CONFIG.level);
        map.setCenter(new maps.LatLng(centerLat, centerLng));
      } else if (stops.length === 1) {
        map.setLevel(MAP_CONFIG.singleStopLevel);
        map.setCenter(ll(stops[0].place));
      } else {
        const b = new maps.LatLngBounds();
        stops.forEach((it) => b.extend(ll(it.place)));
        const pad = MAP_CONFIG.fitPaddingPx;
        map.setBounds(b, pad, pad, pad, pad);
      }
    };
    fitRef.current();
  }, [ready, items, places, tripMode, centerLat, centerLng]);

  // Keep the map sized to its box (7.4).
  useEffect(() => {
    const el = boxRef.current;
    if (!ready || !el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.relayout();
      fitRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-line bg-sea-soft isolate"
      style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }}
    >
      <div ref={boxRef} className="absolute inset-0" />
      {!ready && <div className="skeleton absolute inset-0" aria-label="Loading map" />}
    </div>
  );
}

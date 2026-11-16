"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_CONFIG, toPercent } from "@/config/map";
import { useLocale } from "@/lib/i18n";
import { localizedPlaceName } from "@/lib/localized-place";
import type { CourseItem, Place } from "@/lib/types";
import type { MapPick } from "./JejuMap";

const MARKER_PX = 30;
// The SVG shows the old town only, so positions are taken inside that range.
const inSvg = (lat: number, lng: number) => toPercent(lat, lng, MAP_CONFIG.fallbackBounds);

// 7.10: this map cannot zoom, so push course markers apart (in px, for the current box width)
// until they stop overlapping.
function spread(points: { x: number; y: number }[], widthPx: number) {
  if (!widthPx || points.length < 2) return points;
  const heightPx = widthPx / MAP_CONFIG.aspectRatio;
  const px = points.map((p) => ({ x: (p.x / 100) * widthPx, y: (p.y / 100) * heightPx }));
  const min = MARKER_PX + 6;
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < px.length; i++) {
      for (let j = i + 1; j < px.length; j++) {
        let dx = px[j].x - px[i].x;
        let dy = px[j].y - px[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) {
          dx = Math.cos(j);
          dy = Math.sin(j);
          d = 1;
        }
        const push = (min - d) / 2;
        px[i].x -= (dx / d) * push;
        px[i].y -= (dy / d) * push;
        px[j].x += (dx / d) * push;
        px[j].y += (dy / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return px.map((p) => ({ x: (p.x / widthPx) * 100, y: (p.y / heightPx) * 100 }));
}

// Simple stand-in map, used when the Kakao map is not available (7.1). Box ratio == image ratio,
// so % positions line up at any width.
export function FallbackMap({
  items,
  places,
  tripMode,
  selectedOrder,
  selectedPlaceId,
  onPick,
}: {
  items: CourseItem[];
  places: Place[];
  tripMode: boolean;
  selectedOrder: number | null;
  selectedPlaceId: number | null;
  onPick: (pick: MapPick) => void;
}) {
  const { locale, t } = useLocale();
  const boxRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidthPx(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const courseIds = useMemo(() => new Set(items.map((i) => i.place_id)), [items]);
  const markers = useMemo(() => {
    const inB = [...items]
      .sort((a, b) => a.order - b.order)
      .map((it) => ({ it, ...inSvg(it.place.lat, it.place.lng) }))
      .filter((m) => m.inBounds); // 7.5: never draw out-of-bounds points
    const spreadPts = spread(inB, widthPx);
    return inB.map((m, i) => ({ ...m, ...spreadPts[i] }));
  }, [items, widthPx]);
  const others = places
    .filter((p) => !courseIds.has(p.id))
    .map((p) => ({ p, ...inSvg(p.lat, p.lng) }))
    .filter((o) => o.inBounds);

  return (
    <div ref={boxRef} className="map__box" style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MAP_CONFIG.fallbackImage} alt="" className="absolute inset-0 h-full w-full" draggable={false} />

      {/* 7.6: straight dashed lines in visit order. Not a road route. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {markers.length > 1 && (
          <polyline
            points={markers.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={MAP_CONFIG.routeColor}
            strokeWidth={2.5}
            strokeDasharray="2 6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {others.map(({ p, x, y }) => (
        <span key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%`, zIndex: selectedPlaceId === p.id ? 2 : 1 }}>
          <button
            type="button"
            className={`map-dot ${selectedPlaceId === p.id ? "is-selected" : ""}`}
            onClick={() => onPick({ kind: "place", place: p })}
            aria-label={`${localizedPlaceName(p, locale)} (${t.map.notOnRoute})`}
            aria-pressed={selectedPlaceId === p.id}
          />
        </span>
      ))}

      {markers.map(({ it, ...pt }) => {
        const done = tripMode && it.status === "done";
        const current = tripMode && it.status === "current";
        const selected = selectedOrder === it.order;
        return (
          <span
            key={it.order}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pt.x}%`, top: `${pt.y}%`, zIndex: selected ? 5 : current ? 4 : 3 }}
          >
            <button
              type="button"
              className={`map-pin ${current ? "is-current" : ""} ${done ? "is-done" : ""} ${selected ? "is-selected" : ""}`}
              onClick={() => onPick({ kind: "stop", order: it.order })}
              aria-label={t.map.stopLabel(it.order, localizedPlaceName(it.place, locale))}
              aria-pressed={selected}
            >
              {it.order}
            </button>
          </span>
        );
      })}
    </div>
  );
}

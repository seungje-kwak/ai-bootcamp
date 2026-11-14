"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_CONFIG, toPercent } from "@/config/map";
import type { CourseItem, Place } from "@/lib/types";
import { CATEGORY_META } from "./CategoryIcon";
import type { MapSelect } from "./JejuMap";

const MARKER_PX = 28;
// The SVG shows the old town only, so positions are taken inside that range.
const inSvg = (lat: number, lng: number) => toPercent(lat, lng, MAP_CONFIG.fallbackBounds);

// 7.10: the fallback SVG cannot zoom, so push course markers apart (in px, for the current box width)
// until they stop overlapping.
function spread(points: { x: number; y: number }[], widthPx: number) {
  if (!widthPx || points.length < 2) return points;
  const heightPx = widthPx / MAP_CONFIG.aspectRatio;
  const px = points.map((p) => ({ x: (p.x / 100) * widthPx, y: (p.y / 100) * heightPx }));
  const min = MARKER_PX + 4;
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

// 7.8: simple SVG map, used when the Kakao map is not available. Box ratio == image ratio,
// so % positions line up at any width.
export function FallbackMap({
  items,
  places,
  tripMode,
  onSelect,
}: {
  items: CourseItem[];
  places: Place[];
  tripMode: boolean;
  onSelect: MapSelect;
}) {
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
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-2xl border border-line"
      style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MAP_CONFIG.fallbackImage} alt="" className="absolute inset-0 h-full w-full" draggable={false} />

      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {markers.length > 1 && (
          <polyline
            points={markers.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={MAP_CONFIG.routeColor}
            strokeWidth={2.5}
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {others.map(({ p, x, y }) => (
        <button
          key={p.id}
          onClick={() => onSelect({ place: p, stay: p.avg_stay_min })}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 border border-white text-[10px] leading-none opacity-70 hover:opacity-100"
          style={{ left: `${x}%`, top: `${y}%`, width: 18, height: 18, zIndex: 1 }}
          aria-label={p.name_en}
        >
          {CATEGORY_META[p.category].icon}
        </button>
      ))}

      {markers.map(({ it, ...pt }) => {
        const meta = CATEGORY_META[it.place.category];
        const done = tripMode && it.status === "done";
        const current = tripMode && it.status === "current";
        return (
          <button
            key={it.order}
            onClick={() => onSelect({ place: it.place, stay: it.stay_min, order: it.order })}
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 border-white shadow-md transition-transform ${
              current ? "scale-125 ring-4 ring-tangerine/50" : ""
            } ${done ? "opacity-40" : ""}`}
            style={{ left: `${pt.x}%`, top: `${pt.y}%`, width: MARKER_PX, height: MARKER_PX, background: meta.color, zIndex: current ? 4 : 3 }}
            aria-label={`${it.order}. ${it.place.name_en}`}
          >
            <span className="text-[13px] leading-none" aria-hidden>
              {meta.icon}
            </span>
            <span className="absolute -right-1.5 -top-1.5 min-w-[17px] h-[17px] rounded-full bg-ink text-white text-[10px] font-bold leading-[17px] text-center px-0.5">
              {it.order}
            </span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_CONFIG, toPercent } from "@/config/map";
import type { CourseItem, Place } from "@/lib/types";
import { CATEGORY_META } from "./CategoryIcon";
import { PhotoCredit, PlacePhoto } from "./PlacePhoto";

type Selected = { place: Place; stay: number; order?: number };

function pos(p: Place) {
  const r = toPercent(p.lat, p.lng);
  const off = MAP_CONFIG.offsets[p.id];
  return off ? { ...r, x: r.x + off.dx, y: r.y + off.dy } : r;
}

const MARKER_PX = 28;

// 7.10: old-town stops are a few hundred metres apart, so 28px markers pile up.
// Push course markers apart (in px, for the current box width) until they stop overlapping.
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

// 7장: illustrated map. Box ratio == image ratio, so % positions line up at any width.
export function JejuMap({
  items,
  places = [],
  tripMode = false,
}: {
  items: CourseItem[];
  places?: Place[];
  tripMode?: boolean;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);
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
      .map((it) => ({ it, ...pos(it.place) }))
      .filter((m) => m.inBounds); // 7.5: never draw out-of-bounds points
    const spreadPts = spread(inB, widthPx);
    return inB.map((m, i) => ({ ...m, ...spreadPts[i] }));
  }, [items, widthPx]);
  const others = places.filter((p) => !courseIds.has(p.id)).map((p) => ({ p, ...pos(p) })).filter((o) => o.inBounds);

  return (
    <div className="relative">
      <div
        ref={boxRef}
        className="relative w-full overflow-hidden rounded-2xl border border-line"
        style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MAP_CONFIG.image} alt="" className="absolute inset-0 h-full w-full" draggable={false} />

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
              stroke="#1f7a8c"
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
            onClick={() => setSelected({ place: p, stay: p.avg_stay_min })}
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
              onClick={() => setSelected({ place: it.place, stay: it.stay_min, order: it.order })}
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

      {selected && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Close" onClick={() => setSelected(null)} />
          <div className="absolute inset-x-2 bottom-2 z-40 overflow-hidden rounded-2xl bg-white shadow-xl border border-line">
            <div className="flex">
              <div className="w-28 shrink-0">
                <PlacePhoto place={selected.place} className="h-full min-h-[112px]" />
              </div>
              <div className="min-w-0 flex-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold leading-tight">
                    {selected.order ? `${selected.order}. ` : ""}
                    {selected.place.name_en}
                  </p>
                  <button onClick={() => setSelected(null)} className="text-muted text-lg leading-none" aria-label="Close">
                    ×
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted line-clamp-2">{selected.place.description_en}</p>
                <p className="mt-1 text-xs font-medium text-sea">Stay {selected.stay} min</p>
                <PhotoCredit place={selected.place} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

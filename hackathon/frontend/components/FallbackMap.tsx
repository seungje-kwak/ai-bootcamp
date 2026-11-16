"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { MAP_CONFIG, toPercent } from "@/config/map";
import { JEJU_LANDMARKS, ISLAND_MAP_BOUNDS } from "@/lib/landmarks";
import type { Category, CourseItem, Place } from "@/lib/types";
import type { MapSelect } from "./JejuMap";

const MARKER_PX = 28;

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
  activeCategories,
  onSelect,
}: {
  items: CourseItem[];
  places: Place[];
  tripMode: boolean;
  activeCategories: Set<Category>;
  onSelect: MapSelect;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; dx: number; dy: number; id: number } | null>(null);
  const { locale } = useLocale();
  const ui = {
    ko: {airport:"제주국제공항", caption:"제주 전역 개념도 · 정확한 길찾기는 카카오맵 이용", zoom:"지도 확대·축소", categories:["자연·등산","시장","카페","음식","문화·관광","사진","마사지(데이터 준비 중)"]},
    en: {airport:"Jeju Airport", caption:"Illustrated island overview · not road navigation", zoom:"Zoom map", categories:["Nature & hikes","Markets","Cafés","Food","Culture","Photos","Spa (not in data)"]},
    zh: {airport:"济州国际机场",caption:"示意地图 · 非实际道路路线",zoom:"地图缩放",categories:["自然·登山","市场","咖啡","美食","文化·观光","摄影","按摩（暂无数据）"]},
    ja: {airport:"済州国際空港",caption:"イメージ図 · 実際の道路経路ではありません",zoom:"地図の拡大・縮小",categories:["自然・登山","市場","カフェ","グルメ","文化・観光","写真","マッサージ（データ未対応）"]},
  }[locale];
  const icons: Record<string, string> = { nature:"⛰", market:"🛍", cafe:"☕", food:"🍜", culture:"🏛", photo:"📷"};
  const setScale = (z: number) => { const next = Math.max(1, Math.min(2.5, Math.round(z*10)/10)); setZoom(next); if (next === 1) setOffset({x:0,y:0}); };

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
      .map((it) => ({ it, ...toPercent(it.place.lat, it.place.lng, ISLAND_MAP_BOUNDS) }))
      .filter((m) => m.inBounds); // 7.5: never draw out-of-bounds points
    const spreadPts = spread(inB, widthPx);
    return inB.map((m, i) => ({ ...m, ...spreadPts[i] }));
  }, [items, widthPx]);
  const others = places
    .filter((p) => !courseIds.has(p.id) && activeCategories.has(p.category))
    .map((p) => ({ p, ...toPercent(p.lat, p.lng, ISLAND_MAP_BOUNDS) }))
    .filter((o) => o.inBounds);

  return (
    <div className="map-surface">
      <div ref={boxRef} className="map-surface__viewport" style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }}
        onPointerDown={(event) => { if (zoom <= 1 || (event.target as HTMLElement).closest("button")) return; drag.current = {x:event.clientX,y:event.clientY,dx:offset.x,dy:offset.y,id:event.pointerId}; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { const d=drag.current; if (!d || d.id !== event.pointerId) return; const limitX=widthPx*(zoom-1)/2; const limitY=widthPx/MAP_CONFIG.aspectRatio*(zoom-1)/2;setOffset({x:Math.max(-limitX,Math.min(limitX,d.dx+event.clientX-d.x)),y:Math.max(-limitY,Math.min(limitY,d.dy+event.clientY-d.y))}); }}
        onPointerUp={() => {drag.current=null;}} onPointerCancel={() => {drag.current=null;}}
      >
        <div className="map-surface__scene" style={{ transform:`translate(${offset.x}px,${offset.y}px) scale(${zoom})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/map/jeju-island-fallback.svg" alt="" className="absolute inset-0 h-full w-full" draggable={false}/>
          <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {markers.length > 1 && <polyline points={markers.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={MAP_CONFIG.routeColor} strokeWidth={2.8} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
          </svg>
          {JEJU_LANDMARKS.map(landmark => {
            const pt = toPercent(landmark.lat, landmark.lng, ISLAND_MAP_BOUNDS);
            return <div key={landmark.id} className={`map-landmark-fallback map-landmark-fallback--${landmark.id}`} style={{left:`${pt.x}%`,top:`${pt.y}%`}} title={landmark.names[locale]}>
              <span className="map-landmark-fallback__emoji" aria-hidden="true">{landmark.emoji}</span><small>{landmark.names[locale]}</small>
            </div>;
          })}
          {others.map(({p,x,y})=><button type="button" key={p.id} onClick={()=>onSelect({place:p,stay:p.avg_stay_min})}
            className="map-category-marker" style={{left:`${x}%`,top:`${y}%`}} title={p.name_ko} aria-label={p.name_ko}>{icons[p.category]}</button>)}
          {markers.map(({it,...pt})=>{const done=tripMode&&it.status==="done";const current=tripMode&&it.status==="current";return <button type="button" key={`${it.order}-${it.place_id}`}
            onClick={()=>onSelect({place:it.place,stay:it.stay_min,order:it.order})}
            className={`map-stop-marker ${current?"is-current":""} ${done?"is-done":""}`}
            style={{left:`${pt.x}%`,top:`${pt.y}%`}} aria-label={`${it.order}. ${it.place.name_ko}`}>
            <span>{it.order}</span></button>;})}
        </div>
        <div className="map-surface__zoom" role="group" aria-label={ui.zoom}>
          <button type="button" disabled={zoom>=2.5} onClick={()=>setScale(zoom+.25)} aria-label={`${ui.zoom} +`}>+</button>
          <span aria-live="polite">{Math.round(zoom*100)}%</span>
          <button type="button" disabled={zoom<=1} onClick={()=>setScale(zoom-.25)} aria-label={`${ui.zoom} -`}>−</button>
          <button type="button" onClick={()=>setScale(1)} aria-label="Reset map zoom">↺</button>
        </div>
      </div>
      <p className="map-surface__footnote">{ui.caption}</p>
    </div>
  );
}

"use client";

import { MAP_CONFIG } from "@/config/map";
import shapes from "@/data/area-shapes.json";
import type { Area } from "@/lib/types";

// Onboarding step 5: every area (eup / myeon, or a city's downtown) is one clickable shape of an
// illustrated map of Jeju: mint sea, cream land, dark green borders, the picked area in coral.
// Drawn in one SVG (Web Mercator), so it needs no map key and no network.
// Shapes and the point of each name come from data/area-shapes.json (scripts/build-area-shapes.mjs).

type Shape = { label: number[]; polygons: number[][][] };
const SHAPES = shapes as Record<string, Shape>;

const VIEW = MAP_CONFIG.areaMap.view;
const WORLD = 256 * 2 ** 11; // SVG units: Web Mercator pixels at zoom 11
const mercX = (lng: number) => ((lng + 180) / 360) * WORLD;
const mercY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * WORLD;
};
const X0 = mercX(VIEW.lngMin), Y0 = mercY(VIEW.latMax);
const W = mercX(VIEW.lngMax) - X0, H = mercY(VIEW.latMin) - Y0;

const pathOf = (s: Shape) =>
  s.polygons.map((ring) => "M" + ring.map(([lng, lat]) => `${(mercX(lng) - X0).toFixed(1)} ${(mercY(lat) - Y0).toFixed(1)}`).join("L") + "Z").join("");
const PATHS: Record<string, string> = Object.fromEntries(Object.entries(SHAPES).map(([id, s]) => [id, pathOf(s)]));

// The Chuja Islands are about 50 km north of the main island: a chip in the corner instead.
const INSET_ID = "chuja";
// Udo is smaller than its name: the name goes just above the island (percent of the map), not on it.
const LABEL_SHIFT: Record<string, [number, number]> = { udo: [0, -6.5] };

type Props = {
  areas: Area[];
  selectedId?: string;
  onSelect: (id: string) => void;
  nameOf: (a: Area) => string;
  label: string;
  comingSoon: string;
  title: string;
  legend: string;
};

export function AreaMap({ areas, selectedId, onSelect, nameOf, label, comingSoon, title, legend }: Props) {
  const onMap = areas.filter((a) => a.id !== INSET_ID && PATHS[a.id]);
  // The picked shape is drawn last, so that its thicker border is not covered by a neighbour.
  const ordered = [...onMap].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
  const inset = areas.find((a) => a.id === INSET_ID);
  const fullName = (a: Area) => (a.selectable ? nameOf(a) : `${nameOf(a)} · ${comingSoon}`);

  return (
    <div className="v9-area-map" role="group" aria-label={label} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W.toFixed(1)} ${H.toFixed(1)}`} focusable="false">
        <defs>
          {/* cream sky at the top, fading into the mint sea */}
          <linearGradient id="am-sea" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#f8f4e9" />
            <stop offset="0.17" stopColor="#f3f1e4" />
            <stop offset="0.24" stopColor="#c4e6d9" />
            <stop offset="1" stopColor="#aedccd" />
          </linearGradient>
          <pattern id="am-waves" width="330" height="150" patternUnits="userSpaceOnUse">
            <path d="M20 40q40-16 80 0t80 0M190 115q35-14 70 0t70 0" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
          </pattern>
          <linearGradient id="am-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.2" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.32" stopColor="#fff" />
          </linearGradient>
          <mask id="am-wave-mask">
            <rect width={W} height={H} fill="url(#am-fade)" />
          </mask>
          <filter id="am-shadow" x="-5%" y="-5%" width="110%" height="115%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#1d6b5c" floodOpacity="0.22" />
          </filter>
        </defs>

        <g aria-hidden="true" pointerEvents="none">
          <rect width={W} height={H} fill="url(#am-sea)" />
          <rect width={W} height={H} fill="url(#am-waves)" mask="url(#am-wave-mask)" />
          {/* Hallasan on the horizon, with two thin clouds */}
          <g transform={`translate(${W * 0.8} ${H * 0.2})`}>
            <path d="M-150 0C-95-6-60-22-28-52C-12-64 14-64 30-52C62-22 100-6 160 0Z" fill="#8fbfa9" />
            <path d="M-150 0C-95-6-60-22-28-52C-22-57-14-60-6-61C-30-30-60-10-110 0Z" fill="#7fb39c" />
            <g stroke="#9cc8b5" strokeWidth="4" strokeLinecap="round">
              <path d="M-170-48h70M100-58h60M130-40h40" />
            </g>
          </g>
          {/* soft shadow of the island on the sea */}
          <g filter="url(#am-shadow)" fill="#fbf6ea">
            {onMap.map((a) => (
              <path key={a.id} d={PATHS[a.id]} />
            ))}
          </g>
        </g>

        {ordered.map((a) => {
          const picked = selectedId === a.id;
          const pick = () => a.selectable && onSelect(a.id);
          return (
            <path
              key={a.id}
              d={PATHS[a.id]}
              className={`v9-area-shape ${picked ? "is-selected" : ""}`}
              role="button"
              tabIndex={a.selectable ? 0 : -1}
              aria-pressed={picked}
              aria-disabled={!a.selectable}
              aria-label={fullName(a)}
              onClick={pick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick();
                }
              }}
            >
              <title>{fullName(a)}</title>
            </path>
          );
        })}
      </svg>

      <div className="v9-area-title" aria-hidden="true">
        <strong>{title}</strong>
      </div>
      {onMap.map((a) => {
        const [lng, lat] = SHAPES[a.id].label;
        const [dx, dy] = LABEL_SHIFT[a.id] ?? [0, 0];
        return (
          <span
            key={a.id}
            aria-hidden="true"
            className={`v9-area-name ${selectedId === a.id ? "is-selected" : ""}`}
            data-disabled={!a.selectable}
            style={{ left: `${((mercX(lng) - X0) / W) * 100 + dx}%`, top: `${((mercY(lat) - Y0) / H) * 100 + dy}%` }}
          >
            {nameOf(a)}
          </span>
        );
      })}
      {inset && (
        <button
          type="button"
          className={`v9-area-inset ${selectedId === inset.id ? "is-selected" : ""}`}
          aria-pressed={selectedId === inset.id}
          disabled={!inset.selectable}
          title={inset.selectable ? undefined : comingSoon}
          onClick={() => onSelect(inset.id)}
        >
          <span aria-hidden="true">↑ 50 km · </span>
          {fullName(inset)}
        </button>
      )}
      <span className="v9-area-legend" aria-hidden="true">
        <i />
        {legend}
      </span>
    </div>
  );
}

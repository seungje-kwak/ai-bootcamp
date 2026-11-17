// Outline of each of the 14 areas, for the area map of the onboarding (components/AreaMap.tsx).
//
// Reads backend/app/data/jeju_admin.geojson (43 eup / myeon / dong boundaries), joins the boundaries
// of one area into one shape (every dong of a city is that city's downtown area) and writes
// data/area-shapes.json:  { area_id: { label: [lng, lat], polygons: [[[lng, lat], ...], ...] } }
// A polygon is its outer ring only. "label" is where the area's name is drawn: the point of the
// largest polygon that is farthest from its border, so that the name stays inside the area.
//
// Run from frontend/:  node scripts/build-area-shapes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import polygonClipping from "polygon-clipping";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../../backend/app/data/jeju_admin.geojson");
const OUT = resolve(here, "../data/area-shapes.json");
const MIN_ISLET = 2e-6; // square degrees, about 2 ha: smaller islets are left out

// Same rule as backend/app/areas.py: the eup / myeon name first, because "제주시" is in those names too.
const EUP_MYEON = {
  한림읍: "hallim", 애월읍: "aewol", 구좌읍: "gujwa", 조천읍: "jocheon", 한경면: "hangyeong", 추자면: "chuja", 우도면: "udo",
  대정읍: "daejeong", 남원읍: "namwon", 성산읍: "seongsan", 안덕면: "andeok", 표선면: "pyoseon",
};
function areaOf(name) {
  for (const [key, id] of Object.entries(EUP_MYEON)) if (name.includes(key)) return id;
  if (name.includes("제주시")) return "jeju-city";
  if (name.includes("서귀포시")) return "seogwipo-city";
  throw new Error(`boundary ${name} is not in any area`);
}
function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a) / 2;
}
// A name is wider than it is tall, so room to the left and right counts for less than room above
// and below: distances along the longitude are divided by LABEL_ASPECT before they are compared.
const LABEL_ASPECT = 2.2;
const LNG_SCALE = Math.cos((33.4 * Math.PI) / 180) / LABEL_ASPECT;
const GRID = 0.002; // degrees between two candidate points
function inside(ring, x, y) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
function borderDistance(ring, x, y) {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - x) * LNG_SCALE, ay = ring[i][1] - y;
    const bx = (ring[i + 1][0] - x) * LNG_SCALE, by = ring[i + 1][1] - y;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
function labelPoint(ring) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  let best = null, bestD = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += GRID)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += GRID) {
      if (!inside(ring, x, y)) continue;
      const d = borderDistance(ring, x, y);
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
  return best ?? ring[0];
}
const round = (n) => Math.round(n * 1e4) / 1e4;

const byArea = {};
for (const f of JSON.parse(readFileSync(SRC, "utf8")).features) {
  const g = f.geometry;
  (byArea[areaOf(f.properties.adm_nm)] ??= []).push(g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]);
}
const out = {};
for (const id of Object.keys(byArea).sort()) {
  const joined = polygonClipping.union(...byArea[id]);
  const rings = joined.map((poly) => poly[0]).sort((a, b) => ringArea(b) - ringArea(a));
  const kept = rings.filter((r, i) => i === 0 || ringArea(r) >= MIN_ISLET);
  out[id] = { label: labelPoint(kept[0]).map(round), polygons: kept.map((r) => r.map(([x, y]) => [round(x), round(y)])) };
  console.log(`${id}: ${kept.length} polygon(s), ${kept.reduce((n, r) => n + r.length, 0)} points`);
}
writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`wrote ${OUT}`);

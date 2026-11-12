// 7.2 — the ONLY place for map image path and bounds. Change `image` when the illustration is ready.
// If you change `bounds`, change `aspectRatio` too (7.9: width/height ≈ (lng span × 0.837) / lat span).
export const MAP_CONFIG = {
  image: "/map/jeju-city-fallback.svg",
  bounds: { lngMin: 126.44, lngMax: 126.56, latMin: 33.46, latMax: 33.53 },
  aspectRatio: 10 / 7,
  // 7.10 (P1): manual nudges for overlapping markers, in % of the map box.
  offsets: {} as Record<number, { dx: number; dy: number }>,
};

export type Bounds = typeof MAP_CONFIG.bounds;

// 7.3
export function toPercent(lat: number, lng: number, b: Bounds = MAP_CONFIG.bounds) {
  const x = ((lng - b.lngMin) / (b.lngMax - b.lngMin)) * 100;
  const y = ((b.latMax - lat) / (b.latMax - b.latMin)) * 100;
  const inBounds = x >= 0 && x <= 100 && y >= 0 && y <= 100;
  return { x, y, inBounds };
}

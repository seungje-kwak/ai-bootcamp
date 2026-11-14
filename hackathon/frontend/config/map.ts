// 7.2 — the ONLY place for map settings. Components import MAP_CONFIG and never hard-code these numbers.
export const MAP_CONFIG = {
  // Kakao JavaScript key (7.9). Empty → the fallback SVG map (7.8) is drawn instead.
  kakaoKey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "",
  // First view when a course has no stops and no area center is given (Jeju City old town).
  // Kakao level: 1 is the closest.
  center: { lat: 33.5, lng: 126.52 },
  level: 7,
  // Zoom used when a course has a single stop.
  singleStopLevel: 5,
  // Padding (px) kept around the course when the Kakao map fits it.
  fitPaddingPx: 40,
  // Range of the place data: all of Jeju (main island, Udo, Chuja Islands). Places outside are not
  // in the DB and are never drawn (7.10). Must be the same as BOUNDS in backend/scripts/build_places.py.
  bounds: { lngMin: 126.1, lngMax: 127.0, latMin: 33.1, latMax: 34.0 },
  // Map box width / height. Same as the fallback SVG (7.8: width/height ≈ (lng span × 0.837) / lat span).
  aspectRatio: 10 / 7,
  fallbackImage: "/map/jeju-city-fallback.svg",
  // The fallback SVG only shows the Jeju City old town. A course with a stop outside this range
  // gets no fallback map, only the list of stops.
  fallbackBounds: { lngMin: 126.44, lngMax: 126.56, latMin: 33.46, latMax: 33.53 },
  // Course line (7.6), shared by both maps.
  routeColor: "#1f7a8c",
};

export type Bounds = typeof MAP_CONFIG.bounds;
export type LatLng = { lat: number; lng: number };

// 7.3
export function toPercent(lat: number, lng: number, b: Bounds = MAP_CONFIG.bounds) {
  const x = ((lng - b.lngMin) / (b.lngMax - b.lngMin)) * 100;
  const y = ((b.latMax - lat) / (b.latMax - b.latMin)) * 100;
  const inBounds = x >= 0 && x <= 100 && y >= 0 && y <= 100;
  return { x, y, inBounds };
}

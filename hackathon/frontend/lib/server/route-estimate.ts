// Server-only: road distance, drive time and taxi fare for one taxi leg, from the
// Kakao Mobility Directions API. The REST key stays on the server.
//   KAKAO_REST_API_KEY   = Kakao Developers REST API key (not the JavaScript map key)
//   KAKAO_DIRECTIONS_URL = optional endpoint override (proxy, or a local stub in tests)
// Without the key /api/route-estimate answers 501 and the UI shows no fare at all.
// Commercial use of this API needs a partnership agreement with Kakao Mobility.
export type LatLng = { lat: number; lng: number };

export type RouteEstimate = {
  source: "kakao-mobility";
  distance_m: number;
  duration_s: number;
  taxi_fare_krw: number;
  toll_krw: number;
  /** The road line, [lat, lng] points from start to end. Only when it was asked for. */
  path?: [number, number][];
};

const DEFAULT_URL = "https://apis-navi.kakaomobility.com/v1/directions";
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 10 * 60 * 1000; // fares move with traffic; keep answers briefly
const cache = new Map<string, { at: number; value: RouteEstimate }>();
const MAX_PATH_POINTS = 600; // enough for a smooth line across the island; longer lines are thinned

type KakaoRoad = { vertexes?: number[] };
/** Kakao gives each road as x1, y1, x2, y2, ... (longitude, latitude). */
function pathOf(sections: { roads?: KakaoRoad[] }[] | undefined): [number, number][] {
  const all: [number, number][] = [];
  for (const section of sections ?? [])
    for (const road of section.roads ?? []) {
      const v = road.vertexes ?? [];
      for (let i = 0; i + 1 < v.length; i += 2) all.push([Math.round(v[i + 1] * 1e5) / 1e5, Math.round(v[i] * 1e5) / 1e5]);
    }
  if (all.length <= MAX_PATH_POINTS) return all;
  const step = Math.ceil(all.length / MAX_PATH_POINTS);
  const thin = all.filter((_, i) => i % step === 0);
  thin.push(all[all.length - 1]);
  return thin;
}

export function routeApiKey(): string | null {
  return (process.env.KAKAO_REST_API_KEY ?? "").trim() || null;
}

export async function estimateRoute(key: string, from: LatLng, to: LatLng, withPath = false): Promise<RouteEstimate> {
  const cacheKey = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(5)).join(",") + (withPath ? "+path" : "");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const url = new URL((process.env.KAKAO_DIRECTIONS_URL ?? "").trim() || DEFAULT_URL);
  url.searchParams.set("origin", `${from.lng},${from.lat}`); // Kakao expects x,y = longitude,latitude
  url.searchParams.set("destination", `${to.lng},${to.lat}`);
  url.searchParams.set("summary", withPath ? "false" : "true"); // the full answer has the road line

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Kakao Mobility responded ${res.status}`);
    const data = (await res.json()) as {
      routes?: { result_code?: number; summary?: { distance?: number; duration?: number; fare?: { taxi?: number; toll?: number } }; sections?: { roads?: KakaoRoad[] }[] }[];
    };
    const route = data.routes?.[0];
    const s = route?.summary;
    if (route?.result_code !== 0 || typeof s?.distance !== "number" || typeof s.duration !== "number" || typeof s.fare?.taxi !== "number") {
      throw new Error("no usable route in the response");
    }
    const value: RouteEstimate = {
      source: "kakao-mobility",
      distance_m: s.distance,
      duration_s: s.duration,
      taxi_fare_krw: s.fare.taxi,
      toll_krw: typeof s.fare.toll === "number" ? s.fare.toll : 0,
    };
    if (withPath) {
      value.path = pathOf(route.sections);
      if (value.path.length < 2) throw new Error("no road line in the response");
    }
    cache.set(cacheKey, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

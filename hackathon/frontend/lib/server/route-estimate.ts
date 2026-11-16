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
};

const DEFAULT_URL = "https://apis-navi.kakaomobility.com/v1/directions";
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 10 * 60 * 1000; // fares move with traffic; keep answers briefly
const cache = new Map<string, { at: number; value: RouteEstimate }>();

export function routeApiKey(): string | null {
  return (process.env.KAKAO_REST_API_KEY ?? "").trim() || null;
}

export async function estimateRoute(key: string, from: LatLng, to: LatLng): Promise<RouteEstimate> {
  const cacheKey = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(5)).join(",");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const url = new URL((process.env.KAKAO_DIRECTIONS_URL ?? "").trim() || DEFAULT_URL);
  url.searchParams.set("origin", `${from.lng},${from.lat}`); // Kakao expects x,y = longitude,latitude
  url.searchParams.set("destination", `${to.lng},${to.lat}`);
  url.searchParams.set("summary", "true");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Kakao Mobility responded ${res.status}`);
    const data = (await res.json()) as {
      routes?: { result_code?: number; summary?: { distance?: number; duration?: number; fare?: { taxi?: number; toll?: number } } }[];
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
    cache.set(cacheKey, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

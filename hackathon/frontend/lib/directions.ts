// Directions to a place. On the Kakao map of the page the road route is drawn in the app, from where
// the traveler is (car route only: that is what the Kakao Mobility API gives). Where there is no such
// map, or for walking and transit, the traveler is handed to Kakao Map.
import type { Place } from "./types";

type Target = Pick<Place, "name_ko" | "lat" | "lng">;

// Kakao's link format is /link/to/<name>,<lat>,<lng>; a comma or slash inside the name would break it.
const safeName = (name: string) => encodeURIComponent(name.replace(/[,/]/g, " ").trim());

/** Opens Kakao Map with this place as the destination; the traveler picks walk, transit or car there. */
export function kakaoDirectionsUrl(place: Target): string {
  return `https://map.kakao.com/link/to/${safeName(place.name_ko)},${place.lat},${place.lng}`;
}

/** Opens Kakao Map centred on this place. */
export function kakaoPlaceUrl(place: Target): string {
  return `https://map.kakao.com/link/map/${safeName(place.name_ko)},${place.lat},${place.lng}`;
}

export type LatLng = { lat: number; lng: number };
/** `fallbackFrom`: where the route starts when the traveler's own position cannot be used (else: the airport). */
export type DirectionsRequest = { to: Place; fallbackFrom?: LatLng };
export const DIRECTIONS_EVENT = "mypace:directions";

// Same box as app/api/route-estimate: the route service only answers for points on Jeju Island.
export const onJeju = (p: LatLng) => p.lat >= 33.1 && p.lat <= 33.6 && p.lng >= 126.1 && p.lng <= 127.0;

/** Asks the page's map to draw the route. With no map to do it, Kakao Map opens in a new tab. */
export function requestDirections(request: DirectionsRequest) {
  const event = new CustomEvent<DirectionsRequest>(DIRECTIONS_EVENT, { detail: request, cancelable: true });
  const unhandled = window.dispatchEvent(event); // a map that takes the request calls preventDefault()
  if (unhandled) window.open(kakaoDirectionsUrl(request.to), "_blank", "noopener,noreferrer");
}

export type RoutePath = { distanceM: number; durationMin: number; taxiFareKrw: number; path: [number, number][] };

/** The road route between two points on Jeju, from /api/route-estimate. Null when there is none. */
export async function fetchRoutePath(from: LatLng, to: LatLng): Promise<RoutePath | null> {
  try {
    const r = await fetch(`/api/route-estimate?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&path=1`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    if (typeof j?.distance_m !== "number" || typeof j?.duration_s !== "number" || !Array.isArray(j?.path) || j.path.length < 2) return null;
    return { distanceM: j.distance_m, durationMin: Math.max(1, Math.round(j.duration_s / 60)), taxiFareKrw: Number(j.taxi_fare_krw) || 0, path: j.path };
  } catch {
    return null;
  }
}

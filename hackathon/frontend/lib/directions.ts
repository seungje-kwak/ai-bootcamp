// Links out to a real map app for turn-by-turn directions. The in-app map only draws
// straight lines in visit order, so actual routing is always handed to Kakao Map.
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

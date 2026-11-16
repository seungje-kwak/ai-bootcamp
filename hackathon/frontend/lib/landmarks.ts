import type { Locale } from "@/lib/i18n";

/** Stable reference points, not API-provided attractions. Coordinates are approximate landmark locations. */
export type JejuLandmark = { id: string; lat: number; lng: number; emoji: string; names: Record<Locale, string> };
export const JEJU_LANDMARKS: JejuLandmark[] = [
  { id: "airport", lat: 33.5104, lng: 126.4929, emoji: "✈️", names: { ko: "제주국제공항", en: "Jeju Airport", zh: "济州机场", ja: "済州空港" } },
  { id: "halla", lat: 33.36167, lng: 126.52917, emoji: "⛰️", names: { ko: "한라산", en: "Hallasan", zh: "汉拿山", ja: "漢拏山" } },
  { id: "seongsan", lat: 33.4582, lng: 126.9417, emoji: "🌅", names: { ko: "성산일출봉", en: "Seongsan Ilchulbong", zh: "城山日出峰", ja: "城山日出峰" } },
  { id: "hyeopjae", lat: 33.3939, lng: 126.2394, emoji: "🏖️", names: { ko: "협재해수욕장", en: "Hyeopjae Beach", zh: "挟才海水浴场", ja: "挟才海水浴場" } },
];

export const ISLAND_MAP_BOUNDS = {
  lngMin: 126.09, lngMax: 127.02, latMin: 33.15, latMax: 33.58,
};

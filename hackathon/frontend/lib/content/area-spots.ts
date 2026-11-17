import type { Locale } from "@/lib/locale";

// The ten sights foreign visitors go to most (2024 visitor counts), drawn as small icons on the
// onboarding area map so that a traveler who does not know the area names can find their bearings.
// `areaId`: the area the sight is in (tapping the icon picks it). Hallasan sits on the border of several.
// `shift`: percent of the map, for sights that would otherwise sit on top of each other.
export type AreaSpot = {
  id: string;
  icon: string;
  lat: number;
  lng: number;
  areaId?: string;
  shift?: [number, number];
  name: Record<Locale, string>;
};

export const AREA_SPOTS: AreaSpot[] = [
  { id: "seongsan-ilchulbong", icon: "🌅", lat: 33.4581, lng: 126.9426, areaId: "seongsan", name: { en: "Seongsan Ilchulbong", ko: "성산일출봉", zh: "城山日出峰", ja: "城山日出峰" } },
  { id: "jusangjeolli", icon: "🪨", lat: 33.2378, lng: 126.425, areaId: "seogwipo-city", shift: [0.6, 1.6], name: { en: "Jusangjeolli Cliff", ko: "중문대포해안 주상절리대", zh: "中文大浦海岸柱状节理带", ja: "中文大浦海岸柱状節理帯" } },
  { id: "hallasan", icon: "🏔️", lat: 33.3617, lng: 126.5292, name: { en: "Hallasan National Park", ko: "한라산국립공원", zh: "汉拿山国立公园", ja: "漢拏山国立公園" } },
  { id: "jeongbang", icon: "🌊", lat: 33.2448, lng: 126.5718, areaId: "seogwipo-city", shift: [1.8, 0.8], name: { en: "Jeongbang Waterfall", ko: "정방폭포", zh: "正房瀑布", ja: "正房瀑布" } },
  { id: "cheonjeyeon", icon: "💧", lat: 33.2527, lng: 126.418, areaId: "seogwipo-city", shift: [-0.4, -2.2], name: { en: "Cheonjeyeon Waterfall", ko: "천제연폭포", zh: "天帝渊瀑布", ja: "天帝淵瀑布" } },
  { id: "mokgwana", icon: "🏯", lat: 33.5134, lng: 126.5219, areaId: "jeju-city", name: { en: "Jeju Mokgwana", ko: "제주목관아", zh: "济州牧官衙", ja: "済州牧官衙" } },
  { id: "cheonjiyeon", icon: "🏞️", lat: 33.247, lng: 126.5545, areaId: "seogwipo-city", shift: [-1.6, 0.8], name: { en: "Cheonjiyeon Waterfall", ko: "천지연폭포", zh: "天地渊瀑布", ja: "天地淵瀑布" } },
  { id: "haenyeo-museum", icon: "🤿", lat: 33.5239, lng: 126.8636, areaId: "gujwa", shift: [2.4, -1.6], name: { en: "Haenyeo Museum", ko: "해녀박물관", zh: "海女博物馆", ja: "海女博物館" } },
  { id: "camellia-hill", icon: "🌺", lat: 33.2897, lng: 126.37, areaId: "andeok", name: { en: "Camellia Hill", ko: "카멜리아힐", zh: "山茶花之丘", ja: "カメリアヒル" } },
  { id: "stone-park", icon: "🗿", lat: 33.4497, lng: 126.66, areaId: "jocheon", name: { en: "Jeju Stone Park", ko: "제주돌문화공원", zh: "济州石文化公园", ja: "済州石文化公園" } },
];

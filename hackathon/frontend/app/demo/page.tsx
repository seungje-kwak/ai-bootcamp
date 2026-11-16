"use client";

import Link from "next/link";
import { JejuMap } from "@/components/JejuMap";
import { StopCard } from "@/components/StopCard";
import { useLocale } from "@/lib/i18n";
import type { CourseItem, Place } from "@/lib/types";

// UI testing only. The real course pages continue to use the team's backend API.
// Coordinates are based on the existing local sample data. Other fields are explicitly illustrative.
const SAMPLE: Place[] = [
  {
    id: 3, source_poi_id: null, name_en: "Samseonghyeol Shrine", name_ko: "삼성혈", category: "culture",
    description_en: "A cultural heritage site connected with Jeju's founding mythology. Sample description, not live visitor information.",
    lat: 33.505241, lng: 126.528438, address_ko: "제주특별자치도 제주시 삼성로 22", image_url: null, image_source: null,
    avg_stay_min: 40, opening_hours: null, closed_days: [], price_level: null, last_verified_at: null, source_date: null,
    accessibility: { walking_level: 1, terrain: "flat", has_stairs: null, wheelchair_ok: null, indoor: false, has_seating: null, restroom: null, nearest_public_restroom_m: null, fatigue_score: 1 },
    food_options: null, place_type: null, area_id: "jeju-city", open_time: null, close_time: null,
  },
  {
    id: 6, source_poi_id: null, name_en: "Dongmun Traditional Market", name_ko: "동문재래시장", category: "market",
    description_en: "A local market with food stalls and Jeju specialties. Sample description, not live visitor information.",
    lat: 33.512115, lng: 126.526638, address_ko: "제주특별자치도 제주시 관덕로14길 20", image_url: null, image_source: null,
    avg_stay_min: 75, opening_hours: null, closed_days: [], price_level: null, last_verified_at: null, source_date: null,
    accessibility: { walking_level: 2, terrain: "flat", has_stairs: null, wheelchair_ok: null, indoor: false, has_seating: null, restroom: null, nearest_public_restroom_m: null, fatigue_score: 2 },
    food_options: null, place_type: null, area_id: "jeju-city", open_time: null, close_time: null,
  },
  {
    id: 12, source_poi_id: null, name_en: "Hamdeok Beach", name_ko: "함덕해수욕장", category: "photo",
    description_en: "A popular shoreline. This is sample UI data; confirm access and local conditions before visiting.",
    lat: 33.543214, lng: 126.669512, address_ko: "정확한 도로명 주소 확인 필요", image_url: null, image_source: null,
    avg_stay_min: 90, opening_hours: null, closed_days: [], price_level: null, last_verified_at: null, source_date: null,
    accessibility: { walking_level: 2, terrain: "flat", has_stairs: null, wheelchair_ok: null, indoor: false, has_seating: null, restroom: null, nearest_public_restroom_m: null, fatigue_score: 2 },
    food_options: null, place_type: null, area_id: "jocheon", open_time: null, close_time: null,
  },
];
const ITEMS: CourseItem[] = SAMPLE.slice(0, 2).map((place, index) => ({
  order: index + 1,
  place_id: place.id,
  start_time: index === 0 ? "11:00" : "12:05",
  stay_min: place.avg_stay_min,
  move_method: index === 0 ? null : "walk",
  move_min: index === 0 ? null : 15,
  reason_en: index === 0 ? "A peaceful introduction to Jeju's local heritage." : "Experience daily life, food and the energy of Jeju's market.",
  is_rest_stop: false,
  status: index === 0 ? "current" : "upcoming",
  place,
  phrase_cards: [],
}));

export default function DemoPage() {
  const {locale} = useLocale();
  const words = {
    ko: {eyebrow:"MY PACE · JEJU",title:"카카오맵 실제 지도 테스트",subtitle:"맥북 frontend/.env.local의 카카오 JavaScript 키로 지도를 불러옵니다. 지도·장소·택시 팝업을 실제로 눌러보세요.",warning:"체험용 장소 정보와 사진입니다. 실제 방문 전 운영 및 편의시설 정보를 확인하세요.",map:"카카오 지도",places:"체험 장소",back:"홈으로"},
    en: {eyebrow:"MY PACE · JEJU",title:"Live Kakao Map test",subtitle:"Uses the JavaScript map key from your frontend/.env.local. Try map controls, place details and the taxi card.",warning:"Demo place content and sample photos. Verify real visitor information before travel.",map:"Kakao map",places:"Demo stops",back:"Home"},
    zh: {eyebrow:"MY PACE · JEJU",title:"Kakao地图测试",subtitle:"使用frontend/.env.local里的JavaScript地图密钥。可测试地图和出租车指引。",warning:"地点资料和照片为演示，请核实实际情况。",map:"Kakao地图",places:"示例地点",back:"首页"},
    ja: {eyebrow:"MY PACE · JEJU",title:"Kakaoマップの動作テスト",subtitle:"frontend/.env.localのJavaScriptキーを使用。地図とタクシー案内を操作できます。",warning:"地点情報と画像はデモ用です。訪問前に最新情報をご確認ください。",map:"Kakaoマップ",places:"サンプルスポット",back:"ホーム"},
  }[locale];
  return (
    <main className="course-page mypace-demo" id="course-top">
      <header className="course-head">
        <div className="course-head__top"><Link href="/" className="brand-small">✳ mypace<span>.</span></Link><Link className="text-sm font-bold text-sea" href="/">← {words.back}</Link></div>
        <p className="course-head__eyebrow">{words.eyebrow}</p>
        <h1>{words.title}</h1>
        <p className="course-head__sub">{words.subtitle}</p>
        <p className="demo-only-notice">✳ {words.warning}</p>
      </header>
      <div className="course-grid">
        <section className="course-map-panel" aria-label={words.map}>
          <h2 className="course-section-title">{words.map}</h2>
          <JejuMap items={ITEMS} places={SAMPLE} />
          <p className="text-xs text-muted mt-3">{locale==="ko"?"지도 번호와 랜드마크는 실제 위도·경도에 고정돼요. 직선 연결은 도로 경로가 아니에요.":"Pins follow their geographic positions. Straight lines are not road routes."}</p>
        </section>
        <section className="course-timeline" aria-label={words.places}>
          <h2 className="course-section-title">{words.places}</h2>
          {ITEMS.map(item => <StopCard key={item.order} item={item} tier="premium" />)}
        </section>
      </div>
    </main>
  );
}

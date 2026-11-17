"use client";

import { useLocale } from "@/lib/i18n";
import { localizedDescription } from "@/lib/localized-place";
import type { Place } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { PlaceDescription } from "./LocalizedText";

type Copy = {
  about: string;
  visit: string;
  walk: string;
  restroom: string;
  seating: string;
  parking: string;
  easy: string;
  medium: string;
  active: string;
  unknown: string;
  yes: string;
  no: string;
  english: string;
  note: string;
  terrainFlat: string;
  terrainSlope: string;
  terrainSteep: string;
  stairs: string;
  wheelchair: string; terrain: string; indoor: string; duration: string; minutes: string; noVerified: string;
};

const COPY: Record<Locale, Copy> = {
  ko: { about: "장소 소개", visit: "방문 전 알아두기", walk: "걷기", restroom: "화장실", seating: "앉을 곳", parking: "주차", easy: "적음", medium: "보통", active: "많음", unknown: "확인 필요", yes: "있음", no: "없음", english: "영어 원문 보기", note: "장소 정보는 현장 사정에 따라 달라질 수 있어요. 방문 전 다시 확인해 주세요.", terrainFlat: "평지", terrainSlope: "경사", terrainSteep: "급경사", stairs: "계단", wheelchair:"휠체어 접근", terrain:"지형", indoor:"실내", duration:"권장 체류", minutes:"분", noVerified:"확인된 방문 정보가 아직 없어요." },
  en: { about: "About this place", visit: "Good to know", walk: "Walking", restroom: "Restroom", seating: "Seating", parking: "Parking", easy: "Light", medium: "Moderate", active: "More walking", unknown: "Check ahead", yes: "Available", no: "Not listed", english: "Read original English", note: "Facilities and access may change. Please verify before visiting.", terrainFlat: "Flat", terrainSlope: "Sloped", terrainSteep: "Steep", stairs: "Stairs", wheelchair:"Wheelchair", terrain:"Terrain", indoor:"Indoor", duration:"Suggested stay", minutes:"min", noVerified:"No verified visitor details yet." },
  zh: { about: "地点介绍", visit: "出行前须知", walk: "步行量", restroom: "洗手间", seating: "座位", parking: "停车", easy: "较少", medium: "适中", active: "较多", unknown: "需确认", yes: "有", no: "无", english: "查看英文原文", note: "设施和无障碍条件可能发生变化，请在出行前再次核实。", terrainFlat: "平坦", terrainSlope: "坡道", terrainSteep: "陡坡", stairs: "台阶", wheelchair:"轮椅通行", terrain:"地形", indoor:"室内", duration:"建议停留", minutes:"分钟", noVerified:"暂无已确认的访问信息。" },
  ja: { about: "スポット紹介", visit: "訪問前のチェック", walk: "歩く量", restroom: "トイレ", seating: "座席", parking: "駐車場", easy: "少なめ", medium: "普通", active: "多め", unknown: "要確認", yes: "あり", no: "なし", english: "英語の原文を見る", note: "設備やバリアフリー情報は変わる場合があります。訪問前にご確認ください。", terrainFlat: "平坦", terrainSlope: "坂道", terrainSteep: "急坂", stairs: "階段", wheelchair:"車椅子", terrain:"地形", indoor:"屋内", duration:"滞在目安", minutes:"分", noVerified:"確認済みの施設情報はまだありません。" },
};

// Short human-written overviews for the three known sample places only.
// Never use these as translations of arbitrary AI-generated descriptions.
const KNOWN_INTROS: Record<Locale, [string, string, string]> = {
  ko: ["제주의 신화와 역사를 만날 수 있는 유적지예요. 제주 고유의 이야기를 차분하게 느끼기 좋은 곳이에요.", "제주의 전통시장 분위기와 지역 먹거리를 경험할 수 있는 곳이에요.", "제주 시내에서 식사할 수 있는 식당으로 추천된 장소예요. 메뉴와 영업정보는 방문 전에 확인해 주세요."],
  en: ["A cultural heritage site connected to Jeju's myths and history.", "A traditional market for experiencing everyday Jeju life and local food.", "A restaurant stop in Jeju City; check current menus and opening hours ahead."],
  zh: ["与济州神话和历史相关的文化遗址，适合安静地了解当地故事。", "可以感受济州传统市场氛围和当地饮食文化的地方。", "位于济州市的餐厅。请提前确认菜单和营业时间。"],
  ja: ["済州の神話や歴史にゆかりのある文化遺跡。落ち着いて島の物語に触れられます。", "済州の伝統市場の雰囲気と地元グルメを楽しめる場所です。", "済州市の飲食店です。メニューや営業時間は訪問前にご確認ください。"],
};
function knownIntroduction(place: Place, locale: Locale): string | null {
  const name = place.name_ko?.trim() ?? "";
  if (name === "제주 삼성혈" || name === "삼성혈") return KNOWN_INTROS[locale][0];
  if (name === "동문재래시장") return KNOWN_INTROS[locale][1];
  if (name === "아살람 레스토랑") return KNOWN_INTROS[locale][2];
  return null;
}

// Kept separate from the API contract: parking availability is NOT in Place.
// Unknown values must never be interpreted as available facilities.
type VisitFact = {key: string; icon: string; name: string; value: string; supplementary?: string};

/** Only render fields that are populated by the existing Place schema.
 *  False is a known negative, while null/undefined means unverified and is omitted. */
function visitValues(place: Place, c: Copy): VisitFact[] {
  const a = place.accessibility;
  const facts: VisitFact[] = [];
  const add = (key:string,icon:string,name:string,value:string,supplementary?:string) => facts.push({key,icon,name,value,supplementary});
  if (a?.walking_level === 1 || a?.walking_level === 2 || a?.walking_level === 3) {
    add("walk","walk",c.walk,a.walking_level === 1 ? c.easy : a.walking_level === 2 ? c.medium : c.active);
  }
  if (typeof a?.restroom === "boolean") add("restroom","restroom",c.restroom,a.restroom ? c.yes : c.no);
  if (typeof a?.has_seating === "boolean") add("seating","seat",c.seating,a.has_seating ? c.yes : c.no);
  if (typeof a?.has_stairs === "boolean") add("stairs","stairs",c.stairs,a.has_stairs ? c.yes : c.no);
  if (typeof a?.wheelchair_ok === "boolean") add("wheelchair","wheelchair",c.wheelchair,a.wheelchair_ok ? c.yes : c.no);
  if (a?.terrain === "flat" || a?.terrain === "slope" || a?.terrain === "steep") {
    add("terrain","terrain",c.terrain,a.terrain === "flat" ? c.terrainFlat : a.terrain === "slope" ? c.terrainSlope : c.terrainSteep);
  }
  if (a?.indoor === true) add("indoor","indoor",c.indoor,c.yes);
  if (Number.isFinite(place.avg_stay_min) && place.avg_stay_min > 0) add("stay","stay",c.duration,`${place.avg_stay_min} ${c.minutes}`);
  // Not in the API model: parking. Never infer it or show a placeholder fact.
  return facts.slice(0,4);
}

function HintIcon({ name }: { name: string }) {
  if (name === "walk") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.4" r="2"/><path d="m8 21 3-6 2-3m-4-5 4 2 3 3 3 1m-8 1-3 1m7-2 3 5v4"/></svg>;
  if (name === "restroom") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17M4 21h16M14 12h.01"/><path d="M9 7h4"/></svg>;
  if (name === "wheelchair") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="4" r="2"/><circle cx="10" cy="17" r="5"/><path d="M11 8v5h6l2 5h2M7 12h6"/></svg>;
  if (name === "stairs") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21h6v-6h6V9h7V3"/></svg>;
  if (name === "terrain") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 20 8-12 4 5 4-8 4 15Z"/></svg>;
  if (name === "indoor") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 9-9 9 9v9H3V12Z"/></svg>;
  if (name === "stay") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/></svg>;
  if (name === "seat") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v10h14V9M5 12h14v7M8 19v2m8-2v2"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h5a3 3 0 0 1 0 6H9"/></svg>;
}

export function PlaceGuide({ place }: { place: Place }) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const description = localizedDescription(place, locale);
  const knownSummary = locale === "en" ? null : knownIntroduction(place, locale);
  const tips = visitValues(place, c);
  return <div className="place-guide">
    <section className="place-guide__about" aria-label={c.about}>
      <h4 className="place-guide__title"><span className="place-guide__title-mark" aria-hidden="true">✦</span>{c.about}</h4>
      {description.original || knownSummary ? <PlaceDescription place={place} className="place-guide__description" override={knownSummary} /> : <p className="place-guide__description">{c.unknown}</p>}
    </section>
    <section className="place-guide__visiting" aria-label={c.visit}>
      <h4 className="place-guide__title"><span className="place-guide__title-mark" aria-hidden="true">◌</span>{c.visit}</h4>
      {tips.length > 0 && <div className="place-guide__grid">
        {tips.map(tip => <div className="place-guide__hint" key={tip.key}>
          <span className="place-guide__icon"><HintIcon name={tip.icon}/></span>
          <span className="place-guide__text"><small>{tip.name}</small><strong>{tip.value}</strong>{tip.supplementary && <em>{tip.supplementary}</em>}</span>
        </div>)}
      </div>}
      {tips.length === 0 && <p className="place-guide__note">{c.noVerified}</p>}
      <p className="place-guide__note">{c.note}</p>
    </section>
  </div>;
}

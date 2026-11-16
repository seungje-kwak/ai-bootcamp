"use client";

import { useLocale } from "@/lib/i18n";
import type { Category } from "@/lib/types";

export const CATEGORY_OPTIONS: { id: Category; icon: string; name: {ko:string;en:string;zh:string;ja:string} }[] = [
  {id:"culture",icon:"🏛️",name:{ko:"관광",en:"Sights",zh:"景点",ja:"観光"}},
  {id:"food",icon:"🍜",name:{ko:"맛집",en:"Food",zh:"美食",ja:"グルメ"}},
  {id:"nature",icon:"⛰️",name:{ko:"자연·등산",en:"Nature & hikes",zh:"自然·登山",ja:"自然·登山"}},
  {id:"cafe",icon:"☕",name:{ko:"카페",en:"Cafés",zh:"咖啡馆",ja:"カフェ"}},
  {id:"market",icon:"🛍️",name:{ko:"시장",en:"Markets",zh:"市场",ja:"市場"}},
  {id:"photo",icon:"📷",name:{ko:"포토",en:"Photos",zh:"拍照",ja:"写真"}},
];

export function MapCategoryLegend({active,onToggle}: {active: Set<Category>;onToggle:(cat:Category)=>void}) {
  const { locale } = useLocale();
  const help = {
    ko: { title:"지도에서 찾아보기", hint:"종류를 눌러 주변 장소를 표시하거나 숨겨요. 여행 코스 번호는 항상 보여요.", massage:"마사지: 데이터 연동 후 표시" },
    en: { title:"Explore by category", hint:"Show or hide nearby places. Itinerary stops remain visible.", massage:"Spa: awaiting place data" },
    zh: { title:"按类别浏览", hint:"点击显示或隐藏周边地点，行程站点始终显示。", massage:"按摩：等待地点数据" },
    ja: { title:"カテゴリーから探す", hint:"周辺スポットの表示を切り替え。旅程の番号は常に表示。", massage:"マッサージ：データ準備中" },
  }[locale];
  return <section className="map-category-panel" aria-label={help.title}>
    <div className="map-category-panel__head"><strong>{help.title}</strong><small>{help.hint}</small></div>
    <div className="map-category-legend" role="group" aria-label={help.title}>
      {CATEGORY_OPTIONS.map(({id,icon,name})=><button key={id} type="button" className={active.has(id)?"is-active":""} aria-pressed={active.has(id)} onClick={()=>onToggle(id)}>
        <span aria-hidden="true">{icon}</span>{name[locale]}
      </button>)}
      <span className="map-category-legend__unavailable" title={help.massage}>♨️ {locale==="ko"?"마사지 준비 중":locale==="en"?"Spa soon":locale==="zh"?"按摩待接入":"マッサージ準備中"}</span>
    </div>
  </section>;
}

import type { Locale } from "@/lib/locale";
import type { Area } from "@/lib/types";

// GET /areas gives each area's name in English and Korean only. The Chinese and Japanese names are
// kept here, by area id. They are the place names in Chinese characters (翰林 = 한림), which is how
// maps and guidebooks in those languages write them.
const NAMES: Record<string, { zh: string; ja: string }> = {
  "jeju-city": { zh: "济州市中心", ja: "済州市中心部" },
  hallim: { zh: "翰林", ja: "翰林" },
  aewol: { zh: "涯月", ja: "涯月" },
  gujwa: { zh: "旧左", ja: "旧左" },
  jocheon: { zh: "朝天", ja: "朝天" },
  hangyeong: { zh: "翰京", ja: "翰京" },
  chuja: { zh: "楸子岛", ja: "楸子島" },
  udo: { zh: "牛岛", ja: "牛島" },
  "seogwipo-city": { zh: "西归浦市中心", ja: "西帰浦市中心部" },
  daejeong: { zh: "大静", ja: "大静" },
  namwon: { zh: "南元", ja: "南元" },
  seongsan: { zh: "城山", ja: "城山" },
  andeok: { zh: "安德", ja: "安徳" },
  pyoseon: { zh: "表善", ja: "表善" },
};

/** The area's name in the traveler's language. An area this file does not know is shown in English. */
export function localizedAreaName(area: Pick<Area, "id" | "name_en" | "name_ko">, locale: Locale): string {
  if (locale === "ko") return area.name_ko;
  if (locale === "zh" || locale === "ja") return NAMES[area.id]?.[locale] ?? area.name_en;
  return area.name_en;
}

// One sentence about each area, shown when the traveler picks it on the map. Written here, in all four
// languages: the API only has a short English list of sights (description_en).
const DESCRIPTIONS: Record<string, Record<Locale, string>> = {
  "jeju-city": {
    en: "Jeju's gateway city: the Tapdong seafront, Dongmun Market and Yongduam Rock.",
    ko: "탑동 바닷가와 동문시장, 용두암이 모여 있는 제주의 관문 도심입니다.",
    zh: "济州的门户城市，塔洞海边、东门市场和龙头岩都在这里。",
    ja: "塔洞の海辺、東門市場、龍頭岩が集まる済州の玄関口です。",
  },
  "hallim": {
    en: "A west-coast town with emerald Hyeopjae Beach and Hallim Park.",
    ko: "에메랄드빛 협재 해변과 한림공원이 있는 서쪽 바닷가 마을입니다.",
    zh: "西海岸小镇，有翡翠色的挟才海滩和翰林公园。",
    ja: "エメラルド色の挟才ビーチと翰林公園がある西海岸の町です。",
  },
  "aewol": {
    en: "Known for seaside cafés and coastal walks with wide sea views.",
    ko: "바다를 바라보는 해안 카페와 산책로로 유명한 곳입니다.",
    zh: "以海景咖啡馆和海岸步道闻名。",
    ja: "海を望むカフェと海岸の散策路で人気のエリアです。",
  },
  "gujwa": {
    en: "Woljeong and Sehwa beaches and quiet villages on the east coast.",
    ko: "월정리·세화 해변과 조용한 동쪽 바다 마을을 만날 수 있습니다.",
    zh: "月汀里、细花海滩和宁静的东海岸村庄。",
    ja: "月汀里・細花ビーチと静かな東海岸の村々があります。",
  },
  "jocheon": {
    en: "East of Jeju City, home to the clear, shallow water of Hamdeok Beach.",
    ko: "얕고 맑은 함덕 해변이 있는 제주시 동쪽 지역입니다.",
    zh: "位于济州市东侧，有水浅清澈的咸德海滩。",
    ja: "遠浅で澄んだ咸徳ビーチがある済州市の東側です。",
  },
  "hangyeong": {
    en: "Suwolbong Peak, a quiet west coast and beautiful sunsets.",
    ko: "수월봉과 한적한 서쪽 해안, 노을이 아름다운 곳입니다.",
    zh: "水月峰和宁静的西海岸，日落很美。",
    ja: "水月峰と静かな西海岸、夕日が美しいエリアです。",
  },
  "chuja": {
    en: "Small islands in the sea north of Jeju.",
    ko: "제주 북쪽 바다에 떠 있는 작은 섬들입니다.",
    zh: "济州北部海上的小岛群。",
    ja: "済州の北の海に浮かぶ小さな島々です。",
  },
  "udo": {
    en: "A small island off Seongsan.",
    ko: "성산 앞바다에 있는 작은 섬입니다.",
    zh: "城山外海的一座小岛。",
    ja: "城山の沖にある小さな島です。",
  },
  "seogwipo-city": {
    en: "The heart of the south: Cheonjiyeon Falls, Olle Market and Jungmun.",
    ko: "천지연폭포, 올레시장, 중문 관광단지가 있는 남쪽 중심지입니다.",
    zh: "南部的中心，有天地渊瀑布、偶来市场和中文旅游区。",
    ja: "天地淵の滝、オルレ市場、中文観光団地がある南部の中心地です。",
  },
  "daejeong": {
    en: "The south-west tip, with Moseulpo Port and the Songaksan coast.",
    ko: "모슬포항과 송악산 해안 풍경을 즐길 수 있는 남서쪽 끝입니다.",
    zh: "西南端，可欣赏摹瑟浦港和松岳山的海岸风光。",
    ja: "摹瑟浦港と松岳山の海岸風景が楽しめる南西の端です。",
  },
  "namwon": {
    en: "A quiet southern town with the Keuneong coastal walk and tangerine groves.",
    ko: "큰엉 해안 산책로와 감귤밭이 이어지는 조용한 남쪽 마을입니다.",
    zh: "宁静的南部小镇，有 Keuneong 海岸步道和柑橘园。",
    ja: "クンオン海岸の散策路とみかん畑が続く静かな南の町です。",
  },
  "seongsan": {
    en: "The sunrise spot: Seongsan Ilchulbong and Seopjikoji.",
    ko: "성산일출봉과 섭지코지가 있는 일출 명소입니다.",
    zh: "看日出的胜地，有城山日出峰和涉地可支。",
    ja: "城山日出峰とソプチコジがある日の出の名所です。",
  },
  "andeok": {
    en: "Dramatic scenery at Sanbangsan and the Yongmeori Coast.",
    ko: "산방산과 용머리해안의 웅장한 풍경을 볼 수 있습니다.",
    zh: "可欣赏山房山和龙头海岸的壮丽景色。",
    ja: "山房山と龍頭海岸の雄大な景色が見られます。",
  },
  "pyoseon": {
    en: "A south-eastern town with wide Pyoseon Beach and Jeju Folk Village.",
    ko: "넓은 표선 해변과 제주민속촌이 있는 남동쪽 마을입니다.",
    zh: "东南部小镇，有宽阔的表善海滩和济州民俗村。",
    ja: "広い表善ビーチと済州民俗村がある南東の町です。",
  },
};

/** What the area is like, in the traveler's language. An area this file does not know: the API's English text. */
export function localizedAreaDescription(area: Pick<Area, "id" | "description_en">, locale: Locale): string {
  return DESCRIPTIONS[area.id]?.[locale] ?? area.description_en;
}

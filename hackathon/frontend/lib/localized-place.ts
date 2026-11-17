// Presentation-only language helpers for the current Jeju demo catalog.
// Never modify or overwrite the original English text returned by the API.
import type { Category, CourseItem, Place } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { ALLERGENS, MENU, PHRASES } from "./content/phrases";
import { textHash } from "./text-hash";

const CATEGORY_NAMES: Record<Locale, Record<Category, string>> = {
  en: { nature: "Nature", market: "Market", cafe: "Café", food: "Food", culture: "Culture", photo: "Photo spot" },
  zh: { nature: "自然风光", market: "市场", cafe: "咖啡馆", food: "当地美食", culture: "文化历史", photo: "摄影景点" },
  ja: { nature: "自然", market: "市場", cafe: "カフェ", food: "グルメ", culture: "文化・歴史", photo: "写真スポット" },
  ko: { nature: "자연", market: "시장", cafe: "카페", food: "맛집", culture: "문화·역사", photo: "사진 명소" },
};
export const localizedCategory = (category: Category, locale: Locale) => CATEGORY_NAMES[locale][category];

// Names are hand-localized for the currently seeded demonstration places.
// A Korean-name check prevents an unrelated live API record sharing an ID
// from accidentally being displayed with the wrong translation.
const PLACE_NAMES: Record<number, [string, string, string]> = {
  1: ["용두암", "龙头岩", "龍頭岩"],
  2: ["제주목 관아", "济州牧官衙", "済州牧官衙"],
  3: ["제주 삼성혈", "三姓穴", "三姓穴"],
  4: ["국립제주박물관", "国立济州博物馆", "国立済州博物館"],
  5: ["제주특별자치도 민속자연사박물관", "济州民俗自然史博物馆", "済州民俗自然史博物館"],
  6: ["동문재래시장", "东门传统市场", "東門在来市場"],
  7: ["사라봉공원", "沙罗峰公园", "サラボン公園"],
  8: ["도두봉", "道头峰", "トドゥボン"],
  9: ["이호테우해수욕장", "梨湖Tewoo海水浴场", "イホテウ海水浴場"],
  10: ["한라수목원", "汉拿树木园", "漢拏樹木園"],
  11: ["제주특별자치도립미술관", "济州道立美术馆", "済州道立美術館"],
  12: ["함덕해수욕장", "咸德海水浴场", "ハムドク海水浴場"],
  13: ["제주4·3평화공원", "济州4·3和平公园", "済州4・3平和公園"],
  14: ["제주절물자연휴양림", "济州节物自然休养林", "済州チョルムル自然休養林"],
  15: ["김만덕객주", "金万德客栈", "金萬徳客主"],
  16: ["넥슨뮤지엄", "Nexon博物馆", "ネクソンミュージアム"],
  17: ["제주돌문화공원", "济州石文化公园", "済州石文化公園"],
  18: ["제주시민속오일시장", "济州市民俗五日市场", "済州市民俗五日市場"],
  19: ["노루생태관찰원", "狍子生态观察园", "ノロ生態観察園"],
  20: ["칠성로상점가", "七星路购物街", "七星路ショッピング通り"],
  21: ["아살람 레스토랑", "Asalam 餐厅", "アサラム・レストラン"],
  22: ["팟타이시암", "暹罗泰式餐厅", "パッタイ・シアム"],
  23: ["우진해장국", "乌珍醒酒汤", "ウジンヘジャングク"],
  24: ["자매국수", "姐妹面馆", "チャメグクス"],
  25: ["카페 델문도", "Delmoondo 咖啡馆", "カフェ・デルムンド"],
  26: ["참맛나김밥", "Chammatna 紫菜包饭", "チャムマッナ・キンパ"],
  27: ["마음에온", "Maeumeon 韩屋咖啡馆", "マウメオン韓屋カフェ"],
  28: ["오현단", "五贤坛", "五賢壇"],
  29: ["산지천", "山地川", "サンジチョン"],
  30: ["산지천갤러리", "山地川画廊", "サンジチョンギャラリー"],
  31: ["아라리오뮤지엄 동문모텔", "Arario 美术馆·东门馆", "アラリオミュージアム東門館"],
  32: ["김만덕기념관", "金万德纪念馆", "金萬徳記念館"],
  33: ["별도봉", "别刀峰", "ピョルドボン"],
  34: ["신산공원", "新山公园", "シンサン公園"],
  35: ["제주특별자치도문예회관", "济州文化艺术会馆", "済州文化芸術会館"],
  36: ["두맹이골목", "都孟伊小巷", "トゥメンイ路地"],
  37: ["곤을동4.3유적지", "济州4·3贡乙洞遗址", "コンウルドン4・3遺跡"],
  38: ["남수각하늘길벽화거리", "南水阁壁画街", "ナムスガク壁画通り"],
  39: ["제주향교", "济州乡校", "済州郷校"],
  40: ["아라리오뮤지엄 탑동시네마", "Arario 美术馆·塔洞馆", "アラリオミュージアム塔洞館"],
  41: ["탑동광장", "塔洞广场", "タプドン広場"],
  42: ["서문공설시장", "西门公设市场", "西門公設市場"],
  43: ["용담/용두암 해안도로", "龙潭海岸公路", "ヨンダム海岸道路"],
  44: ["어영공원", "Eoyeong 公园", "オヨン公園"],
  45: ["용담레포츠공원", "龙潭休闲运动公园", "ヨンダム・レジャー公園"],
  46: ["예술공간 이아", "IA 艺术空间", "アートスペースIA"],
  47: ["제주 전농로 벚꽃거리", "济州全农路樱花街", "済州チョンノン路桜並木"],
  48: ["용담포구", "龙潭渔港", "ヨンダム漁港"],
  49: ["제주4.3유적지 도령마루", "济州4·3道令岭遗址", "済州4・3トリョンマル遺跡"],
  50: ["도두동 무지개해안도로", "道头洞彩虹海岸路", "トドゥドン虹の海岸道路"],
  51: ["누웨마루거리", "Nuwemaru 步行街", "ヌウェマル通り"],
  52: ["수목원테마파크", "树木园主题公园", "樹木園テーマパーク"],
  53: ["민오름", "民岳（Oreum）", "ミノルム"],
  54: ["도두항", "道头港", "トドゥ港"],
  55: ["도두오래물", "道头泉水", "トドゥオレムル"],
  56: ["현사포구", "Hyeonsa 渔港", "ヒョンサ漁港"],
  57: ["이호-내도 해안도로", "梨湖—内都海岸路", "イホ～ネド海岸道路"],
  58: ["노형수퍼마켙", "Nohyung 复古超市", "ノヒョン・スーパー"],
  59: ["연미마을", "Yeonmi 村", "ヨンミ村"],
  60: ["돈사돈 본점", "Donsadon 总店", "トンサドン本店"],
  61: ["신설오름", "Sinsol Oreum", "シンソルオルム"],
  62: ["돌하르방 식당", "石头爷爷餐厅", "トルハルバン食堂"],
  63: ["순옥이네 명가", "Sunokine 餐厅", "スノギネ名家"],
  64: ["은희네해장국", "Eunhee 醒酒汤", "ウニネヘジャングク"],
  65: ["고집돌우럭 제주공항점", "Gozip Dol Ureok · 济州机场店", "コジプトルウロク・済州空港店"],
  66: ["이금돈지 통갈치조림 제주공항본점", "E-Geumdonji · 机场总店", "イグムトンジ・済州空港本店"],
  67: ["갱이네보말칼국수", "Gaengine 海螺刀切面", "ゲンイネ・ボマルカルグクス"],
  68: ["원담 제주본점", "Wondam 济州总店", "ウォンダム済州本店"],
  69: ["탑동산호전복", "塔洞珊瑚鲍鱼", "タプドン・サンホアワビ"],
  70: ["갯것이식당", "Gaetgeotsi 餐厅", "ケットゴッシ食堂"],
  71: ["말고기연구소 제주공항점", "马肉研究所·济州机场店", "馬肉研究所・済州空港店"],
  72: ["제주토속", "济州土俗餐厅", "済州トソク"],
  73: ["덕인당보리빵 제주점", "德仁堂大麦面包·济州店", "トギンダン麦パン・済州店"],
  74: ["카카듀", "Kakadu 咖啡馆", "カカドゥ"],
};

export function localizedPlaceName(place: Place, locale: Locale): string {
  if (locale === "en") return place.name_en;
  if (locale === "ko") return place.name_ko || place.name_en;
  const entry = PLACE_NAMES[place.id];
  if (entry && place.name_ko.includes(entry[0])) return locale === "zh" ? entry[1] : entry[2];
  // Official Korean name is safer than inventing a translated proper noun.
  return place.name_ko || place.name_en;
}

const INTEREST_WORDS: Record<string, [string, string]> = {
  nature: ["自然风光", "自然"], markets: ["逛市场", "市場"], "cafés": ["咖啡馆", "カフェ"],
  "local food": ["当地美食", "地元グルメ"], "culture and history": ["文化和历史", "文化と歴史"],
  "photo spots": ["拍照景点", "写真スポット"],
};
const LEADS: Record<string, [string, string]> = {
  "Some time in nature": ["在自然中放松", "自然を楽しむ"],
  "A market stop": ["逛逛当地市场", "地元の市場を楽しむ"],
  "A café break": ["在咖啡馆小憩", "カフェでひと休み"],
  "A local food stop": ["品尝当地美食", "地元グルメを楽しむ"],
  "A culture and history stop": ["感受济州的文化与历史", "済州の文化と歴史に触れる"],
  "A photo stop": ["享受摄影时光", "写真撮影を楽しむ"],
};

function translateRuleSentence(sentence: string, locale: "zh" | "ja"): string | null {
  const which = locale === "zh" ? 0 : 1;
  const interest = /^You said you enjoy (nature|markets|cafés|local food|culture and history|photo spots), and this is one of them\.$/i.exec(sentence);
  if (interest) {
    const theme = INTEREST_WORDS[interest[1].toLowerCase()]?.[which];
    return theme ? (locale === "zh" ? `你喜欢${theme}，这里正好符合你的兴趣。` : `お好みの${theme}に合うスポットです。`) : null;
  }
  const broaden = /^(Some time in nature|A market stop|A café break|A local food stop|A culture and history stop|A photo stop) to round out your day\.$/.exec(sentence);
  if (broaden) {
    const lead = LEADS[broaden[1]]?.[which];
    if (!lead) return null;
    if (locale === "zh") return `${lead}，为你的旅程增添不同体验。`;
    const japanese: Record<string, string> = {
      "Some time in nature": "自然に触れ、旅のひとときを楽しみましょう。",
      "A market stop": "地元の市場めぐりを楽しめるスポットです。",
      "A café break": "カフェでひと休みできるスポットです。",
      "A local food stop": "地元グルメを楽しめるスポットです。",
      "A culture and history stop": "済州の文化と歴史に触れられるスポットです。",
      "A photo stop": "写真撮影を楽しめるスポットです。",
    };
    return japanese[broaden[1]] ?? null;
  }
  const food = /^(A place to eat|A café stop)(?: where (.*))?\.$/.exec(sentence);
  if (food) {
    const dining = food[1] === "A place to eat";
    let intro = locale === "zh" ? (dining ? "适合用餐的地点" : "适合休息的咖啡馆") : (dining ? "食事におすすめの場所" : "ひと休みにおすすめのカフェ");
    if (food[2]) {
      const fragments = food[2].split(", ");
      const parts: string[] = [];
      for (const frag of fragments) {
        const option = /^there are (vegan|vegetarian|halal) options$/.exec(frag);
        if (frag === "you can order for one") parts.push(locale === "zh" ? "可以一人用餐" : "おひとり様でも注文できます");
        else if (frag === "there is an English menu") parts.push(locale === "zh" ? "提供英文菜单" : "英語メニューがあります");
        else if (option) {
          const label = { vegan: ["纯素", "ヴィーガン"], vegetarian: ["素食", "ベジタリアン"], halal: ["清真", "ハラール"] }[option[1] as "vegan" | "vegetarian" | "halal"][which];
          parts.push(locale === "zh" ? `提供${label}选项` : `${label}対応メニューがあります`);
        } else return null;
      }
      intro += locale === "zh" ? `，${parts.join("，")}` : `。${parts.join("。")} `;
    }
    return `${intro.trim()}${locale === "zh" ? "。" : (intro.trim().endsWith("。")==true ? "" : "。")}`;
  }
  if (sentence === "Flat ground with little walking.") return locale === "zh" ? "地势平坦，步行负担较少。" : "平坦な道が多く、歩く負担が少なめです。";
  if (sentence === "It's indoors, so the rain won't matter.") return locale === "zh" ? "这里是室内地点，下雨也能安心游览。" : "屋内スポットなので、雨の日でも楽しめます。";
  if (sentence === "Take a seat and rest here.") return locale === "zh" ? "可以在这里坐下来休息。" : "ここでは座って休憩できます。";
  return null;
}

// Known demo-course sentences have reviewed translations. This does not
// imply arbitrary LLM output can be translated without a service.
const DEMO_REASONS: Record<string, [string, string]> = {
  "You said you enjoy photo spots. This wave-carved rock on the north shore looks like a dragon's head rising from the sea.": ["你喜欢拍照景点。北岸的这块海蚀岩看起来像一条从海中升起的龙头。", "写真スポットがお好きなあなたへ。北岸にある波で削られた岩が、海から顔を出す龍の頭のように見えます。"],
  "You said you enjoy markets. Jeju City's oldest downtown shopping street, with a car-free section and small cafés.": ["你喜欢逛市场。这里是济州市中心历史悠久的购物街，设有步行区和小咖啡馆。", "市場めぐりがお好きなあなたへ。済州市中心部の歴史ある商店街で、歩行者専用区間や小さなカフェがあります。"],
  "A lunch stop where you can order for one, with a separately labelled vegan section and an English menu.": ["适合独自用餐的午餐地点，提供单独标注的纯素菜单区和英文菜单。", "おひとり様でランチを楽しめるお店です。ヴィーガン向けメニューが区別され、英語メニューもあります。"],
  "You said you enjoy markets. Jeju's biggest permanent market, a covered maze of stalls with tangerines and local snacks.": ["你喜欢逛市场。这里是济州规模最大的常设市场，有遮棚的摊位中售卖柑橘和当地小吃。", "市場めぐりがお好きなあなたへ。済州最大の常設市場で、屋根付きの通路にはミカンや地元のおやつが並びます。"],
  "You said you enjoy photo spots. A grey-sand beach with a pair of red and white horse-shaped lighthouses on the breakwater.": ["你喜欢拍照景点。这片灰沙海滩的防波堤上有一红一白两座马形灯塔。", "写真スポットがお好きなあなたへ。灰色の砂浜と、防波堤に立つ赤と白の馬の形をした灯台が見どころです。"],
  "Red-pillared halls and pavilions in the old city center, on flat ground with little walking.": ["老城区内的红柱殿堂与亭阁，地势平坦，步行负担较少。", "旧市街にある赤い柱の建物や東屋を見学できます。平坦な場所なので歩く負担も少なめです。"],
};

const CONTENT_HELP: Record<"zh" | "ja", { generic: string; original: string; description: string; originalDescription: string }> = {
  zh: { generic: "已为你选好这一站。详细推荐理由请查看英文原文。", original: "查看英文推荐原文", description: "此地点的详细介绍暂未翻译。", originalDescription: "查看英文景点介绍" },
  ja: { generic: "おすすめスポットです。詳しい理由は英語原文をご覧ください。", original: "おすすめ理由の英語原文", description: "スポットの詳しい説明は翻訳準備中です。", originalDescription: "スポット紹介の英語原文" },
};
export const contentHelp = (locale: "zh" | "ja" | "ko") => locale === "ko"
  ? { generic: "당신의 취향에 맞춘 추천 장소예요. 자세한 이유는 영어 원문을 확인해 주세요.", original: "영어 원문 보기", description: "장소 소개는 영어 원문에서 확인할 수 있어요.", originalDescription: "영어 장소 소개 보기" }
  : CONTENT_HELP[locale];

/**
 * Translate deterministic rule-based text accurately. Free-form LLM strings
 * cannot be translated by a static dictionary, so present a clearly labeled
 * local-language summary with an opt-in view of the original.
 */
export function localizedReason(item: CourseItem, locale: Locale): { text: string; hasTranslation: boolean; original: string } {
  const original = item.reason_en?.trim() ?? "";
  if (locale === "en") return { text: original, hasTranslation: true, original };
  if (locale === "ko") {
    const translated: string[] = [];
    const sentences = original.match(/[^.!?]+[.!?]/g)?.map(x => x.trim()) ?? [];
    for (const sentence of sentences) {
      if (/^Flat ground with little walking\.$/.test(sentence)) translated.push("평탄한 지형이라 걷는 부담이 적어요.");
      else if (/^It's indoors, so the rain won't matter\.$/.test(sentence)) translated.push("실내 공간이라 비 오는 날에도 방문하기 좋아요.");
      else if (/^Take a seat and rest here\.$/.test(sentence)) translated.push("앉아서 잠시 쉬어가기 좋아요.");
      else if (/^You said you enjoy (nature|markets|cafés|local food|culture and history|photo spots), and this is one of them\.$/.test(sentence)) {
        const m = sentence.match(/^You said you enjoy (nature|markets|cafés|local food|culture and history|photo spots)/);
        const dictionary: Record<string, string> = { nature:"자연", markets:"시장 탐방", cafés:"카페", "local food":"로컬 맛집", "culture and history":"문화와 역사", "photo spots":"사진 명소" };
        translated.push(`${dictionary[m?.[1] ?? ""] || "관심사"}에 관심이 있다고 하셔서 추천했어요.`);
      } else if (/^(Some time in nature|A market stop|A café break|A local food stop|A culture and history stop|A photo stop) to round out your day\.$/.test(sentence)) {
        const type = sentence.split(" to round out")[0];
        const dictionary: Record<string,string> = {"Some time in nature":"자연 속에서 쉬어가는 곳", "A market stop":"현지 시장을 즐길 수 있는 곳", "A café break":"카페에서 휴식하는 곳", "A local food stop":"제주 음식을 맛볼 수 있는 곳", "A culture and history stop":"문화와 역사를 만나는 곳", "A photo stop":"기념사진을 남기기 좋은 곳"};
        translated.push(`${dictionary[type]}으로 일정을 채워보세요.`);
      } else if (/^(A place to eat|A café stop)(?: where .*)?\.$/.test(sentence)) {
        const s = sentence.includes("A café") ? "카페에서 편하게 쉬어갈 수 있어요." : "식사를 즐기기 좋은 장소예요.";
        const extras = [sentence.includes("order for one") && "혼자 주문하기 편해요.", sentence.includes("English menu") && "영어 메뉴가 있어요.", sentence.includes("vegan options") && "비건 메뉴 선택지가 있어요.", sentence.includes("vegetarian options") && "채식 메뉴 선택지가 있어요.", sentence.includes("halal options") && "할랄 메뉴 선택지가 있어요."].filter(Boolean).join(" ");
        translated.push(s+" "+extras);
      } else break;
    }
    if (sentences.length && translated.length === sentences.length && sentences.join(" ") === original) return { text: translated.join(" "), hasTranslation: true, original };
    return { text: contentHelp("ko").generic, hasTranslation: false, original };
  }
  const demo = DEMO_REASONS[original];
  if (demo) return { text: demo[locale === "zh" ? 0 : 1], hasTranslation: true, original };
  const sentences = original.match(/[^.!?]+[.!?]/g)?.map(s=>s.trim()) ?? [];
  if (sentences.join(" ") === original && sentences.length > 0) {
    const translated = sentences.map(sentence=>translateRuleSentence(sentence, locale));
    if (translated.every(Boolean)) return { text: translated.join(" "), hasTranslation: true, original };
  }
  return { text: CONTENT_HELP[locale].generic, hasTranslation: false, original };
}

export function localizedDescription(place: Place, locale: Locale): { text: string; hasTranslation: boolean; original: string } {
  const original = place.description_en?.trim() ?? "";
  if (locale === "en") return { text: original, hasTranslation: true, original };
  if (locale === "ko") return { text: `${localizedCategory(place.category, "ko")}에 해당하는 장소예요. 자세한 정보는 영어 소개를 확인해 주세요.`, hasTranslation: false, original };
  // Display a verified category-level summary, never an invented translation of the source description.
  const category = localizedCategory(place.category, locale);
  const text = locale === "zh" ? `这里是${category}类景点。可查看英文原文了解更多详情。` : `「${category}」に分類されるスポットです。詳しい説明は英語原文をご確認ください。`;
  return { text, hasTranslation: false, original };
}

// ---------------------------------------------------------------------------- reviewed short strings
// Signature dishes, allergen notes and the English side of phrase cards (lib/content/phrases.ts).
// `translated: false` means `text` is still the English original.

type ReviewedTarget = Exclude<Locale, "en">;
const REVIEWED_COLUMN: Record<ReviewedTarget, 0 | 1 | 2> = { zh: 0, ja: 1, ko: 2 };
export type ReviewedText = { text: string; translated: boolean; original: string };

function fromTable(table: Record<string, readonly [zh: string, ja: string, ko?: string]>, value: string | null | undefined, locale: Locale): ReviewedText {
  const original = value?.trim() ?? "";
  if (locale === "en" || !original) return { text: original, translated: true, original };
  const found = table[original]?.[REVIEWED_COLUMN[locale]];
  return found ? { text: found, translated: true, original } : { text: original, translated: false, original };
}

export const localizedMenu = (text: string | null, locale: Locale) => fromTable(MENU, text, locale);
export const localizedAllergens = (text: string | null, locale: Locale) => fromTable(ALLERGENS, text, locale);
export const localizedPhrase = (textEn: string, locale: Locale) => fromTable(PHRASES, textEn, locale);

// ---------------------------------------------------------------------------- reviewed descriptions (loaded on demand)
type DescriptionTable = Record<number, { src: string; text: string }>;
const descriptionTables: Partial<Record<ReviewedTarget, Promise<DescriptionTable>>> = {};

export function loadDescriptions(locale: ReviewedTarget): Promise<DescriptionTable> {
  descriptionTables[locale] ??= (
    locale === "zh" ? import("./content/descriptions.zh") : locale === "ja" ? import("./content/descriptions.ja") : import("./content/descriptions.ko")
  ).then((m) => m.DESCRIPTIONS);
  return descriptionTables[locale]!;
}

/** The reviewed description for a place, only if it was translated from this exact English text. */
export function describeFrom(table: DescriptionTable, place: Pick<Place, "id" | "description_en">): string | null {
  const entry = table[place.id];
  return entry && entry.src === textHash((place.description_en ?? "").trim()) ? entry.text : null;
}

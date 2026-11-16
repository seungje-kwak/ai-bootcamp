// Presentation-only language helpers. The API contract stays English (`name_en`, `reason_en`,
// `description_en`); nothing here writes back to it. Three sources, in this order:
//   1. reviewed dictionaries for the seeded places and fixed strings   (lib/content/*)
//   2. templates for the rule planner's fixed sentences                 (this file)
//   3. a translation service for free-form AI text                      (lib/translation.ts)
// When none applies the English original is shown and labelled as such. Text is never
// invented to fill the gap.
import type { Locale } from "@/lib/locale";
import type { Category, CourseItem, Place } from "@/lib/types";
import { PLACE_NAMES } from "./content/place-names";
import { ALLERGENS, MENU, PHRASES } from "./content/phrases";
import { textHash } from "./text-hash";

type Target = Exclude<Locale, "en">;
// Dictionary rows are [简体中文, 日本語, 한국어].
type Row = readonly [zh: string, ja: string, ko: string];
const COLUMN: Record<Target, 0 | 1 | 2> = { zh: 0, ja: 1, ko: 2 };
const pick = (row: Row, locale: Target) => row[COLUMN[locale]];

export type LocalizedText = {
  /** What to show. Equals `original` when no reviewed translation exists. */
  text: string;
  /** false = `text` is still the English original. */
  translated: boolean;
  original: string;
};

const asIs = (original: string): LocalizedText => ({ text: original, translated: true, original });
const untranslated = (original: string): LocalizedText => ({ text: original, translated: false, original });

// ---------------------------------------------------------------------------- categories
const CATEGORY_NAMES: Record<Locale, Record<Category, string>> = {
  en: { nature: "Nature", market: "Market", cafe: "Café", food: "Food", culture: "Culture", photo: "Photo spot" },
  zh: { nature: "自然风光", market: "市场", cafe: "咖啡馆", food: "美食", culture: "文化历史", photo: "拍照景点" },
  ja: { nature: "自然", market: "市場", cafe: "カフェ", food: "グルメ", culture: "文化・歴史", photo: "写真スポット" },
  ko: { nature: "자연", market: "시장", cafe: "카페", food: "음식", culture: "문화·역사", photo: "사진 명소" },
};
export const localizedCategory = (category: Category, locale: Locale) => CATEGORY_NAMES[locale][category];

// ---------------------------------------------------------------------------- place names
export function localizedPlaceName(place: Place, locale: Locale): string {
  if (locale === "en") return place.name_en;
  if (locale === "ko") return place.name_ko || place.name_en; // the API's own Korean name
  const entry = PLACE_NAMES[place.id];
  // The Korean-name check stops an unrelated live record that reuses an id from getting the wrong name.
  if (entry && place.name_ko.trim() === entry[0]) return locale === "zh" ? entry[1] : entry[2];
  // The official Korean name is safer than an invented proper noun.
  return place.name_ko || place.name_en;
}

// ---------------------------------------------------------------------------- recommendation reasons
// Sentences the rule planner builds from fixed parts (backend planner._rule_reason / validate).
// The Korean column carries its object particle (을/를), which depends on the word.
const INTERESTS: Record<string, Row> = {
  nature: ["自然风光", "自然", "자연을"],
  markets: ["逛市场", "市場めぐり", "시장 구경을"],
  "cafés": ["咖啡馆", "カフェ", "카페를"],
  "local food": ["当地美食", "地元グルメ", "현지 음식을"],
  "culture and history": ["文化和历史", "文化と歴史", "문화와 역사를"],
  "photo spots": ["拍照景点", "写真スポット", "사진 명소를"],
};

const ROUND_OUT: Record<string, Row> = {
  "Some time in nature": ["去自然里走一走，让这一天更完整。", "自然の中で過ごす時間を加えて、一日をより充実させます。", "자연 속에서 시간을 보내며 하루를 더 알차게 채워 보세요."],
  "A market stop": ["逛一逛市场，让这一天更完整。", "市場に立ち寄って、一日をより充実させます。", "시장에 들러 하루를 더 알차게 채워 보세요."],
  "A café break": ["在咖啡馆歇一歇，让这一天更完整。", "カフェでひと休みして、一日をより充実させます。", "카페에서 잠시 쉬며 하루를 더 알차게 채워 보세요."],
  "A local food stop": ["尝一尝当地美食，让这一天更完整。", "地元グルメを味わって、一日をより充実させます。", "현지 음식을 맛보며 하루를 더 알차게 채워 보세요."],
  "A culture and history stop": ["感受一下文化与历史，让这一天更完整。", "文化と歴史に触れて、一日をより充実させます。", "문화와 역사를 만나며 하루를 더 알차게 채워 보세요."],
  "A photo stop": ["去一处拍照景点，让这一天更完整。", "写真スポットに立ち寄って、一日をより充実させます。", "사진 명소에 들러 하루를 더 알차게 채워 보세요."],
};

const FIXED: Record<string, Row> = {
  "Flat ground with little walking.": ["地势平坦，不用走太多路。", "平坦で、あまり歩かずに楽しめます。", "평지라 많이 걷지 않아도 됩니다."],
  "It's indoors, so the rain won't matter.": ["这里在室内，下雨也不受影响。", "屋内なので、雨でも大丈夫です。", "실내라서 비가 와도 괜찮습니다."],
  "Take a seat and rest here.": ["可以在这里坐下来休息。", "ここで座ってひと休みしましょう。", "여기서 앉아 쉬어 가세요."],
  "A nearby alternative so you can keep going from where you are.": [
    "这是附近的替代地点，方便你从现在的位置继续行程。",
    "いまいる場所からそのまま旅を続けられる、近くの代わりのスポットです。",
    "지금 계신 곳에서 바로 이어 갈 수 있는 가까운 대체 장소입니다.",
  ],
};

const DIET_WORDS: Record<"vegan" | "vegetarian" | "halal", Row> = {
  vegan: ["纯素", "ヴィーガン", "비건"],
  vegetarian: ["素食", "ベジタリアン", "채식"],
  halal: ["清真", "ハラール", "할랄"],
};

const ORDER_FOR_ONE: Row = ["可以只点一人份", "おひとり様でも注文できます", "1인분 주문이 가능합니다"];
const ENGLISH_MENU: Row = ["提供英文菜单", "英語メニューがあります", "영어 메뉴가 있습니다"];

function translateRuleSentence(sentence: string, locale: Target): string | null {
  const fixed = FIXED[sentence];
  if (fixed) return pick(fixed, locale);

  const interest = /^You said you enjoy (.+), and this is one of them\.$/.exec(sentence);
  if (interest) {
    const theme = INTERESTS[interest[1].toLowerCase()];
    if (!theme) return null;
    if (locale === "zh") return `你说过喜欢${theme[0]}，这里正是这样的地方。`;
    if (locale === "ja") return `${theme[1]}がお好きとのことなので、ぴったりのスポットです。`;
    return `${theme[2]} 좋아한다고 하셔서 고른 곳입니다.`;
  }

  const roundOut = /^(.+) to round out your day\.$/.exec(sentence);
  if (roundOut) {
    const line = ROUND_OUT[roundOut[1]];
    return line ? pick(line, locale) : null;
  }

  const food = /^(A place to eat|A café stop)(?: where (.+))?\.$/.exec(sentence);
  if (food) {
    const dining = food[1] === "A place to eat";
    const parts: string[] = [];
    for (const fragment of food[2] ? food[2].split(", ") : []) {
      const diet = /^there are (vegan|vegetarian|halal) options$/.exec(fragment);
      if (fragment === "you can order for one") parts.push(pick(ORDER_FOR_ONE, locale));
      else if (fragment === "there is an English menu") parts.push(pick(ENGLISH_MENU, locale));
      else if (diet) {
        const word = pick(DIET_WORDS[diet[1] as keyof typeof DIET_WORDS], locale);
        parts.push(locale === "zh" ? `提供${word}餐点` : locale === "ja" ? `${word}対応のメニューがあります` : `${word} 메뉴가 있습니다`);
      } else return null;
    }
    if (locale === "zh") {
      const lead = dining ? "适合用餐的地点" : "适合歇脚的咖啡馆";
      return `${[lead, ...parts].join("，")}。`;
    }
    if (locale === "ja") {
      const lead = dining ? "食事におすすめのお店です。" : "ひと休みにおすすめのカフェです。";
      return lead + parts.map((p) => `${p}。`).join("");
    }
    const lead = dining ? "식사하기 좋은 곳입니다." : "쉬어 가기 좋은 카페입니다.";
    return [lead, ...parts.map((p) => `${p}.`)].join(" ");
  }
  return null;
}

// Hand-written reasons of the Emma demo course (data/demo/emma_course.json), reviewed translations.
const DEMO_REASONS: Record<string, Row> = {
  "You said you enjoy photo spots. This wave-carved rock on the north shore looks like a dragon's head rising from the sea.": [
    "你说过喜欢拍照景点。北岸这块被海浪雕琢的岩石，看起来就像从海中升起的龙头。",
    "写真スポットがお好きと伺いました。北岸にある波に削られたこの岩は、海から立ち上がる龍の頭のように見えます。",
    "사진 명소를 좋아한다고 하셨죠. 북쪽 해안의 이 파도에 깎인 바위는 바다에서 솟아오르는 용의 머리처럼 보입니다.",
  ],
  "You said you enjoy markets. Jeju City's oldest downtown shopping street, with a car-free section and small cafés.": [
    "你说过喜欢逛市场。这是济州市最古老的市中心购物街，设有步行街区段和小咖啡馆。",
    "市場めぐりがお好きと伺いました。済州市で最も古い繁華街の商店街で、歩行者専用の区間や小さなカフェがあります。",
    "시장 구경을 좋아한다고 하셨죠. 제주시에서 가장 오래된 도심 상점가로, 차 없는 거리 구간과 작은 카페들이 있습니다.",
  ],
  "A lunch stop where you can order for one, with a separately labelled vegan section and an English menu.": [
    "可以一人点餐的午餐地点，设有单独标注的纯素菜单区，并提供英文菜单。",
    "ひとりでも注文できるランチスポット。ヴィーガンメニューが別に表示され、英語メニューもあります。",
    "1인분 주문이 가능한 점심 식당으로, 비건 메뉴가 따로 표시되어 있고 영어 메뉴가 있습니다.",
  ],
  "You said you enjoy markets. Jeju's biggest permanent market, a covered maze of stalls with tangerines and local snacks.": [
    "你说过喜欢逛市场。这是济州最大的常设市场，带顶棚的通道里摊位密布，有柑橘和当地小吃。",
    "市場めぐりがお好きと伺いました。済州最大の常設市場で、屋根付きの通路に店が迷路のように並び、ミカンや地元のおやつが楽しめます。",
    "시장 구경을 좋아한다고 하셨죠. 제주에서 가장 큰 상설 시장으로, 지붕 덮인 미로 같은 골목에 감귤과 지역 간식을 파는 가게가 가득합니다.",
  ],
  "You said you enjoy photo spots. A grey-sand beach with a pair of red and white horse-shaped lighthouses on the breakwater.": [
    "你说过喜欢拍照景点。这是一片灰色沙滩，防波堤上有一红一白两座马形灯塔。",
    "写真スポットがお好きと伺いました。灰色の砂浜で、防波堤には赤と白の馬の形をした一対の灯台があります。",
    "사진 명소를 좋아한다고 하셨죠. 잿빛 모래 해변으로, 방파제 위에 빨간색과 하얀색 말 모양 등대 한 쌍이 있습니다.",
  ],
  "Red-pillared halls and pavilions in the old city center, on flat ground with little walking.": [
    "老城中心的红柱殿堂和亭阁，地势平坦，不用走太多路。",
    "旧市街の中心にある赤い柱の建物と東屋。平坦で、あまり歩かずに楽しめます。",
    "원도심 한가운데 붉은 기둥의 건물과 정자가 있는 곳으로, 평지라 많이 걷지 않아도 됩니다.",
  ],
};

/** Reason shown on a stop. Rule-planner and demo sentences are translated here; anything
 *  else (free-form LLM text) comes back untranslated so the caller can ask the translation
 *  service or show the English original with a notice. */
export function localizedReason(item: Pick<CourseItem, "reason_en">, locale: Locale): LocalizedText {
  const original = item.reason_en?.trim() ?? "";
  if (locale === "en" || !original) return asIs(original);
  const demo = DEMO_REASONS[original];
  if (demo) return { text: pick(demo, locale), translated: true, original };
  const sentences = original.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [];
  if (sentences.length > 0 && sentences.join(" ") === original) {
    const out = sentences.map((s) => translateRuleSentence(s, locale));
    if (out.every((s): s is string => s !== null)) {
      // Chinese and Japanese sentences follow each other without a space; Korean ones need it.
      return { text: out.join(locale === "ko" ? " " : ""), translated: true, original };
    }
  }
  return untranslated(original);
}

// ---------------------------------------------------------------------------- short fixed strings
function fromTable(
  table: Record<string, readonly [zh: string, ja: string, ko?: string]>,
  text: string | null | undefined,
  locale: Locale,
): LocalizedText {
  const original = text?.trim() ?? "";
  if (locale === "en" || !original) return asIs(original);
  const found = table[original]?.[COLUMN[locale]];
  return found ? { text: found, translated: true, original } : untranslated(original);
}

export const localizedMenu = (text: string | null, locale: Locale) => fromTable(MENU, text, locale);
export const localizedAllergens = (text: string | null, locale: Locale) => fromTable(ALLERGENS, text, locale);
export const localizedPhrase = (textEn: string, locale: Locale) => fromTable(PHRASES, textEn, locale);

// ---------------------------------------------------------------------------- descriptions (loaded on demand)
type DescriptionTable = Record<number, { src: string; text: string }>;
const tables: Partial<Record<Target, Promise<DescriptionTable>>> = {};

export function loadDescriptions(locale: Target): Promise<DescriptionTable> {
  tables[locale] ??= (
    locale === "zh"
      ? import("./content/descriptions.zh")
      : locale === "ja"
        ? import("./content/descriptions.ja")
        : import("./content/descriptions.ko")
  ).then((m) => m.DESCRIPTIONS);
  return tables[locale]!;
}

/** The reviewed description for a place, only if it was translated from this exact English text. */
export function describeFrom(table: DescriptionTable, place: Pick<Place, "id" | "description_en">): string | null {
  const entry = table[place.id];
  return entry && entry.src === textHash(place.description_en.trim()) ? entry.text : null;
}

import type { FoodOptions, UserProfile } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

type Diet = UserProfile["diet"];
const BADGES: { key: keyof FoodOptions; label: Record<Locale, string> }[] = [
  { key: "solo_ok", label: { en: "Solo friendly", zh: "适合独自用餐", ja: "ひとり旅歓迎", ko: "혼자 식사 가능" } },
  { key: "vegan", label: { en: "Vegan option", zh: "纯素选项", ja: "ヴィーガン対応", ko: "비건 메뉴" } },
  { key: "vegetarian", label: { en: "Vegetarian option", zh: "素食选项", ja: "ベジタリアン対応", ko: "채식 메뉴" } },
  { key: "halal", label: { en: "Halal option", zh: "清真选项", ja: "ハラール対応", ko: "할랄 메뉴" } },
  { key: "english_menu", label: { en: "English menu", zh: "英文菜单", ja: "英語メニュー", ko: "영어 메뉴" } },
];

export function FoodBadges({ food, diet = "none", locale = "en" }: { food: FoodOptions | null; diet?: Diet; locale?: Locale }) {
  if (!food) return null;
  const on = BADGES.filter((b) => food[b.key] === true);
  const showMenu = Boolean(food.signature_menu_en) && diet === "none";
  if (!on.length && !showMenu) return null;
  return <div className="food-facts">
    {on.length > 0 && <div className="food-facts__chips" aria-label={locale === "zh" ? "用餐信息" : locale === "ja" ? "食事情報" : locale === "ko" ? "식사 정보" : "Dining details"}>
      {on.map((b) => <span key={b.key} className="food-facts__chip"><span aria-hidden="true">✓</span>{b.label[locale]}</span>)}
    </div>}
    {showMenu && <p className="food-facts__menu"><span>{locale === "zh" ? "招牌菜（英文）" : locale === "ja" ? "おすすめ料理（英語表記）" : locale === "ko" ? "대표 메뉴 (영어 표기)" : "Signature dish"}</span>{food.signature_menu_en}</p>}
  </div>;
}

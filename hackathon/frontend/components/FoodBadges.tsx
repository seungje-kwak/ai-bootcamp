import type { FoodOptions, UserProfile } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { localizedAllergens, localizedMenu } from "@/lib/localized-place";

type Diet = UserProfile["diet"];
const BADGES: { key: keyof FoodOptions; label: Record<Locale, string> }[] = [
  { key: "solo_ok", label: { en: "Solo friendly", zh: "适合独自用餐", ja: "ひとり旅歓迎", ko: "혼자 식사 가능" } },
  { key: "vegan", label: { en: "Vegan option", zh: "纯素选项", ja: "ヴィーガン対応", ko: "비건 메뉴" } },
  { key: "vegetarian", label: { en: "Vegetarian option", zh: "素食选项", ja: "ベジタリアン対応", ko: "채식 메뉴" } },
  { key: "halal", label: { en: "Halal option", zh: "清真选项", ja: "ハラール対応", ko: "할랄 메뉴" } },
  { key: "english_menu", label: { en: "English menu", zh: "英文菜单", ja: "英語メニュー", ko: "영어 메뉴" } },
];
const TRY: Record<Locale, string> = { en: "Try", zh: "推荐尝试", ja: "おすすめ", ko: "추천 메뉴" };
const ALLERGEN_LABEL: Record<Locale, string> = { en: "Allergens", zh: "过敏原", ja: "アレルゲン", ko: "알레르기 유발 성분" };

// US-06 / P0 US-R03: only options that are `=== true` become badges (null = unknown, no badge).
// The signature dish is hidden from travelers who chose a diet, because it is usually not something they can eat.
export function FoodBadges({ food, diet = "none", locale = "en" }: { food: FoodOptions | null; diet?: Diet; locale?: Locale }) {
  if (!food) return null;
  const on = BADGES.filter((b) => food[b.key] === true);
  const menu = food.signature_menu_en && diet === "none" ? localizedMenu(food.signature_menu_en, locale) : null;
  const allergens = food.allergens ? localizedAllergens(food.allergens, locale) : null;
  if (!on.length && !menu && !allergens) return null;
  return (
    <div className="food-facts">
      {on.length > 0 && (
        <div className="food-facts__chips" aria-label={locale === "zh" ? "用餐信息" : locale === "ja" ? "食事情報" : locale === "ko" ? "식사 정보" : "Dining details"}>
          {on.map((b) => (
            <span key={b.key} className="food-facts__chip">
              <span aria-hidden="true">✓</span>
              {b.label[locale]}
            </span>
          ))}
        </div>
      )}
      {menu && (
        <p className="food-facts__menu">
          <span>{TRY[locale]}</span>
          <strong className="font-semibold" lang={menu.translated ? undefined : "en"}>{menu.text}</strong>
        </p>
      )}
      {allergens && (
        <p className="food-facts__menu">
          <span>{ALLERGEN_LABEL[locale]}</span>
          <strong className="font-semibold" lang={allergens.translated ? undefined : "en"}>{allergens.text}</strong>
        </p>
      )}
    </div>
  );
}

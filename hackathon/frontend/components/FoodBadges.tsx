"use client";

import { useLocale } from "@/lib/i18n";
import { localizedAllergens, localizedMenu } from "@/lib/localized-place";
import type { FoodOptions, UserProfile } from "@/lib/types";

type Diet = UserProfile["diet"];
const KEYS = ["solo_ok", "vegan", "vegetarian", "halal", "english_menu"] as const;

// US-06: only the options that are true become badges. The signature dish is hidden from
// travelers who chose a diet, because it is usually not something they can eat.
export function FoodBadges({ food, diet = "none" }: { food: FoodOptions | null; diet?: Diet }) {
  const { locale, t } = useLocale();
  if (!food) return null;
  const on = KEYS.filter((k) => food[k] === true);
  const menu = food.signature_menu_en && diet === "none" ? localizedMenu(food.signature_menu_en, locale) : null;
  const allergens = food.allergens ? localizedAllergens(food.allergens, locale) : null;
  if (on.length === 0 && !menu && !allergens) return null;
  return (
    <div className="stop__section">
      {on.length > 0 && (
        <ul className="stop__chips" style={{ marginTop: 0 }}>
          {on.map((k) => (
            <li key={k} className="chip chip-coral">
              {t.stop.food[k]}
            </li>
          ))}
        </ul>
      )}
      {menu && (
        <p className="stop__dish">
          <b>{t.stop.tryDish}:</b> <span lang={menu.translated ? undefined : "en"}>{menu.text}</span>
        </p>
      )}
      {allergens && (
        <p className="stop__dish">
          <b>{t.stop.allergens}:</b> <span lang={allergens.translated ? undefined : "en"}>{allergens.text}</span>
        </p>
      )}
    </div>
  );
}

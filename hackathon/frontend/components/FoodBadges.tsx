import type { FoodOptions } from "@/lib/types";

const BADGES: { key: keyof FoodOptions; label: string }[] = [
  { key: "solo_ok", label: "Solo OK" },
  { key: "vegan", label: "Vegan" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "halal", label: "Halal" },
  { key: "english_menu", label: "English menu" },
];

// US-06: only `true` values become badges; no food_options -> no badge area at all.
export function FoodBadges({ food }: { food: FoodOptions | null }) {
  if (!food) return null;
  const on = BADGES.filter((b) => food[b.key] === true);
  return (
    <div className="mt-2">
      {on.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {on.map((b) => (
            <span
              key={b.key}
              className="rounded-full bg-tangerine-soft text-[#a4520a] border border-[#f6c99a] px-2 py-0.5 text-xs font-medium"
            >
              {b.label}
            </span>
          ))}
        </div>
      )}
      {food.signature_menu_en && <p className="mt-1.5 text-sm text-ink">Try: {food.signature_menu_en}</p>}
    </div>
  );
}

import type { Category } from "@/lib/types";

// 7.5 — one icon set shared by map markers and timeline cards.
export const CATEGORY_META: Record<Category, { icon: string; label: string; color: string }> = {
  nature: { icon: "🌳", label: "Nature", color: "#4f7d3a" },
  market: { icon: "🏪", label: "Market", color: "#c0582b" },
  cafe: { icon: "☕", label: "Café", color: "#8a5a3b" },
  food: { icon: "🥢", label: "Food", color: "#d9822b" },
  culture: { icon: "🏯", label: "Culture", color: "#6b4c9a" },
  photo: { icon: "📷", label: "Photo spot", color: "#1f7a8c" },
};

export function CategoryIcon({ category, size = 28 }: { category: Category; size?: number }) {
  const m = CATEGORY_META[category];
  return (
    <span
      aria-label={m.label}
      title={m.label}
      className="inline-flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: m.color, fontSize: size * 0.55, lineHeight: 1 }}
    >
      <span aria-hidden>{m.icon}</span>
    </span>
  );
}

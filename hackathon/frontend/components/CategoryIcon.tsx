import type { Category } from "@/lib/types";

// Existing map marker metadata is intentionally retained, including its colors.
export const CATEGORY_META: Record<Category, { icon: string; label: string; color: string }> = {
  nature: { icon: "🌳", label: "Nature", color: "#4f7d3a" },
  market: { icon: "🏪", label: "Market", color: "#c0582b" },
  cafe: { icon: "☕", label: "Café", color: "#8a5a3b" },
  food: { icon: "🥢", label: "Food", color: "#d9822b" },
  culture: { icon: "🏯", label: "Culture", color: "#6b4c9a" },
  photo: { icon: "📷", label: "Photo spot", color: "#1f7a8c" },
};

export function CategoryIcon({ category, size = 38 }: { category: Category; size?: number }) {
  const meta = CATEGORY_META[category];
  return (
    <span title={meta.label} aria-label={meta.label} className={`category-icon category-icon--${category}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={Math.round(size * .53)} height={Math.round(size * .53)} aria-hidden="true">
        {category === "food" && <><circle cx="12" cy="12" r="6.5"/><path d="M3 3v8M6 3v8M9 3v8M6 11v10M19 3v18M19 3c-3 4-3 7 0 9"/></>}
        {category === "cafe" && <><path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM16 9h2a3 3 0 0 1 0 6h-2M4 22h15"/><path d="M8 3v2m4-2v2"/></>}
        {category === "nature" && <><path d="M12 21V11M12 15C3 15 3 5 6 3c6 1 8 4 6 12ZM12 17c1-7 5-10 9-11 2 7-1 11-9 11Z"/></>}
        {category === "market" && <><path d="M3 10h18M5 10v11h14V10M3 10l2-6h14l2 6M9 21v-7h6v7M6 10V8m6 2V8m6 2V8"/></>}
        {category === "culture" && <><path d="m3 9 9-5 9 5M5 10h14M6 20h12M8 12v6m4-6v6m4-6v6M3 21h18"/></>}
        {category === "photo" && <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6 9 4h6l1 2"/><circle cx="12" cy="13" r="4"/></>}
      </svg>
    </span>
  );
}

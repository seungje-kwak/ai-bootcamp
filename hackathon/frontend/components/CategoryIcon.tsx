import type { Category } from "@/lib/types";
import { CATEGORY_ICON, Icon } from "./Icon";

// 7.5: one icon per category, shared by cards, chips and photo placeholders.
export function CategoryIcon({ category, size = 16 }: { category: Category; size?: number }) {
  return <Icon name={CATEGORY_ICON[category]} size={size} />;
}

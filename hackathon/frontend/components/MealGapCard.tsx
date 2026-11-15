import type { CourseItem, MealGap } from "@/lib/types";
import { CategoryIcon } from "./CategoryIcon";

// prd-recommendation-p1 US-P07: a meal time we kept free. Not a stop: no photo, no badges, no driver card,
// no map marker and no move. The dashed border says "time kept free", not "a place to go".
export function MealGapCard({ gap, compact = false }: { gap: MealGap; compact?: boolean }) {
  const title = `Free time for ${gap.meal}`;
  const time = `${gap.start_time}–${gap.end_time}`;
  if (compact) {
    return (
      <div className="flex items-start gap-3 rounded-xl border-2 border-dashed border-line bg-sand/50 px-3 py-2.5">
        <span className="w-12 shrink-0 font-semibold tabular-nums">{gap.start_time}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted">{gap.message_en}</p>
        </div>
      </div>
    );
  }
  return (
    <article aria-label={title} className="rounded-2xl border-2 border-dashed border-line bg-sand/50 p-4">
      <div className="flex items-start gap-2.5">
        <CategoryIcon category="food" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-tight">{title}</h3>
          <p className="text-sm font-semibold text-muted tabular-nums">{time}</p>
        </div>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed">{gap.message_en}</p>
    </article>
  );
}

export type TimelineEntry = { kind: "stop"; item: CourseItem } | { kind: "gap"; gap: MealGap };

// Stops and free meal times in start_time order. A free time goes right before the first stop that starts
// after it ("HH:MM" strings compare in time order).
export function withMealGaps(items: CourseItem[], gaps: MealGap[] = []): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const rest = [...gaps].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (const item of items) {
    while (rest.length && rest[0].start_time < item.start_time) out.push({ kind: "gap", gap: rest.shift()! });
    out.push({ kind: "stop", item });
  }
  return out.concat(rest.map((gap) => ({ kind: "gap" as const, gap })));
}

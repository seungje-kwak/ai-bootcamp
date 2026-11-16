"use client";

import { type Messages, useLocale } from "@/lib/i18n";
import type { CourseItem, MealGap } from "@/lib/types";
import { Icon } from "./Icon";

// prd-recommendation-p1 US-P07: a meal time we kept free. Not a stop: no photo, no badges, no driver card,
// no map marker and no move. The dashed border says "time kept free", not "a place to go".

function gapText(C: Messages["course"], gap: MealGap) {
  const meal = C.meals[gap.meal];
  const body =
    gap.reason === "no_diet_match"
      ? C.gapNoDiet(gap.start_time, gap.end_time, meal)
      : C.gapNoneNearby(gap.start_time, gap.end_time, meal);
  return { title: C.mealGap(meal), body };
}

/** Timeline card on the course page. */
export function MealGapCard({ gap }: { gap: MealGap }) {
  const { t } = useLocale();
  const { title, body } = gapText(t.course, gap);
  return (
    <article
      aria-label={title}
      className="my-3 border-2 border-dashed border-line-strong bg-sand p-4"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <div className="flex items-start gap-2.5">
        <span className="stop-no" aria-hidden="true" style={{ background: "var(--paper)", color: "var(--muted)" }}>
          <Icon name="food" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{title}</h3>
          <p className="text-sm font-semibold text-muted tabular-nums">{t.stop.timeRange(gap.start_time, gap.end_time)}</p>
        </div>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed">{body}</p>
    </article>
  );
}

/** Row in the trip screen's "Up next" list (same grid as a stop row: icon, time, text). */
export function MealGapRow({ gap }: { gap: MealGap }) {
  const { t } = useLocale();
  const { title, body } = gapText(t.course, gap);
  return (
    <li aria-label={title}>
      <span className="stop-no" aria-hidden="true" style={{ background: "var(--paper)", color: "var(--muted)", border: "1px dashed var(--line-strong)" }}>
        <Icon name="food" size={14} />
      </span>
      <time>{gap.start_time}</time>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <small>{body}</small>
      </div>
    </li>
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

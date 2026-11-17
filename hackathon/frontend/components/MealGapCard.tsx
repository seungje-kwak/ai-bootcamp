"use client";

import { MESSAGES, useLocale, type Locale } from "@/lib/i18n";
import type { CourseItem, MealGap } from "@/lib/types";
import { CategoryIcon } from "./CategoryIcon";

// prd-recommendation-p1 US-P07: a meal time kept free because no restaurant fits. Not a stop:
// no photo, no badges, no driver card, no map marker and no move. The dashed border says "time kept free".

function gapText(locale: Locale, gap: MealGap) {
  const C = MESSAGES[locale].course;
  const meal = C.meals[gap.meal];
  // English shows the server's message verbatim (PRD R27); other languages use the reviewed copy.
  const body =
    locale === "en" && gap.message_en
      ? gap.message_en
      : gap.reason === "no_diet_match"
        ? C.gapNoDiet(gap.start_time, gap.end_time, meal)
        : C.gapNoneNearby(gap.start_time, gap.end_time, meal);
  return { title: C.mealGap(meal), body };
}

/** Timeline card on the course page. */
export function MealGapCard({ gap }: { gap: MealGap }) {
  const { locale } = useLocale();
  const { title, body } = gapText(locale, gap);
  return (
    <article aria-label={title} className="meal-gap">
      <div className="meal-gap__head">
        <CategoryIcon category="food" size={38} />
        <div className="min-w-0">
          <h3>{title}</h3>
          <p className="meal-gap__time">
            {gap.start_time}–{gap.end_time}
          </p>
        </div>
      </div>
      <p className="meal-gap__body">{body}</p>
    </article>
  );
}

/** Row in the trip screen's "Up next" list. */
export function MealGapRow({ gap }: { gap: MealGap }) {
  const { locale } = useLocale();
  const { title, body } = gapText(locale, gap);
  return (
    <li aria-label={title} className="meal-gap-row flex items-start gap-3 px-4 py-3">
      <span className="w-12 shrink-0 font-semibold tabular-nums">{gap.start_time}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted">{body}</p>
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

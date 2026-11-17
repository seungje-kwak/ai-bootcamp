"use client";

import { MESSAGES, useLocale } from "@/lib/i18n";
import { courseSpan, courseWindow, toMinutes } from "@/lib/time";
import type { Course } from "@/lib/types";

// The day the traveler asked for comes back with the course (user_profile.start_time / end_time),
// so this works on any device and for shuffled courses. The free time after the last stop is only
// known when the whole course is visible.
export function WindowSummary({ course }: { course: Course }) {
  const { locale } = useLocale();
  const C = MESSAGES[locale].course;
  const common = MESSAGES[locale].common;
  const win = courseWindow(course.user_profile, course.items[0]?.start_time);
  if (!win) return null;
  const span = courseSpan(course.items);
  const available = toMinutes(win.end) - toMinutes(win.start);
  const full = course.tier !== "free" && course.locked_count === 0;
  const spare = span && full ? toMinutes(win.end) - toMinutes(span.end) : 0;
  return (
    <div className="gpt-window-banner">
      <span className="gpt-window-icon" aria-hidden="true">
        ◷
      </span>
      <div>
        <strong>
          {win.start} — {win.end} <span style={{ fontWeight: 500, fontSize: 12 }}>KST</span>
        </strong>
        <small>
          {C.yourWindow(win.start, win.end)} {C.planLength(common.duration(available))}
          {spare >= 10 ? ` · ${C.freeAfter(common.duration(spare))}` : ""}
        </small>
      </div>
    </div>
  );
}

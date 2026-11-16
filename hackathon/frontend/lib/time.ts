// Clock helpers. Every "HH:MM" in the app is Jeju local time (KST, UTC+9, no daylight saving),
// the same convention the planner uses for start_time.
import type { CourseItem, UserProfileInput } from "./types";

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const addMinutes = (hhmm: string, minutes: number): string => toHHMM(toMinutes(hhmm) + minutes);

const KST_OFFSET_MIN = 9 * 60;

/** Minutes since midnight in Jeju right now, whatever time zone the phone is set to. */
export function nowInJejuMinutes(now: Date = new Date()): number {
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utc + KST_OFFSET_MIN) % 1440;
}

export const ceilTo = (minutes: number, step: number): number => Math.ceil(minutes / step) * step;

/** Plan lengths the course API can build today: `duration` is half_day or full_day only. */
export const PLAN_MINUTES: Record<UserProfileInput["duration"], number> = { half_day: 240, full_day: 480 };
export const SHORTEST_PLAN_MIN = PLAN_MINUTES.half_day;
export const EARLIEST_START = 6 * 60;
export const LATEST_END = 23 * 60 + 30;

export type PlanChoice = { duration: UserProfileInput["duration"]; planMin: number; spareMin: number };

/** The longest plan the server offers that still fits inside the traveler's window. */
export function planForWindow(windowMin: number): PlanChoice | null {
  if (windowMin < SHORTEST_PLAN_MIN) return null;
  const duration = windowMin >= PLAN_MINUTES.full_day ? "full_day" : "half_day";
  return { duration, planMin: PLAN_MINUTES[duration], spareMin: windowMin - PLAN_MINUTES[duration] };
}

/** Start of the first stop and end of the last visible stop. */
export function courseSpan(items: Pick<CourseItem, "start_time" | "stay_min">[]): { start: string; end: string } | null {
  if (!items.length) return null;
  const last = items[items.length - 1];
  return { start: items[0].start_time, end: addMinutes(last.start_time, last.stay_min) };
}

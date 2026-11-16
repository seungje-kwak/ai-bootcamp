// Clock helpers. Every "HH:MM" in the app is Jeju local time (KST, UTC+9, no daylight saving),
// the same convention the planner uses for start_time.
import { TRIP_TIME } from "./tripTime";
import type { CourseItem, UserProfile } from "./types";

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

/** Why a start/end pair can't be sent: same rules as backend/app/planner.py check_time_window. */
export type WindowError = "errOrder" | "errStart" | "errEnd" | "errShort" | "errLong";
export function windowError(start: number, end: number): WindowError | null {
  if (end <= start) return "errOrder";
  if (start < TRIP_TIME.minStart || start > TRIP_TIME.maxStart) return "errStart";
  if (end > TRIP_TIME.maxEnd) return "errEnd";
  if (end - start < TRIP_TIME.minLength) return "errShort";
  if (end - start > TRIP_TIME.maxLength) return "errLong";
  return null;
}

/** Plan lengths of courses saved before the trip-time change (they have `duration`, no times). */
const LEGACY_PLAN_MINUTES = { half_day: 240, full_day: 480 } as const;

/** The day the traveler asked for. Older courses only know their length, so they start at the first stop. */
export function courseWindow(
  profile: Pick<UserProfile, "start_time" | "end_time" | "duration">,
  firstStart: string | undefined,
): { start: string; end: string } | null {
  if (profile.start_time && profile.end_time) return { start: profile.start_time, end: profile.end_time };
  if (profile.duration && firstStart) return { start: firstStart, end: addMinutes(firstStart, LEGACY_PLAN_MINUTES[profile.duration]) };
  return null;
}

/** Start of the first stop and end of the last visible stop. */
export function courseSpan(items: Pick<CourseItem, "start_time" | "stay_min">[]): { start: string; end: string } | null {
  if (!items.length) return null;
  const last = items[items.length - 1];
  return { start: items[0].start_time, end: addMinutes(last.start_time, last.stay_min) };
}

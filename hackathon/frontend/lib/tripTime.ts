// Trip time window for onboarding step 5 (tasks/prd-trip-time.md US-T05).
// Same limits as backend/app/config.py: MIN_START, MAX_START, MAX_END, MIN_TRIP_MIN, MAX_TRIP_MIN, TIME_STEP_MIN.
export const TRIP_TIME = {
  minStart: 8 * 60,
  maxStart: 16 * 60,
  maxEnd: 22 * 60,
  minLength: 120,
  maxLength: 600,
  step: 30,
  defaultLength: 240,
  fallbackStart: 10 * 60, // opened after the last start time: offer a 10:00 start
};

export function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let m = from; m <= to; m += TRIP_TIME.step) out.push(m);
  return out;
}

export function startOptions(): number[] {
  return range(TRIP_TIME.minStart, TRIP_TIME.maxStart);
}

/** Latest end for a start: start + 10 h or 22:00, whichever comes first. */
export function latestEnd(start: number): number {
  return Math.min(start + TRIP_TIME.maxLength, TRIP_TIME.maxEnd);
}

export function endOptions(start: number): number[] {
  return range(start + TRIP_TIME.minLength, latestEnd(start));
}

/** Start + 4 h, capped at the latest end. */
export function defaultEnd(start: number): number {
  return Math.min(start + TRIP_TIME.defaultLength, latestEnd(start));
}

/** Now rounded up to the half hour (14:10 -> 14:30). Before 08:00 -> 08:00, after 16:00 -> 10:00. */
export function defaultStart(now: Date): number {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(nowMin / TRIP_TIME.step) * TRIP_TIME.step;
  if (rounded < TRIP_TIME.minStart) return TRIP_TIME.minStart;
  if (rounded > TRIP_TIME.maxStart) return TRIP_TIME.fallbackStart;
  return rounded;
}

/** Keep the end when it is still allowed for the new start, otherwise start + 4 h (capped). */
export function endForStart(start: number, end: number): number {
  return endOptions(start).includes(end) ? end : defaultEnd(start);
}

/** "4 h 30 min", "4 h" */
export function lengthLabel(start: number, end: number): string {
  const total = end - start;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

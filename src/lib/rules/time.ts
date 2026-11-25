/**
 * Calendar helpers pinned to the gym's time zone.
 *
 * The pilot gym is in Asia/Manila (UTC+8, no daylight saving time), so a
 * fixed offset is exact. Every rule in this folder uses these helpers: never
 * call `getDay()` / `getDate()` on a raw Date, because those use the time zone
 * of whatever machine runs the code (UTC on Vercel and in CI).
 */

export const GYM_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar date in the gym's time zone, as `YYYY-MM-DD`. */
export type DayKey = string;
/** The Monday that starts a Monday-to-Sunday week, as `YYYY-MM-DD`. */
export type WeekKey = string;

/** Shifts an instant so its UTC fields read as Manila wall-clock time. */
function toManilaWallClock(at: Date): Date {
  return new Date(at.getTime() + MANILA_OFFSET_MS);
}

function formatUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The Manila calendar day an instant falls on. */
export function dayKey(at: Date): DayKey {
  return formatUtcDate(toManilaWallClock(at));
}

/** The Monday (Manila time) of the week an instant falls in. */
export function weekKey(at: Date): WeekKey {
  return weekKeyOfDay(dayKey(at));
}

/** The Monday of the week that contains a given day. */
export function weekKeyOfDay(day: DayKey): WeekKey {
  const d = parseDay(day);
  // getUTCDay: 0 = Sunday ... 6 = Saturday. Days since Monday:
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return formatUtcDate(new Date(d.getTime() - sinceMonday * DAY_MS));
}

/** Adds whole weeks to a week key (negative to go back). */
export function addWeeks(week: WeekKey, weeks: number): WeekKey {
  return formatUtcDate(new Date(parseDay(week).getTime() + weeks * 7 * DAY_MS));
}

/** `YYYY-MM` of the Manila month an instant falls in. */
export function monthKey(at: Date): string {
  return dayKey(at).slice(0, 7);
}

function parseDay(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Expected YYYY-MM-DD, got "${day}"`);
  }
  return new Date(`${day}T00:00:00Z`);
}

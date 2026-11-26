import { countedDays, type CheckInRecord } from "./checkin";
import { addWeeks, weekKey, weekKeyOfDay, type WeekKey } from "./time";

export const DEFAULT_WEEKLY_TARGET = 3;
export const MIN_WEEKLY_TARGET = 2;
export const MAX_WEEKLY_TARGET = 4;

export interface StreakInput {
  checkIns: readonly CheckInRecord[];
  /** Sessions per week the member aims for (2 to 4, default 3). */
  weeklyTarget: number;
  /** Mondays of weeks the gym marked as closed (Holy Week, Christmas). */
  closureWeeks?: readonly WeekKey[];
  /** When the member joined; their first week can't break the streak. */
  joinedAt: Date;
  now: Date;
}

/** Counted sessions per week, keyed by the week's Monday. */
export function sessionsByWeek(
  checkIns: readonly CheckInRecord[],
): Map<WeekKey, number> {
  const weeks = new Map<WeekKey, number>();
  for (const day of countedDays(checkIns)) {
    const w = weekKeyOfDay(day);
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  return weeks;
}

/** "2 of 3 this week" for the member home screen. */
export function weeklyProgress(input: {
  checkIns: readonly CheckInRecord[];
  weeklyTarget: number;
  now: Date;
}): { done: number; target: number; met: boolean } {
  const done = sessionsByWeek(input.checkIns).get(weekKey(input.now)) ?? 0;
  const target = clampTarget(input.weeklyTarget);
  return { done, target, met: done >= target };
}

/**
 * Streak = consecutive weeks (Monday to Sunday, Manila time) with the weekly
 * target met. Computed from check-ins every time; never stored.
 *
 * Walking back from the current week:
 * - The current week adds 1 once the target is met, and never breaks the
 *   streak while it is still in progress.
 * - A closure week is skipped: it neither adds to nor breaks the streak.
 * - The member's first (usually partial) week adds 1 if met and is skipped
 *   if not, so joining on a Friday doesn't cost anything.
 * - Any other week below target ends the streak.
 */
export function currentStreak(input: StreakInput): number {
  const target = clampTarget(input.weeklyTarget);
  const perWeek = sessionsByWeek(input.checkIns);
  const closed = new Set(input.closureWeeks ?? []);
  const thisWeek = weekKey(input.now);
  const firstWeek = weekKey(input.joinedAt);

  let streak = 0;
  for (let w = thisWeek; w >= firstWeek; w = addWeeks(w, -1)) {
    const met = (perWeek.get(w) ?? 0) >= target;
    if (met) {
      streak += 1;
    } else if (w === thisWeek || w === firstWeek || closed.has(w)) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Keeps a stored weekly target inside the allowed 2 to 4 range. */
export function clampTarget(target: number): number {
  if (!Number.isFinite(target)) return DEFAULT_WEEKLY_TARGET;
  return Math.min(MAX_WEEKLY_TARGET, Math.max(MIN_WEEKLY_TARGET, Math.round(target)));
}

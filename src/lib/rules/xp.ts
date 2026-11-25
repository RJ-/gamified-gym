import { countedDays, type CheckInRecord } from "./checkin";
import { clampTarget, sessionsByWeek } from "./streak";
import { weekKey, type DayKey, type WeekKey } from "./time";

export const XP_PER_CHECK_IN = 50;
export const XP_WEEKLY_TARGET_BONUS = 150;
export const XP_PER_LEVEL = 500;

/**
 * One row to write to `xp_ledger`. `(kind, ref)` is unique per member, so
 * writing the same entry twice is a no-op: every job that grants XP can be
 * re-run safely.
 */
export interface XpEntry {
  kind: "check_in" | "weekly_bonus";
  /** The day (check-in) or week Monday (weekly bonus) the XP is for. */
  ref: DayKey | WeekKey;
  amount: number;
}

/** +50 XP for each counted day. */
export function checkInXp(checkIns: readonly CheckInRecord[]): XpEntry[] {
  return countedDays(checkIns).map((day) => ({
    kind: "check_in",
    ref: day,
    amount: XP_PER_CHECK_IN,
  }));
}

/**
 * Weekly bonuses owed: +150 XP for every finished week (before the current
 * one) where the member met their target, minus weeks already granted.
 * The Monday 00:05 job calls this; running it twice grants nothing new.
 */
export function weeklyBonusesDue(input: {
  checkIns: readonly CheckInRecord[];
  weeklyTarget: number;
  alreadyGranted: readonly WeekKey[];
  now: Date;
}): XpEntry[] {
  const target = clampTarget(input.weeklyTarget);
  const thisWeek = weekKey(input.now);
  const granted = new Set(input.alreadyGranted);
  const due: XpEntry[] = [];
  for (const [week, sessions] of [...sessionsByWeek(input.checkIns)].sort()) {
    if (week < thisWeek && sessions >= target && !granted.has(week)) {
      due.push({ kind: "weekly_bonus", ref: week, amount: XP_WEEKLY_TARGET_BONUS });
    }
  }
  return due;
}

/** Level from total XP: level 1 at 0 XP, a new level every 500 XP. */
export function levelFor(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
} {
  const xp = Math.max(0, Math.floor(totalXp));
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpIntoLevel: xp % XP_PER_LEVEL,
    xpForNextLevel: XP_PER_LEVEL - (xp % XP_PER_LEVEL),
  };
}

/** Sum of ledger amounts (adjustments can be negative). */
export function totalXp(entries: readonly { amount: number }[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

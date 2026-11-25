import { dayKey, type DayKey } from "./time";

/** The parts of a check-in row the rules need. */
export interface CheckInRecord {
  /** When the member checked in (for offline scans: when they scanned). */
  at: Date;
  /** Set when staff voided the check-in; voided rows never count. */
  voided?: boolean;
}

export type MemberStatus = "pending" | "active" | "deactivated";

export type CheckInDecision =
  /** Counts toward XP, weekly target and streak. */
  | { outcome: "counted"; day: DayKey }
  /** Recorded, but the member already has a counted check-in that day. */
  | { outcome: "already_counted_today"; day: DayKey }
  /** Rejected: staff have not approved this member, or deactivated them. */
  | { outcome: "not_active"; status: MemberStatus };

/**
 * Rule: one counted session per calendar day, Asia/Manila time.
 *
 * Extra scans on the same day are still recorded (useful for staff and
 * metrics) but earn nothing. A voided check-in frees the day again.
 */
export function decideCheckIn(input: {
  status: MemberStatus;
  at: Date;
  existing: readonly CheckInRecord[];
}): CheckInDecision {
  if (input.status !== "active") {
    return { outcome: "not_active", status: input.status };
  }
  const day = dayKey(input.at);
  const taken = input.existing.some((c) => !c.voided && dayKey(c.at) === day);
  return taken
    ? { outcome: "already_counted_today", day }
    : { outcome: "counted", day };
}

/** The distinct Manila days with at least one non-voided check-in, sorted. */
export function countedDays(checkIns: readonly CheckInRecord[]): DayKey[] {
  const days = new Set<DayKey>();
  for (const c of checkIns) {
    if (!c.voided) days.add(dayKey(c.at));
  }
  return [...days].sort();
}

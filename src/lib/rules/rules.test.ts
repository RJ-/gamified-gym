import { describe, expect, it } from "vitest";
import {
  addWeeks,
  checkInXp,
  clampTarget,
  countedDays,
  currentStreak,
  dayKey,
  decideCheckIn,
  levelFor,
  monthKey,
  totalXp,
  weekKey,
  weeklyBonusesDue,
  weeklyProgress,
  type CheckInRecord,
} from "./index";

/** An instant written as Manila wall-clock time. */
const mnl = (local: string) => new Date(`${local}+08:00`);
const at = (...locals: string[]): CheckInRecord[] =>
  locals.map((l) => ({ at: mnl(l) }));

// Reference calendar (Manila): Mon 2026-11-23 .. Sun 2026-11-29.
const MON = "2026-11-23";

describe("time helpers (Asia/Manila)", () => {
  it.each([
    ["2026-11-23T00:00:00", "2026-11-23"],
    ["2026-11-23T07:59:59", "2026-11-23"], // still the 22nd in UTC
    ["2026-11-22T23:59:59", "2026-11-22"],
    ["2026-12-31T23:59:59", "2026-12-31"],
    ["2027-01-01T00:00:00", "2027-01-01"],
  ])("dayKey(%s) = %s", (local, expected) => {
    expect(dayKey(mnl(local))).toBe(expected);
  });

  it("agrees with Intl for the Asia/Manila zone", () => {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
    for (let h = 0; h < 48; h += 1) {
      const d = new Date(Date.UTC(2026, 10, 22, h, 30));
      expect(dayKey(d)).toBe(fmt.format(d));
    }
  });

  it.each([
    ["2026-11-23T00:00:00", MON], // Monday midnight starts the week
    ["2026-11-29T23:59:59", MON], // Sunday 11:59 PM is still the same week
    ["2026-11-30T00:00:00", "2026-11-30"], // next Monday
    ["2026-11-22T23:59:59", "2026-11-16"], // previous Sunday
    ["2027-01-01T12:00:00", "2026-12-28"], // week spanning the new year
  ])("weekKey(%s) = %s", (local, expected) => {
    expect(weekKey(mnl(local))).toBe(expected);
  });

  it("addWeeks moves by whole weeks across months and years", () => {
    expect(addWeeks(MON, 1)).toBe("2026-11-30");
    expect(addWeeks(MON, -1)).toBe("2026-11-16");
    expect(addWeeks("2026-12-28", 1)).toBe("2027-01-04");
  });

  it("monthKey uses Manila time", () => {
    expect(monthKey(mnl("2026-12-01T00:30:00"))).toBe("2026-12");
  });
});

describe("decideCheckIn: one counted session per calendar day", () => {
  it("counts the first check-in of the day", () => {
    expect(
      decideCheckIn({ status: "active", at: mnl(`${MON}T06:00:00`), existing: [] }),
    ).toEqual({ outcome: "counted", day: MON });
  });

  it("records but does not count a second scan the same day", () => {
    const existing = at(`${MON}T06:00:00`);
    expect(
      decideCheckIn({ status: "active", at: mnl(`${MON}T19:00:00`), existing }),
    ).toEqual({ outcome: "already_counted_today", day: MON });
  });

  it("allows 6 PM then 5 AM next day (the old 12-hour rule would block it)", () => {
    const existing = at(`${MON}T18:00:00`);
    expect(
      decideCheckIn({ status: "active", at: mnl("2026-11-24T05:00:00"), existing })
        .outcome,
    ).toBe("counted");
  });

  it("splits days at Manila midnight, not UTC midnight", () => {
    const existing = at(`${MON}T23:59:00`);
    expect(
      decideCheckIn({ status: "active", at: mnl("2026-11-24T00:01:00"), existing })
        .outcome,
    ).toBe("counted");
    // 07:00 and 09:00 Manila straddle UTC midnight but are the same Manila day.
    expect(
      decideCheckIn({
        status: "active",
        at: mnl(`${MON}T09:00:00`),
        existing: at(`${MON}T07:00:00`),
      }).outcome,
    ).toBe("already_counted_today");
  });

  it("frees the day again when the earlier check-in was voided", () => {
    const existing = [{ at: mnl(`${MON}T06:00:00`), voided: true }];
    expect(
      decideCheckIn({ status: "active", at: mnl(`${MON}T08:00:00`), existing })
        .outcome,
    ).toBe("counted");
  });

  it.each(["pending", "deactivated"] as const)("rejects %s members", (status) => {
    expect(
      decideCheckIn({ status, at: mnl(`${MON}T06:00:00`), existing: [] }),
    ).toEqual({ outcome: "not_active", status });
  });

  it("countedDays de-duplicates per day and ignores voided rows", () => {
    expect(
      countedDays([
        ...at(`${MON}T06:00:00`, `${MON}T20:00:00`, "2026-11-25T07:00:00"),
        { at: mnl("2026-11-26T07:00:00"), voided: true },
      ]),
    ).toEqual([MON, "2026-11-25"]);
  });
});

describe("weeklyProgress", () => {
  it('shows "2 of 3 this week"', () => {
    const checkIns = at(`${MON}T06:00:00`, "2026-11-25T06:00:00", "2026-11-25T18:00:00");
    expect(
      weeklyProgress({ checkIns, weeklyTarget: 3, now: mnl("2026-11-26T10:00:00") }),
    ).toEqual({ done: 2, target: 3, met: false });
  });

  it("counts a Sunday 11:59 PM check-in in that week, not the next", () => {
    const checkIns = at(`${MON}T06:00:00`, "2026-11-25T06:00:00", "2026-11-29T23:59:00");
    expect(
      weeklyProgress({ checkIns, weeklyTarget: 3, now: mnl("2026-11-29T23:59:30") }),
    ).toEqual({ done: 3, target: 3, met: true });
    expect(
      weeklyProgress({ checkIns, weeklyTarget: 3, now: mnl("2026-11-30T00:00:00") })
        .done,
    ).toBe(0);
  });

  it("keeps the target between 2 and 4", () => {
    expect(clampTarget(1)).toBe(2);
    expect(clampTarget(7)).toBe(4);
    expect(clampTarget(Number.NaN)).toBe(3);
  });
});

/** Three counted sessions (Mon, Wed, Fri) in the week starting `monday`. */
const fullWeek = (monday: string): CheckInRecord[] => {
  const d = new Date(`${monday}T00:00:00Z`);
  return [0, 2, 4].map((offset) => {
    const day = new Date(d.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    return { at: mnl(`${day}T07:00:00`) };
  });
};

describe("currentStreak: consecutive weeks with the target met", () => {
  const joinedAt = mnl("2026-10-01T09:00:00"); // a Thursday, weeks before

  it("is 0 with no check-ins", () => {
    expect(
      currentStreak({ checkIns: [], weeklyTarget: 3, joinedAt, now: mnl(`${MON}T09:00:00`) }),
    ).toBe(0);
  });

  it("counts finished weeks and doesn't break on an in-progress week", () => {
    const checkIns = [...fullWeek("2026-11-09"), ...fullWeek("2026-11-16")];
    // Wednesday of the current week, nothing yet this week: streak holds at 2.
    expect(
      currentStreak({ checkIns, weeklyTarget: 3, joinedAt, now: mnl("2026-11-25T09:00:00") }),
    ).toBe(2);
    // Meeting this week's target adds it immediately.
    expect(
      currentStreak({
        checkIns: [...checkIns, ...fullWeek(MON)],
        weeklyTarget: 3,
        joinedAt,
        now: mnl("2026-11-27T09:00:00"),
      }),
    ).toBe(3);
  });

  it("breaks on a missed finished week", () => {
    const checkIns = [...fullWeek("2026-11-02"), ...fullWeek("2026-11-16")];
    expect(
      currentStreak({ checkIns, weeklyTarget: 3, joinedAt, now: mnl("2026-11-25T09:00:00") }),
    ).toBe(1);
  });

  it("breaks once the week ends below target (Monday 00:00)", () => {
    const checkIns = [...fullWeek("2026-11-16"), ...at(`${MON}T07:00:00`)];
    expect(
      currentStreak({ checkIns, weeklyTarget: 3, joinedAt, now: mnl("2026-11-29T23:59:00") }),
    ).toBe(1);
    expect(
      currentStreak({ checkIns, weeklyTarget: 3, joinedAt, now: mnl("2026-11-30T00:00:00") }),
    ).toBe(0);
  });

  it("skips closure weeks without breaking or adding", () => {
    const checkIns = [...fullWeek("2026-11-02"), ...fullWeek("2026-11-16")];
    expect(
      currentStreak({
        checkIns,
        weeklyTarget: 3,
        closureWeeks: ["2026-11-09"],
        joinedAt,
        now: mnl("2026-11-25T09:00:00"),
      }),
    ).toBe(2);
  });

  it("still counts a closure week if the member met the target anyway", () => {
    const checkIns = [...fullWeek("2026-11-09"), ...fullWeek("2026-11-16")];
    expect(
      currentStreak({
        checkIns,
        weeklyTarget: 3,
        closureWeeks: ["2026-11-09"],
        joinedAt,
        now: mnl("2026-11-25T09:00:00"),
      }),
    ).toBe(2);
  });

  it("doesn't let a partial first week break the streak", () => {
    // Joined Saturday 2026-11-14: one session that week, then a full week.
    const checkIns = [...at("2026-11-14T08:00:00"), ...fullWeek("2026-11-16")];
    expect(
      currentStreak({
        checkIns,
        weeklyTarget: 3,
        joinedAt: mnl("2026-11-14T07:00:00"),
        now: mnl("2026-11-25T09:00:00"),
      }),
    ).toBe(1);
  });

  it("uses the member's own target", () => {
    const twoAWeek = [
      ...at("2026-11-10T07:00:00", "2026-11-12T07:00:00"),
      ...at("2026-11-17T07:00:00", "2026-11-19T07:00:00"),
    ];
    const now = mnl("2026-11-25T09:00:00");
    expect(currentStreak({ checkIns: twoAWeek, weeklyTarget: 2, joinedAt, now })).toBe(2);
    expect(currentStreak({ checkIns: twoAWeek, weeklyTarget: 3, joinedAt, now })).toBe(0);
  });

  it("ignores voided check-ins", () => {
    const week = fullWeek("2026-11-16");
    week[0] = { ...week[0], voided: true };
    expect(
      currentStreak({ checkIns: week, weeklyTarget: 3, joinedAt, now: mnl("2026-11-25T09:00:00") }),
    ).toBe(0);
  });
});

describe("XP", () => {
  it("gives +50 per counted day, not per scan", () => {
    const entries = checkInXp([
      ...at(`${MON}T06:00:00`, `${MON}T19:00:00`, "2026-11-24T06:00:00"),
      { at: mnl("2026-11-25T06:00:00"), voided: true },
    ]);
    expect(entries).toEqual([
      { kind: "check_in", ref: MON, amount: 50 },
      { kind: "check_in", ref: "2026-11-24", amount: 50 },
    ]);
  });

  it("grants the weekly bonus only for finished weeks that met the target", () => {
    const checkIns = [
      ...fullWeek("2026-11-09"),
      ...at("2026-11-17T07:00:00"), // missed week
      ...fullWeek(MON), // current week, already met
    ];
    expect(
      weeklyBonusesDue({
        checkIns,
        weeklyTarget: 3,
        alreadyGranted: [],
        now: mnl("2026-11-27T09:00:00"),
      }),
    ).toEqual([{ kind: "weekly_bonus", ref: "2026-11-09", amount: 150 }]);
  });

  it("Monday 00:05 job is safe to run twice", () => {
    const checkIns = fullWeek(MON);
    const now = mnl("2026-11-30T00:05:00");
    const first = weeklyBonusesDue({ checkIns, weeklyTarget: 3, alreadyGranted: [], now });
    expect(first).toEqual([{ kind: "weekly_bonus", ref: MON, amount: 150 }]);
    const second = weeklyBonusesDue({
      checkIns,
      weeklyTarget: 3,
      alreadyGranted: first.map((e) => e.ref),
      now,
    });
    expect(second).toEqual([]);
  });

  it("includes a Sunday 11:59 PM check-in in that week's bonus", () => {
    const checkIns = at(`${MON}T07:00:00`, "2026-11-25T07:00:00", "2026-11-29T23:59:00");
    expect(
      weeklyBonusesDue({
        checkIns,
        weeklyTarget: 3,
        alreadyGranted: [],
        now: mnl("2026-11-30T00:05:00"),
      }),
    ).toHaveLength(1);
  });

  it.each([
    [0, 1, 0, 500],
    [499, 1, 499, 1],
    [500, 2, 0, 500],
    [1234, 3, 234, 266],
    [-50, 1, 0, 500],
  ])("levelFor(%i) = level %i", (xp, level, into, next) => {
    expect(levelFor(xp)).toEqual({ level, xpIntoLevel: into, xpForNextLevel: next });
  });

  it("totalXp sums the ledger including negative adjustments", () => {
    expect(totalXp([{ amount: 50 }, { amount: 150 }, { amount: -50 }])).toBe(150);
  });
});

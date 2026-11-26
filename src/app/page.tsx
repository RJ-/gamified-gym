import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import {
  checkInXp,
  currentStreak,
  levelFor,
  totalXp,
  weeklyBonusesDue,
  weeklyProgress,
  type CheckInRecord,
} from "@/lib/rules";

// Week 1 preview: the member home drawn from SAMPLE data through the real
// rules engine. Sign-in arrives in week 2 and live data in week 4.
const mnl = (local: string) => new Date(`${local}+08:00`);
const SAMPLE_NOW = mnl("2026-11-26T18:00:00"); // a Thursday evening
const SAMPLE_JOINED = mnl("2026-11-02T07:00:00");
const SAMPLE_CHECK_INS: CheckInRecord[] = [
  "2026-11-02T07:00:00",
  "2026-11-04T07:10:00",
  "2026-11-06T18:30:00",
  "2026-11-09T06:45:00",
  "2026-11-11T19:00:00",
  "2026-11-14T09:00:00",
  "2026-11-16T07:00:00",
  "2026-11-18T07:05:00",
  "2026-11-20T18:00:00",
  "2026-11-23T06:50:00",
  "2026-11-25T19:15:00",
].map((l) => ({ at: mnl(l) }));
const WEEKLY_TARGET = 3;

export default function MemberHome() {
  const progress = weeklyProgress({
    checkIns: SAMPLE_CHECK_INS,
    weeklyTarget: WEEKLY_TARGET,
    now: SAMPLE_NOW,
  });
  const streak = currentStreak({
    checkIns: SAMPLE_CHECK_INS,
    weeklyTarget: WEEKLY_TARGET,
    joinedAt: SAMPLE_JOINED,
    now: SAMPLE_NOW,
  });
  const xp = totalXp([
    ...checkInXp(SAMPLE_CHECK_INS),
    ...weeklyBonusesDue({
      checkIns: SAMPLE_CHECK_INS,
      weeklyTarget: WEEKLY_TARGET,
      alreadyGranted: [],
      now: SAMPLE_NOW,
    }),
  ]);
  const level = levelFor(xp);

  return (
    <main className="page">
      <p className="eyebrow">{APP_NAME}</p>
      <h1>Hi, Jay</h1>

      <div className="card notice">
        Preview with sample data. Sign-in comes in week 2, scanning in week 3.
      </div>

      <div className="card">
        <p className="eyebrow">This week</p>
        <strong style={{ fontSize: 20 }}>
          {progress.done} of {progress.target} sessions
        </strong>
        <div className="dots" aria-hidden>
          {Array.from({ length: progress.target }, (_, i) => (
            <span key={i} className={`dot${i < progress.done ? " done" : ""}`} />
          ))}
        </div>
        <span className="muted" style={{ fontSize: 14 }}>
          {progress.met
            ? "Target met. Bonus +150 XP on Monday."
            : `${progress.target - progress.done} more by Sunday to keep your streak.`}
        </span>
      </div>

      <div className="card stat-row">
        <div className="stat">
          <strong>{streak}</strong>
          <span>week streak</span>
        </div>
        <div className="stat">
          <strong>{level.level}</strong>
          <span>level</span>
        </div>
        <div className="stat">
          <strong>{xp}</strong>
          <span>XP</span>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">Level {level.level + 1}</p>
        <div className="bar">
          <div style={{ width: `${(level.xpIntoLevel / 500) * 100}%` }} />
        </div>
        <p className="muted" style={{ fontSize: 14, margin: "8px 0 0" }}>
          {level.xpForNextLevel} XP to go
        </p>
      </div>

      <button className="button" disabled>
        Scan to check in
      </button>

      <nav className="nav">
        <Link href="/tv">TV screen</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}

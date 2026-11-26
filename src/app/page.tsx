import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { JoinForm } from "@/components/member-forms";
import { getViewer, isStaff, type Member } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import {
  currentStreak,
  levelFor,
  totalXp,
  weeklyProgress,
  XP_PER_LEVEL,
  type CheckInRecord,
} from "@/lib/rules";

export default function MemberHome() {
  return (
    <main className="page">
      <p className="eyebrow">{APP_NAME}</p>
      <Suspense fallback={<div className="card muted">Loading...</div>}>
        <Home />
      </Suspense>
    </main>
  );
}

async function Home() {
  const viewer = await getViewer();

  if (viewer.kind === "not_configured") {
    return (
      <div className="card notice">
        The app isn&apos;t connected to its database yet. Open <Link href="/api/health">the setup
        check</Link> for what&apos;s missing.
      </div>
    );
  }

  if (viewer.kind === "signed_out") {
    return (
      <>
        <h1>Scan in. Keep your streak.</h1>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            Check in by scanning the QR code on the gym TV. Hit your weekly target to grow your
            streak, earn XP and level up.
          </p>
          <Link className="button" href="/login">
            Sign in or sign up
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  const { member } = viewer;
  if (!member) {
    return (
      <>
        <h1>Welcome!</h1>
        <JoinForm email={viewer.email} />
        <Footer signedIn />
      </>
    );
  }

  if (member.status === "pending") {
    return (
      <>
        <h1>Hi, {displayName(member)}</h1>
        <div className="card">
          <strong>Waiting for approval</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Show this screen at the front desk. Staff will match <b>{member.full_name}</b> with
            the logbook and approve you in one tap. Then refresh this page.
          </p>
        </div>
        <Footer signedIn />
      </>
    );
  }

  if (member.status === "deactivated") {
    return (
      <>
        <h1>Hi, {displayName(member)}</h1>
        <div className="card">
          <strong>Your account is paused</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Please talk to the front desk to turn it back on.
          </p>
        </div>
        <Footer signedIn />
      </>
    );
  }

  return <ActiveHome member={member} supabase={viewer.supabase} />;
}

async function ActiveHome({
  member,
  supabase,
}: {
  member: Member;
  supabase: Extract<Awaited<ReturnType<typeof getViewer>>, { kind: "signed_in" }>["supabase"];
}) {
  // RLS returns only this member's rows.
  const [checkInsRes, xpRes, closuresRes] = await Promise.all([
    supabase
      .from("check_ins")
      .select("checked_in_at")
      .eq("counted", true)
      .is("voided_at", null)
      .order("checked_in_at", { ascending: false })
      .limit(800),
    supabase.from("xp_ledger").select("amount"),
    supabase.from("closure_weeks").select("week_start"),
  ]);

  const checkIns: CheckInRecord[] = (checkInsRes.data ?? []).map((r) => ({
    at: new Date(r.checked_in_at as string),
  }));
  const now = new Date();
  const progress = weeklyProgress({ checkIns, weeklyTarget: member.weekly_target, now });
  const streak = currentStreak({
    checkIns,
    weeklyTarget: member.weekly_target,
    closureWeeks: (closuresRes.data ?? []).map((r) => r.week_start as string),
    joinedAt: new Date(member.created_at),
    now,
  });
  const xp = totalXp((xpRes.data ?? []) as { amount: number }[]);
  const level = levelFor(xp);

  return (
    <>
      <h1>Hi, {displayName(member)}</h1>

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
        <span className="muted small">
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
          <div style={{ width: `${(level.xpIntoLevel / XP_PER_LEVEL) * 100}%` }} />
        </div>
        <p className="muted small" style={{ margin: "8px 0 0" }}>
          {level.xpForNextLevel} XP to go
        </p>
      </div>

      <button className="button" disabled>
        Scan to check in (coming next week)
      </button>

      <Footer signedIn staff={isStaff(member)} />
    </>
  );
}

function displayName(member: Member): string {
  return member.nickname || member.full_name.split(" ")[0] || "there";
}

function Footer({ signedIn = false, staff = false }: { signedIn?: boolean; staff?: boolean }) {
  return (
    <nav className="nav">
      {signedIn && <Link href="/profile">Profile</Link>}
      {staff && <Link href="/admin">Admin</Link>}
      <Link href="/privacy">Privacy</Link>
      {signedIn && (
        <form action={signOut}>
          <button className="link-button">Sign out</button>
        </form>
      )}
    </nav>
  );
}

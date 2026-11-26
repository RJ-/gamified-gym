import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getViewer, isStaff, type Member } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { MemberList } from "./member-list";

export const metadata: Metadata = { title: `${APP_NAME} · Admin` };

export default function AdminPage() {
  return (
    <main className="page page-wide">
      <p className="eyebrow">{APP_NAME}</p>
      <h1>Staff admin</h1>
      <Suspense fallback={<div className="card muted">Loading...</div>}>
        <Admin />
      </Suspense>
      <nav className="nav">
        <Link href="/">Member app</Link>
        <Link href="/tv">TV screen</Link>
        <Link href="/api/health">Setup check</Link>
      </nav>
    </main>
  );
}

async function Admin() {
  const viewer = await getViewer();
  if (viewer.kind !== "signed_in") {
    return (
      <div className="card">
        Staff only. <Link href="/login">Sign in</Link> with your staff account.
      </div>
    );
  }
  if (!isStaff(viewer.member)) {
    return <div className="card">Staff only. Ask the gym owner to give your account staff access.</div>;
  }

  // RLS: active staff see every member of their own gym, nobody else's.
  const { data, error } = await viewer.supabase
    .from("members")
    .select("id, full_name, nickname, role, status, created_at")
    .order("created_at", { ascending: false });
  if (error) return <div className="card error">Couldn&apos;t load members. Please refresh.</div>;

  const rows = (data ?? []) as Pick<Member, "id" | "full_name" | "nickname" | "role" | "status" | "created_at">[];
  return (
    <>
      <MemberList members={rows} myId={viewer.userId} isAdmin={viewer.member?.role === "admin"} />
      <div className="card notice">
        Coming next: manual check-in (week 3), void a check-in, monthly goal and closure weeks
        (week 5).
      </div>
    </>
  );
}

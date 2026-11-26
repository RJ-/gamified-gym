import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { DeleteAccountForm, ProfileForm } from "@/components/member-forms";
import { getViewer } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `${APP_NAME} · Profile` };

export default function ProfilePage() {
  return (
    <main className="page">
      <p className="eyebrow">{APP_NAME}</p>
      <h1>Your profile</h1>
      <Suspense fallback={<div className="card muted">Loading...</div>}>
        <Profile />
      </Suspense>
      <nav className="nav">
        <Link href="/">Home</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </main>
  );
}

async function Profile() {
  const viewer = await getViewer();
  if (viewer.kind !== "signed_in") {
    return (
      <div className="card">
        <Link href="/login">Sign in</Link> to see your profile.
      </div>
    );
  }
  const { member } = viewer;
  if (!member) {
    return (
      <div className="card">
        Finish joining on the <Link href="/">home page</Link> first.
      </div>
    );
  }
  return (
    <>
      {viewer.email && <p className="muted small">Signed in as {viewer.email}</p>}
      <ProfileForm
        fullName={member.full_name}
        canEditName={member.status === "pending"}
        nickname={member.nickname ?? ""}
        showOnTv={member.show_on_tv}
      />
      <form action={signOut} style={{ marginBottom: 12 }}>
        <button className="button button-secondary">Sign out</button>
      </form>
      <DeleteAccountForm />
    </>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteAccount, joinGym, updateProfile } from "@/app/actions";
import { MAX_NAME, MAX_NICKNAME } from "@/lib/validation";

function Result({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state) return null;
  return <p className={state.ok ? "success" : "error"}>{state.message}</p>;
}

/** Nickname + "show me on the TV" (only possible with a nickname). */
function TvFields({ nickname, showOnTv }: { nickname: string; showOnTv: boolean }) {
  const [nick, setNick] = useState(nickname);
  const hasNick = nick.trim().length > 0;
  return (
    <>
      <label htmlFor="nickname">Nickname (optional)</label>
      <input
        id="nickname"
        name="nickname"
        maxLength={MAX_NICKNAME}
        value={nick}
        onChange={(e) => setNick(e.target.value)}
        placeholder="e.g. Jay"
        autoComplete="nickname"
      />
      <label className="check">
        <input type="checkbox" name="show_on_tv" defaultChecked={showOnTv} disabled={!hasNick} />
        <span>
          Show my nickname on the gym TV when I check in and on the top streaks list.
          <span className="muted"> {hasNick ? "Off by default." : "Add a nickname first."}</span>
        </span>
      </label>
    </>
  );
}

export function JoinForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(joinGym, null);
  return (
    <form action={action} className="card form">
      <strong>Join the gym app</strong>
      {email && <p className="muted small">Signed in as {email}</p>}
      <label htmlFor="full_name">Full name (as written in the gym logbook)</label>
      <input id="full_name" name="full_name" maxLength={MAX_NAME} required autoComplete="name" />
      <TvFields nickname="" showOnTv={false} />
      <label className="check">
        <input type="checkbox" name="consent" value="yes" required />
        <span>
          I have read the <Link href="/privacy">privacy notice</Link> and agree to the gym
          keeping my name, email and check-ins for this app.
        </span>
      </label>
      <Result state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Joining..." : "Join"}
      </button>
    </form>
  );
}

export function ProfileForm(props: {
  fullName: string;
  canEditName: boolean;
  nickname: string;
  showOnTv: boolean;
}) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="card form">
      <label htmlFor="full_name">Full name</label>
      {props.canEditName ? (
        <input id="full_name" name="full_name" maxLength={MAX_NAME} required defaultValue={props.fullName} />
      ) : (
        <>
          <input id="full_name" value={props.fullName} disabled readOnly />
          <span className="muted small">Ask the front desk to change your name.</span>
        </>
      )}
      <TvFields nickname={props.nickname} showOnTv={props.showOnTv} />
      <Result state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, null);
  return (
    <details className="card">
      <summary>Delete my account</summary>
      <form action={action} className="form" style={{ marginTop: 12 }}>
        <p className="muted small" style={{ margin: 0 }}>
          This removes your profile, check-ins, streak and XP from the app for good. It can&apos;t
          be undone. Your paper logbook membership is not affected.
        </p>
        <label htmlFor="confirm">Type DELETE to confirm</label>
        <input id="confirm" name="confirm" autoComplete="off" required />
        <Result state={state} />
        <button className="button button-danger" disabled={pending}>
          {pending ? "Deleting..." : "Delete my account"}
        </button>
      </form>
    </details>
  );
}

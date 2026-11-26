"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendEmailLink, signInWithGoogle, verifyEmailCode } from "./actions";

const URL_ERRORS: Record<string, string> = {
  link: "That sign-in link didn't work or has expired. Send a new one below.",
  cancelled: "Sign-in was cancelled.",
  google: "Google sign-in isn't available right now. Use your email instead.",
  not_configured: "Sign-in isn't set up yet.",
};

export function LoginForm() {
  const urlError = URL_ERRORS[useSearchParams().get("error") ?? ""];
  const [sent, sendAction, sending] = useActionState(sendEmailLink, null);
  const [verified, verifyAction, verifying] = useActionState(verifyEmailCode, null);
  const [editing, setEditing] = useState(false);
  const sentTo = sent?.ok && !editing ? sent.message : null;

  if (sentTo) {
    return (
      <>
        <div className="card">
          <strong>Check your email</strong>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            We sent a sign-in link to <b>{sentTo}</b>. Tap it on this phone. Wala pa? Check
            your Spam or Promotions folder.
          </p>
        </div>
        <form action={verifyAction} className="card form">
          <input type="hidden" name="email" value={sentTo} />
          <label htmlFor="code">Or type the code from the email</label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={10}
            required
          />
          {verified && !verified.ok && <p className="error">{verified.message}</p>}
          <button className="button" disabled={verifying}>
            {verifying ? "Checking..." : "Sign in with code"}
          </button>
        </form>
        <button className="link-button" onClick={() => setEditing(true)}>
          Use a different email
        </button>
      </>
    );
  }

  return (
    <>
      {urlError && <p className="card error">{urlError}</p>}
      <form action={sendAction} className="card form" onSubmit={() => setEditing(false)}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
        />
        {sent && !sent.ok && <p className="error">{sent.message}</p>}
        <button className="button" disabled={sending}>
          {sending ? "Sending..." : "Email me a sign-in link"}
        </button>
      </form>
      <p className="divider">or</p>
      <form action={signInWithGoogle}>
        <button className="button button-secondary">Continue with Google</button>
      </form>
    </>
  );
}

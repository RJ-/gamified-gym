"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { createSupabaseServer } from "@/lib/supabase/server";
import { checkEmail, checkOtpCode } from "@/lib/validation";

/**
 * This site's own address, for sign-in return links. Next.js already rejects
 * Server Actions whose Origin doesn't match the Host, and Supabase only
 * accepts return links listed under Auth > URL Configuration.
 */
async function siteOrigin(): Promise<string | null> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  return null;
}

export async function sendEmailLink(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = checkEmail(formData.get("email"));
  if (!email.ok) return { ok: false, message: email.error };
  const supabase = await createSupabaseServer();
  const origin = await siteOrigin();
  if (!supabase || !origin) return { ok: false, message: "Sign-in isn't set up yet." };

  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true },
  });
  if (error) {
    // Supabase's free email service allows only a few emails per hour.
    const tooMany = error.status === 429 || /rate limit/i.test(error.message);
    return {
      ok: false,
      message: tooMany
        ? "Too many sign-in emails right now. Wait a few minutes, then try again."
        : "We couldn't send the email. Check the address and try again.",
    };
  }
  return { ok: true, message: email.value };
}

export async function verifyEmailCode(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = checkEmail(formData.get("email"));
  const code = checkOtpCode(formData.get("code"));
  if (!email.ok) return { ok: false, message: email.error };
  if (!code.ok) return { ok: false, message: code.error };
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, message: "Sign-in isn't set up yet." };

  const { error } = await supabase.auth.verifyOtp({
    email: email.value,
    token: code.value,
    type: "email",
  });
  if (error) return { ok: false, message: "That code didn't work or has expired. Send a new one." };
  redirect("/");
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await createSupabaseServer();
  const origin = await siteOrigin();
  if (!supabase || !origin) redirect("/login?error=not_configured");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase?.auth.signOut();
  redirect("/");
}

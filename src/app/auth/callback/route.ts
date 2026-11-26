import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

const EMAIL_TYPES: readonly EmailOtpType[] = ["email", "magiclink", "signup"];

/**
 * Where sign-in links land.
 * - Google, and the default Supabase email template, send `?code=` (PKCE).
 *   That only works in the same browser that asked for the link.
 * - Our recommended email template sends `?token_hash=&type=email`, which
 *   works even when the email app opens the link in a different browser.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  const supabase = await createSupabaseServer();
  if (!supabase) return fail("not_configured");

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link");
  } else if (tokenHash && type && EMAIL_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("link");
  } else {
    return fail(url.searchParams.get("error") ? "cancelled" : "link");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

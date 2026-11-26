/** Input checks shared by forms and server actions. Postgres checks again. */

export const MAX_NAME = 80;
export const MAX_NICKNAME = 24;

// Letters (any language, so ñ and é are fine), digits, spaces and . _ ' -
const NICKNAME_RE = /^[\p{L}\p{N} ._'-]+$/u;
const NAME_RE = /^[\p{L}\p{N} .,'-]+$/u;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function checkFullName(input: unknown): Checked<string> {
  const value = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!value) return { ok: false, error: "Please enter your full name." };
  if (value.length > MAX_NAME) {
    return { ok: false, error: `Full name can be up to ${MAX_NAME} characters.` };
  }
  if (!NAME_RE.test(value)) {
    return { ok: false, error: "Full name can only use letters, numbers, spaces and . , ' -" };
  }
  return { ok: true, value };
}

/** Empty means "no nickname" (null). */
export function checkNickname(input: unknown): Checked<string | null> {
  const value = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!value) return { ok: true, value: null };
  if (value.length > MAX_NICKNAME) {
    return { ok: false, error: `Nickname can be up to ${MAX_NICKNAME} characters.` };
  }
  if (!NICKNAME_RE.test(value)) {
    return { ok: false, error: "Nickname can only use letters, numbers, spaces and . _ ' -" };
  }
  return { ok: true, value };
}

export function checkEmail(input: unknown): Checked<string> {
  const value = String(input ?? "").trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  return { ok: true, value };
}

/** The 6 to 8 digit code from the sign-in email. */
export function checkOtpCode(input: unknown): Checked<string> {
  const value = String(input ?? "").replace(/\s/g, "");
  if (!/^\d{6,8}$/.test(value)) {
    return { ok: false, error: "Enter the code from the email (numbers only)." };
  }
  return { ok: true, value };
}

/**
 * Where to send someone after sign-in. Only same-site paths are allowed, so a
 * crafted link can't bounce a member to another website (open redirect).
 */
export function safeNextPath(input: unknown): string {
  const value = typeof input === "string" ? input : "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(value)) return "/";
  return value;
}

/** Display name until the gym picks a real one. */
export const APP_NAME = "Gamified Gym";

/**
 * Public Supabase settings. Both are safe in the browser (RLS protects the
 * data); they come from Vercel / .env.local, never from the repo.
 */
export function supabasePublicEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

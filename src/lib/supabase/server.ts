import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_OPTIONS, supabasePublicEnv } from "@/lib/config";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * It acts AS the signed-in user (anon key + their session cookie), so Row
 * Level Security decides what it can read and write. There is no service
 * role key anywhere in the app.
 */
export async function createSupabaseServer() {
  // Read cookies first so pages that use this are always rendered per request.
  const cookieStore = await cookies();
  const env = supabasePublicEnv();
  if (!env) return null;
  return createServerClient(env.url, env.anonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies; src/proxy.ts refreshes them.
        }
      },
    },
  });
}

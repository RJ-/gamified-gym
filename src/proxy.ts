import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS, supabasePublicEnv } from "@/lib/config";

/**
 * Keeps the Supabase sign-in fresh: when the short-lived access token has
 * expired, this swaps it for a new one and writes the cookies before any page
 * renders. It does not decide who may see what; pages and Postgres RLS do.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = supabasePublicEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Validates the token and refreshes it if needed. Don't remove.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    // Pages only: skip static files, icons, the manifest and the health check.
    "/((?!_next/static|_next/image|icons/|api/health|manifest\\.webmanifest|icon\\.svg|apple-icon\\.png|favicon\\.ico).*)",
  ],
};

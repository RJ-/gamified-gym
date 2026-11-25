import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { supabasePublicEnv } from "@/lib/config";

/**
 * Setup check: open /api/health on a deployment to see whether the Supabase
 * keys are set and the week 1 migration has been applied. Reveals no data.
 */
export async function GET() {
  await connection();
  const env = supabasePublicEnv();
  if (!env) {
    return Response.json({
      ok: false,
      supabase: "not_configured",
      hint: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.",
    });
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false },
  });
  // RLS hides every row from the anon key, so this only proves the table exists.
  const { error } = await supabase.from("gyms").select("id", { head: true, count: "exact" });
  if (error) {
    return Response.json({
      ok: false,
      supabase: "schema_missing_or_unreachable",
      hint: "Run supabase/migrations/*.sql in the Supabase SQL editor.",
      detail: error.message,
    });
  }
  return Response.json({ ok: true, supabase: "connected" });
}

import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";

export type Role = "member" | "staff" | "admin" | "display";
export type Status = "pending" | "active" | "deactivated";

export interface Member {
  id: string;
  gym_id: string;
  full_name: string;
  nickname: string | null;
  show_on_tv: boolean;
  weekly_target: number;
  role: Role;
  status: Status;
  created_at: string;
}

export const MEMBER_COLUMNS =
  "id, gym_id, full_name, nickname, show_on_tv, weekly_target, role, status, created_at";

export type Viewer =
  | { kind: "not_configured" }
  | { kind: "signed_out" }
  | {
      kind: "signed_in";
      supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServer>>>;
      userId: string;
      email: string | null;
      /** null until they finish joining (name + privacy consent). */
      member: Member | null;
    };

/**
 * Who is looking at this page. Read once per request. The identity comes from
 * a verified token (getClaims), and every query after this still goes through
 * RLS, so this is for showing the right screen, not for security on its own.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createSupabaseServer();
  if (!supabase) return { kind: "not_configured" };

  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { kind: "signed_out" };

  const { data: member } = await supabase
    .from("members")
    .select(MEMBER_COLUMNS)
    .eq("id", userId)
    .maybeSingle<Member>();

  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { kind: "signed_in", supabase, userId, email, member: member ?? null };
});

export function isStaff(member: Member | null): boolean {
  return !!member && member.status === "active" && (member.role === "staff" || member.role === "admin");
}

/** Errors we raise ourselves in Postgres (code P0001) are safe to show. */
export function friendlyDbError(error: { code?: string; message: string } | null): string {
  if (!error) return "";
  if (error.code === "P0001") return error.message;
  return "Something went wrong. Please try again.";
}

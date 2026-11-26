"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { friendlyDbError, getViewer, isStaff } from "@/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The real permission checks live in the Postgres functions
// set_member_status / set_member_role (staff only, same gym, not yourself,
// staff can't change staff). These early checks only give nicer messages.

export async function setMemberStatus(
  memberId: string,
  status: "active" | "deactivated",
): Promise<ActionResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "signed_in" || !isStaff(viewer.member)) {
    return { ok: false, message: "Staff only." };
  }
  if (!UUID_RE.test(memberId) || (status !== "active" && status !== "deactivated")) {
    return { ok: false, message: "Something went wrong. Please refresh." };
  }
  const { error } = await viewer.supabase.rpc("set_member_status", {
    p_member_id: memberId,
    p_status: status,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  refresh();
  return { ok: true, message: "" };
}

export async function setMemberRole(
  memberId: string,
  role: "member" | "staff",
): Promise<ActionResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "signed_in" || viewer.member?.role !== "admin" || !isStaff(viewer.member)) {
    return { ok: false, message: "Admins only." };
  }
  if (!UUID_RE.test(memberId) || (role !== "member" && role !== "staff")) {
    return { ok: false, message: "Something went wrong. Please refresh." };
  }
  const { error } = await viewer.supabase.rpc("set_member_role", {
    p_member_id: memberId,
    p_role: role,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  refresh();
  return { ok: true, message: "" };
}

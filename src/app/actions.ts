"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { friendlyDbError, getViewer } from "@/lib/auth";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { checkFullName, checkNickname } from "@/lib/validation";

// Every action re-checks the session itself: Server Actions can be called by
// anyone with a POST request, not only from our forms. The Postgres functions
// they call check again.

export async function joinGym(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "signed_in") return { ok: false, message: "Please sign in again." };
  if (formData.get("consent") !== "yes") {
    return { ok: false, message: "Please tick the box to agree to the privacy notice." };
  }
  const name = checkFullName(formData.get("full_name"));
  if (!name.ok) return { ok: false, message: name.error };
  const nickname = checkNickname(formData.get("nickname"));
  if (!nickname.ok) return { ok: false, message: nickname.error };

  const { error } = await viewer.supabase.rpc("join_gym", {
    p_full_name: name.value,
    p_nickname: nickname.value,
    p_show_on_tv: formData.get("show_on_tv") === "on" && nickname.value !== null,
    p_privacy_notice_version: PRIVACY_NOTICE_VERSION,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  refresh();
  return { ok: true, message: "Welcome!" };
}

export async function updateProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "signed_in" || !viewer.member) {
    return { ok: false, message: "Please sign in again." };
  }
  const nickname = checkNickname(formData.get("nickname"));
  if (!nickname.ok) return { ok: false, message: nickname.error };
  // Only pending members can change their full name; others send the current one.
  const name = checkFullName(formData.get("full_name") ?? viewer.member.full_name);
  if (!name.ok) return { ok: false, message: name.error };

  const { error } = await viewer.supabase.rpc("update_my_profile", {
    p_full_name: name.value,
    p_nickname: nickname.value,
    p_show_on_tv: formData.get("show_on_tv") === "on" && nickname.value !== null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function deleteAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "signed_in") return { ok: false, message: "Please sign in again." };
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm." };
  }
  const { error } = await viewer.supabase.rpc("delete_my_account");
  if (error) return { ok: false, message: friendlyDbError(error) };
  // The account is gone, so only clear this browser's cookies.
  await viewer.supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

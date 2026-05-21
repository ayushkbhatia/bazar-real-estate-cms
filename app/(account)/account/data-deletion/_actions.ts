"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import {
  generateDsrToken,
  isTokenExpired,
} from "@/lib/dsr";
import { dsrDeleteConfirmTemplate } from "@/lib/dsr-templates";

function siteUrl(): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app"
  ).replace(/\/+$/, "");
}

async function adminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type RequestDeletionResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export async function requestAccountDeletion(): Promise<RequestDeletionResult> {
  if (!isSupabaseConfigured || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "error", message: "Deletion requests are offline." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { status: "error", message: "Sign in required." };
  }

  const admin = await adminClient();
  const token = generateDsrToken();

  const { error } = await admin.from("dsr_requests").insert({
    account_id: user.id,
    kind: "delete",
    status: "pending",
    token,
    email: user.email,
  });
  if (error) return { status: "error", message: error.message };

  const confirmUrl = `${siteUrl()}/account/data-deletion/confirm/${token}`;
  const template = dsrDeleteConfirmTemplate({ confirmUrl });
  await sendEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });

  revalidatePath("/account/data-deletion");
  return {
    status: "ok",
    message: "Check your inbox to confirm. Link expires in 24 hours.",
  };
}

export type ConfirmDeletionResult =
  | { status: "ok"; email: string }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "already_used" }
  | { status: "error"; message: string };

export async function confirmAccountDeletion(
  token: string,
): Promise<ConfirmDeletionResult> {
  if (!isSupabaseConfigured || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "error", message: "Deletion requests are offline." };
  }
  if (!/^[0-9a-f]{64}$/.test(token)) return { status: "not_found" };

  const admin = await adminClient();
  const { data: req } = await admin
    .from("dsr_requests")
    .select("id, account_id, kind, status, email, created_at")
    .eq("token", token)
    .eq("kind", "delete")
    .maybeSingle();
  if (!req) return { status: "not_found" };
  if (req.status === "fulfilled") return { status: "already_used" };

  if (isTokenExpired(new Date(req.created_at))) {
    await admin
      .from("dsr_requests")
      .update({ status: "expired" })
      .eq("id", req.id);
    return { status: "expired" };
  }

  // Run the anonymisation helper (security definer, scoped to one account).
  const { error: rpcError } = await admin.rpc("anonymise_account", {
    target: req.account_id,
  });
  if (rpcError) {
    return { status: "error", message: rpcError.message };
  }

  // Sign-in lockout: disable the auth.users row so the address can't be
  // re-used. The standard Supabase auth admin API does this.
  await admin.auth.admin.deleteUser(req.account_id, true); // soft delete

  await admin
    .from("dsr_requests")
    .update({
      status: "fulfilled",
      confirmed_at: new Date().toISOString(),
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", req.id);

  // Best-effort sign-out for the current session.
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  return { status: "ok", email: req.email };
}

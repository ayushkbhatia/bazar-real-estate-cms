"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import {
  approxJsonByteSize,
  buildDataExport,
  generateDsrToken,
  isTokenExpired,
  type DataExportPayload,
} from "@/lib/dsr";
import { dsrExportConfirmTemplate } from "@/lib/dsr-templates";

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

export type RequestExportResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export async function requestDataExport(): Promise<RequestExportResult> {
  if (!isSupabaseConfigured || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "error", message: "Data export is offline." };
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
    kind: "export",
    status: "pending",
    token,
    email: user.email,
  });
  if (error) {
    return { status: "error", message: error.message };
  }

  const confirmUrl = `${siteUrl()}/account/data-export/confirm/${token}`;
  const template = dsrExportConfirmTemplate({ confirmUrl });
  await sendEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });

  revalidatePath("/account/data-export");
  return {
    status: "ok",
    message:
      "Check your inbox to confirm. Link expires in 24 hours.",
  };
}

export type ConfirmExportResult =
  | { status: "ok"; payload: DataExportPayload; filename: string }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "already_used" }
  | { status: "error"; message: string };

/**
 * Validates the confirmation token, returns the user's archive as a fully-
 * built DataExportPayload. The caller (the confirm route handler) serialises
 * to JSON + sets the Content-Disposition header.
 */
export async function confirmDataExport(
  token: string,
): Promise<ConfirmExportResult> {
  if (!isSupabaseConfigured || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "error", message: "Data export is offline." };
  }
  if (!/^[0-9a-f]{64}$/.test(token)) return { status: "not_found" };

  const admin = await adminClient();
  const { data: req } = await admin
    .from("dsr_requests")
    .select("id, account_id, kind, status, email, created_at, fulfilled_at")
    .eq("token", token)
    .eq("kind", "export")
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

  // Fetch every collection. We do these as separate queries so a failure on
  // one doesn't poison the others.
  const [
    accountRes,
    savedPropsRes,
    savedSearchRes,
    enquiriesRes,
    viewingsRes,
    newsletterRes,
  ] = await Promise.all([
    admin
      .from("accounts")
      .select(
        "user_id, first_name, last_name, nationality, residency_status, preferred_language, marketing_opt_in, kyc_status, kyc_verified_at, created_at, updated_at",
      )
      .eq("user_id", req.account_id)
      .maybeSingle(),
    admin.from("saved_properties").select("*").eq("user_id", req.account_id),
    admin.from("saved_searches").select("*").eq("user_id", req.account_id),
    admin
      .from("enquiries")
      .select(
        "id, source, status, temperature, brief_raw, budget_min, budget_max, timeline, property_id, development_id, created_at",
      )
      .eq("account_id", req.account_id),
    admin
      .from("viewings")
      .select(
        "id, property_id, starts_at, duration_minutes, location, status, notes, feedback, created_at",
      )
      .eq("account_id", req.account_id),
    admin
      .from("newsletter_subscribers")
      .select(
        "email, status, source, subscribed_at, confirmed_at, unsubscribed_at",
      )
      .or(`account_id.eq.${req.account_id},email.eq.${req.email}`)
      .maybeSingle(),
  ]);

  // Messages are scoped by conversation->enquiry->account so collect via the
  // enquiry ids we already have.
  const enquiryIds = (enquiriesRes.data ?? []).map((e) => e.id as string);
  let messages: Array<Record<string, unknown>> = [];
  if (enquiryIds.length > 0) {
    const { data: convData } = await admin
      .from("conversations")
      .select("id")
      .in("enquiry_id", enquiryIds);
    const convIds = (convData ?? []).map((c) => c.id as string);
    if (convIds.length > 0) {
      const { data: msgData } = await admin
        .from("messages")
        .select("id, conversation_id, direction, author_kind, body, channel, sent_at")
        .in("conversation_id", convIds)
        .order("sent_at", { ascending: true });
      messages = (msgData ?? []) as Array<Record<string, unknown>>;
    }
  }

  const payload = buildDataExport({
    account: accountRes.data as Record<string, unknown> | null,
    saved_properties: (savedPropsRes.data ?? []) as Array<Record<string, unknown>>,
    saved_searches: (savedSearchRes.data ?? []) as Array<Record<string, unknown>>,
    enquiries: (enquiriesRes.data ?? []) as Array<Record<string, unknown>>,
    viewings: (viewingsRes.data ?? []) as Array<Record<string, unknown>>,
    messages,
    newsletter_subscription: newsletterRes.data as Record<string, unknown> | null,
  });

  const filename = `bazar-data-export-${new Date(req.created_at).toISOString().slice(0, 10)}.json`;

  await admin
    .from("dsr_requests")
    .update({
      status: "fulfilled",
      confirmed_at: new Date().toISOString(),
      fulfilled_at: new Date().toISOString(),
      payload: { bytes: approxJsonByteSize(payload), counts: {
        saved_properties: payload.saved_properties.length,
        saved_searches: payload.saved_searches.length,
        enquiries: payload.enquiries.length,
        viewings: payload.viewings.length,
        messages: payload.messages.length,
      } },
    })
    .eq("id", req.id);

  return { status: "ok", payload, filename };
}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import {
  enquirySchema,
  normaliseEnquiryInput,
  type EnquiryInput,
} from "@/lib/schemas/enquiry";
import { sendEmail } from "@/lib/email";
import { enquiryAcknowledgementEmail } from "@/lib/content-assets/system-emails";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import type { Database } from "@/db/types";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The advisor assigned to a listing, or null. Never throws — a lead that
 *  can't be routed is still a lead worth keeping. */
async function resolvePropertyAgent(
  supabase: ServerClient,
  propertyId: string | null,
): Promise<string | null> {
  if (!propertyId) return null;
  try {
    const { data } = await supabase
      .from("properties")
      .select("assigned_agent_id")
      .eq("id", propertyId)
      .maybeSingle();
    return data?.assigned_agent_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Settings → Lead routing → fallback advisor. Null when unset.
 *
 * Read with the service-role client: `site_settings` has no `anon` SELECT
 * policy (only `site_settings_staff_read`, gated on `is_staff()`), and the
 * caller here is an anonymous visitor submitting a form. Going through the
 * request-scoped client would return null every time and the fallback would
 * silently never fire. Nothing from the row reaches the response — only the
 * agent id, and only as a column on the enquiry being written.
 */
async function resolveFallbackAgent(): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  try {
    const { data } = await admin
      .from("site_settings")
      .select("lead_routing")
      .eq("id", 1)
      .maybeSingle();
    const routing = (data?.lead_routing ?? null) as {
      fallback_agent_id?: unknown;
    } | null;
    const id = routing?.fallback_agent_id;
    return typeof id === "string" && id !== "" ? id : null;
  } catch {
    return null;
  }
}

export type CreateEnquiryResult =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

/**
 * Public enquiry intake. Anonymous and authed both supported.
 * The on_enquiry_created trigger creates the conversation + first message.
 */
export async function createEnquiry(
  raw: Record<string, unknown>,
): Promise<CreateEnquiryResult> {
  if (!isSupabaseConfigured)
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };

  // Per-IP submission cap. Covers enquiry / contact / mortgage / property
  // enquiry forms since they all flow through here.
  const rl = await checkRateLimit({
    name: "enquiry",
    ip: extractClientIp(await headers()),
    requests: 10,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    return { status: "error", message: rateLimitMessage(rl.retryAfterSeconds) };
  }

  const parsed = enquirySchema.safeParse(normaliseEnquiryInput(raw));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const data: EnquiryInput = parsed.data;

  // Auth-aware server client to pick up the current account_id when signed in.
  // RLS on enquiries allows anonymous INSERT, so this works either way.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pack the secondary context into inferred_constraints jsonb so we don't
  // need extra columns yet.
  const inferred = {
    intent: data.intent ?? null,
    submitted_via: "web",
  };

  // Route the lead to whoever owns the listing. Every property enquiry landed
  // unassigned before this, so the agent named on the page never saw their own
  // leads — they sat in the unassigned pool waiting for manual triage.
  // Falls back to the routing default in Settings when the listing has no
  // agent, and to null (the old behaviour) when neither is set.
  const assignedAgentId =
    (await resolvePropertyAgent(supabase, data.property_id ?? null)) ??
    (await resolveFallbackAgent());

  const insertPayload: Database["public"]["Tables"]["enquiries"]["Insert"] = {
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    brief_raw: data.message,
    source: data.source,
    property_id: data.property_id ?? null,
    development_id: data.development_id ?? null,
    timeline: data.timeline ?? null,
    budget_min: data.budget_min ?? null,
    budget_max: data.budget_max ?? null,
    account_id: user?.id ?? null,
    assigned_agent_id: assignedAgentId,
    // Migration 0100 added this column and nothing ever wrote it, so every row
    // read `en` — Arabic leads included. Its own docblock calls it "the one
    // part of the i18n epic that is NOT retro-fittable": a lead's language
    // cannot be inferred afterwards, so an unrecorded day is lost for good.
    locale: data.locale,
    inferred_constraints:
      inferred as unknown as Database["public"]["Tables"]["enquiries"]["Insert"]["inferred_constraints"],
  };

  // Anonymous submissions can't insert under RLS even though we have a policy
  // for INSERT — the policy applies to the `anon` role, but `auth.uid()` is
  // null. We use a service-role client purely for the INSERT call when the
  // session is anonymous; this avoids exposing service-role to the browser.
  let insertedId: string;
  if (!user && env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: row, error } = await admin
      .from("enquiries")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();
    if (error || !row)
      return {
        status: "error",
        message: error?.message ?? "Failed to submit enquiry.",
      };
    insertedId = row.id;
  } else {
    const { data: row, error } = await supabase
      .from("enquiries")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();
    if (error || !row)
      return {
        status: "error",
        message: error?.message ?? "Failed to submit enquiry.",
      };
    insertedId = row.id;
  }

  revalidatePath("/admin/enquiries");

  // Fire-and-forget auto-reply via Resend. No-op if RESEND_API_KEY is unset.
  if (data.email) {
    let propertyReference: string | null = null;
    let propertyTitle: string | null = null;
    if (data.property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("reference, title")
        .eq("id", data.property_id)
        .maybeSingle();
      propertyReference = prop?.reference ?? null;
      propertyTitle = prop?.title ?? null;
    }
    const tpl = await enquiryAcknowledgementEmail({
      name: data.name,
      message: data.message,
      propertyReference,
      propertyTitle,
    });
    await sendEmail({
      to: data.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  }

  return { status: "ok", id: insertedId };
}

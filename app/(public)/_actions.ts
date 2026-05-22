"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import {
  enquirySchema,
  normaliseEnquiryInput,
  type EnquiryInput,
} from "@/lib/schemas/enquiry";
import { sendEmail } from "@/lib/email";
import { enquiryReceivedTemplate } from "@/lib/email-templates";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import type { Database } from "@/db/types";

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
    const tpl = enquiryReceivedTemplate({
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

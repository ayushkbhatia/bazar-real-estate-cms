"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { enquiryReceivedTemplate } from "@/lib/email-templates";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import { matchAdvisor, type MatchedAdvisor } from "@/lib/queries/lead-routing";
import { normaliseUaeMobile } from "@/lib/schemas/list-property";
import {
  buildServiceBrief,
  normaliseServiceLead,
  serviceLeadSchema,
  type ServiceLeadInput,
} from "@/lib/schemas/service-lead";
import type { Database } from "@/db/types";

export type ServiceLeadResult =
  | { status: "ok"; advisorName: string | null }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const SOURCE: Record<
  ServiceLeadInput["kind"],
  Database["public"]["Enums"]["enquiry_source"]
> = {
  management: "property_management",
  consultation: "property_consultation",
};

/**
 * Lead intake for the two service landings.
 *
 * Its own action rather than a call into `createEnquiry` for the same reason
 * `submitListingLead` is: these carry a qualification payload the generic
 * intake has no columns for, and the management lead is routed to the advisor
 * covering the property's community at insert time so it lands on the right
 * person's list rather than in the unassigned pool. Everything downstream is
 * the same pipeline — the `on_enquiry_created` trigger opens the conversation,
 * the admin inbox picks it up, the auto-reply goes out over Resend.
 */
export async function submitServiceLead(
  raw: Record<string, unknown>,
): Promise<ServiceLeadResult> {
  if (!isSupabaseConfigured)
    return {
      status: "error",
      message:
        "We can't take the form right now. Call the desk and we'll take your details by phone.",
    };

  const rl = await checkRateLimit({
    name: "service_lead",
    ip: extractClientIp(await headers()),
    requests: 5,
    windowSeconds: 300,
  });
  if (!rl.ok)
    return { status: "error", message: rateLimitMessage(rl.retryAfterSeconds) };

  const parsed = serviceLeadSchema.safeParse(normaliseServiceLead(raw));
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

  const data = parsed.data;

  // A landlord's number that isn't a UAE line still has to reach the desk, so
  // the raw string is kept when normalisation can't place it.
  const phone = normaliseUaeMobile(data.phone) ?? data.phone;

  // Routing runs on the community the owner typed. The consultation form has
  // no location field, so it goes in blank and `matchAdvisor` falls through to
  // the coverage roster and then the CMS fallback advisor — the same ladder,
  // one rung further down.
  let advisor: MatchedAdvisor | null = null;
  try {
    advisor = await matchAdvisor({
      location: data.location ?? "",
      // The management lead is landlord-side work, which is what the roster
      // scores "rent_out" on. A consultation can be either, and the seller
      // side is the one with coverage rules behind it.
      intent: data.kind === "management" ? "rent_out" : "sell",
    });
  } catch (err) {
    // A routing failure must never cost us the lead — it just arrives
    // unassigned, which is a state the desk already works.
    Sentry.captureException(err, {
      tags: { component: "service-lead/match-advisor" },
    });
  }

  const supabase = await createSupabaseServerClient();

  const insertPayload: Database["public"]["Tables"]["enquiries"]["Insert"] = {
    name: data.name,
    email: data.email,
    phone,
    brief_raw: buildServiceBrief(data),
    source: SOURCE[data.kind],
    assigned_agent_id: advisor?.assignableUserId ?? null,
    inferred_constraints: {
      intent: data.intent ?? (data.kind === "management" ? "manage" : null),
      submitted_via: "web",
      lead_kind: `service_${data.kind}`,
      location: data.location ?? null,
      property_type: data.property_type ?? null,
      interest: data.interest ?? null,
      matched_advisor_slug: advisor?.slug ?? null,
    } as unknown as Database["public"]["Tables"]["enquiries"]["Insert"]["inferred_constraints"],
  };

  // Anonymous visitors can't satisfy the RLS insert policy, so the write goes
  // through service role on the server — same pattern as `createEnquiry`.
  const writer =
    env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_URL
      ? createClient<Database>(
          env.NEXT_PUBLIC_SUPABASE_URL,
          env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } },
        )
      : supabase;

  const { data: row, error } = await writer
    .from("enquiries")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (error || !row) {
    Sentry.captureException(error ?? new Error("service lead insert failed"), {
      tags: { component: "service-lead/insert", lead_kind: data.kind },
    });
    return {
      status: "error",
      message:
        "Something went wrong sending that. Try again — your answers are still here.",
    };
  }

  revalidatePath("/admin/enquiries");

  // Fire-and-forget confirmation. No-op without RESEND_API_KEY.
  const tpl = enquiryReceivedTemplate({
    name: data.name,
    message: buildServiceBrief(data),
    propertyReference: null,
    propertyTitle: null,
  });
  await sendEmail({
    to: data.email,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  }).catch((err: unknown) => {
    Sentry.captureException(err, {
      tags: { component: "service-lead/auto-reply" },
    });
  });

  return { status: "ok", advisorName: advisor?.displayName ?? null };
}

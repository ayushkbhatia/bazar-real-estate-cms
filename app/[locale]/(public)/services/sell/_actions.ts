"use server";

import { revalidatePath } from "next/cache";
import { captureFormSubmission, withLabels } from "@/lib/forms/record";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { enquiryAcknowledgementEmail } from "@/lib/content-assets/system-emails";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import { matchAdvisor, type MatchedAdvisor } from "@/lib/queries/lead-routing";
import {
  buildBrief,
  buildReference,
  buildSummary,
  listPropertySchema,
  normaliseUaeMobile,
  toEnquiryIntent,
  toEnquiryTimeline,
  type LpCallWindow,
} from "@/lib/schemas/list-property";
import type { Database } from "@/db/types";

export type ListPropertyAdvisor = {
  name: string;
  title: string | null;
  brn: string | null;
  phone: string | null;
  initials: string;
  slug: string;
};

export type ListPropertyResult =
  | {
      status: "ok";
      reference: string;
      summary: string;
      callWindow: LpCallWindow;
      /** Null when no advisor covers the area — the desk picks it up instead. */
      advisor: ListPropertyAdvisor | null;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

/**
 * The /services/sell owner lead.
 *
 * Deliberately its own action rather than a call into `createEnquiry`: this
 * lead assigns an advisor at insert time and carries a qualification payload,
 * neither of which the generic intake models. Everything downstream is the
 * same pipeline though — the `on_enquiry_created` trigger opens the
 * conversation, the admin inbox picks it up, and the auto-reply goes out on
 * the same Resend path.
 */
export async function submitListingLead(
  raw: Record<string, unknown>,
): Promise<ListPropertyResult> {
  if (!isSupabaseConfigured)
    return {
      status: "error",
      message:
        "We can't take the form right now. Call the desk and we'll take the details by phone.",
    };

  const rl = await checkRateLimit({
    name: "list_property",
    ip: extractClientIp(await headers()),
    requests: 5,
    windowSeconds: 300,
  });
  if (!rl.ok)
    return { status: "error", message: rateLimitMessage(rl.retryAfterSeconds) };

  const parsed = listPropertySchema.safeParse(raw);
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
  const phone = normaliseUaeMobile(data.mobile);
  const summary = buildSummary(data);

  // Match before the insert so the advisor lands on the row itself — an
  // assigned lead shows up on the right person's list the moment it arrives.
  let advisor: MatchedAdvisor | null = null;
  try {
    advisor = await matchAdvisor({
      location: data.location,
      areaSlug: data.area_slug ?? null,
      intent: data.intent,
    });
  } catch (err) {
    // A routing failure must never cost us the lead — it just arrives
    // unassigned, which is a state the desk already works.
    Sentry.captureException(err, {
      tags: { component: "list-property/match-advisor" },
    });
  }

  const supabase = await createSupabaseServerClient();

  // The id is minted here rather than by the default, so the reference derived
  // from it exists before the insert. That matters: the `on_enquiry_created`
  // trigger copies `brief_raw` into the first message of the thread, so writing
  // the reference into the brief up front is what puts it in front of the desk
  // — no second write, and no window where the two disagree.
  const enquiryId = crypto.randomUUID();
  const reference = buildReference(enquiryId, data.intent);
  const brief = buildBrief({ ...data, reference });

  const insertPayload: Database["public"]["Tables"]["enquiries"]["Insert"] = {
    id: enquiryId,
    name: data.name,
    email: data.email,
    phone,
    brief_raw: brief,
    source: "list_property",
    timeline: toEnquiryTimeline(data.urgency),
    assigned_agent_id: advisor?.assignableUserId ?? null,
    inferred_constraints: {
      intent: toEnquiryIntent(data.intent),
      submitted_via: "web",
      lead_kind: "owner_listing",
      listing_intent: data.intent,
      location: data.location,
      area_slug: data.area_slug ?? null,
      category: data.category,
      property_type: data.property_type,
      bedrooms: data.bedrooms ?? null,
      area_sqft: data.area_sqft ?? null,
      furnishing: data.furnishing ?? null,
      urgency: data.urgency ?? null,
      call_window: data.call_window,
      consent: true,
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
    Sentry.captureException(error ?? new Error("list_property insert failed"), {
      tags: { component: "list-property/insert" },
    });
    return {
      status: "error",
      message:
        "Something went wrong sending that. Try again — your answers are still here.",
    };
  }

  revalidatePath("/admin/enquiries");

  // The owner wizard draws its own fields (two steps, conditional bedrooms,
  // a UAE-format mobile), so it doesn't go through `submitForm` — but its
  // answers still belong in /admin/forms → Responses alongside every other
  // form's. Best-effort: the lead is already written.
  await captureFormSubmission({
    formKey: "services_sell_list_property",
    sourcePath: "/services/sell",
    enquiryId: row.id,
    data: withLabels(
      {
        intent: data.intent,
        location: data.location,
        category: data.category,
        property_type: data.property_type,
        bedrooms: data.bedrooms ?? null,
        area_sqft: data.area_sqft ?? null,
        furnishing: data.furnishing ?? null,
        urgency: data.urgency ?? null,
        name: data.name,
        mobile: phone ?? data.mobile,
        email: data.email,
        call_window: data.call_window,
        consent: true,
        reference,
      },
      {
        intent: "I want to",
        location: "Where is the property?",
        category: "Category",
        property_type: "Property type",
        bedrooms: "Bedrooms",
        area_sqft: "Built-up area",
        furnishing: "Furnishing",
        urgency: "How soon?",
        name: "Your name",
        mobile: "Mobile",
        email: "Email",
        call_window: "Best time to call",
        consent: "Consent to be contacted",
        reference: "Reference",
      },
    ),
  });

  // Fire-and-forget confirmation. No-op without RESEND_API_KEY.
  const tpl = await enquiryAcknowledgementEmail({
    name: data.name,
    message: `${summary}\n\nYour reference is ${reference}.${
      advisor ? ` ${advisor.displayName} will call you.` : ""
    }`,
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
      tags: { component: "list-property/auto-reply" },
    });
  });

  return {
    status: "ok",
    reference,
    summary,
    callWindow: data.call_window,
    advisor: advisor
      ? {
          name: advisor.displayName,
          title: advisor.title,
          brn: advisor.brn,
          phone: advisor.phone,
          initials: advisor.initials,
          slug: advisor.slug,
        }
      : null,
  };
}

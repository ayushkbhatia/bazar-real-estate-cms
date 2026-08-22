"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import {
  valuationSubmissionSchema,
  normaliseValuationInput,
  type ValuationSubmission,
} from "@/lib/schemas/valuation";
import { estimateValuation } from "@/lib/valuation";
import { getAreaSlugById } from "@/lib/queries/areas";
import { sendEmail } from "@/lib/email";
import { valuationAcknowledgementEmail } from "@/lib/content-assets/system-emails";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import type { Database } from "@/db/types";

export type SubmitValuationResult =
  | {
      status: "ok";
      id: string;
      estimate: {
        lowAed: number;
        midAed: number;
        highAed: number;
      } | null;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export async function submitValuation(
  raw: Record<string, unknown>,
): Promise<SubmitValuationResult> {
  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };
  }

  const rl = await checkRateLimit({
    name: "valuation",
    ip: extractClientIp(await headers()),
    requests: 10,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    return { status: "error", message: rateLimitMessage(rl.retryAfterSeconds) };
  }

  const parsed = valuationSubmissionSchema.safeParse(
    normaliseValuationInput(raw),
  );
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

  const data: ValuationSubmission = parsed.data;

  const areaSlug = data.area_id ? await getAreaSlugById(data.area_id) : null;

  const estimate = estimateValuation({
    areaSlug,
    propertyType: data.property_type,
    beds: data.beds,
    baths: data.baths,
    builtUpFt2: data.built_up_ft2,
    floor: data.floor ?? null,
    condition: data.condition ?? null,
    upgrades: data.upgrades,
    furnishing: data.furnishing ?? null,
    view: data.view_description ?? null,
  });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const insertPayload: Database["public"]["Tables"]["valuation_requests"]["Insert"] =
    {
      account_id: user?.id ?? null,
      owner_name: data.owner_name,
      owner_email: data.owner_email,
      owner_phone: data.owner_phone || null,
      marketing_opt_in: data.marketing_opt_in,
      area_id: data.area_id || null,
      address_line: data.address_line || null,
      building_name: data.building_name || null,
      unit_number: data.unit_number || null,
      property_type: data.property_type,
      beds: data.beds,
      baths: data.baths,
      built_up_ft2: data.built_up_ft2,
      floor: data.floor ?? null,
      condition: data.condition ?? null,
      upgrades: data.upgrades,
      furnishing: data.furnishing ?? null,
      view_description: data.view_description ?? null,
      tenancy: data.tenancy ?? null,
      mortgage_state: data.mortgage_state ?? null,
      estimate_low_aed: estimate?.lowAed ?? null,
      estimate_mid_aed: estimate?.midAed ?? null,
      estimate_high_aed: estimate?.highAed ?? null,
      estimate_basis:
        estimate?.basis as unknown as Database["public"]["Tables"]["valuation_requests"]["Insert"]["estimate_basis"],
      status: "pending",
    };

  let insertedId: string;
  if (!user && env.SUPABASE_SERVICE_ROLE_KEY) {
    // Anonymous owners need a service-role insert (anon role can't pass
    // RLS even with an allow-anon policy unless we elevate). Mirrors the
    // pattern used for anonymous enquiries.
    const admin = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: row, error } = await admin
      .from("valuation_requests")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();
    if (error || !row)
      return {
        status: "error",
        message: error?.message ?? "Failed to submit your valuation.",
      };
    insertedId = row.id;
  } else {
    const { data: row, error } = await supabase
      .from("valuation_requests")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();
    if (error || !row)
      return {
        status: "error",
        message: error?.message ?? "Failed to submit your valuation.",
      };
    insertedId = row.id;
  }

  revalidatePath("/admin/valuations");

  // Fire-and-forget acknowledgement email. No-op if Resend is unset.
  if (data.owner_email && estimate) {
    const tpl = await valuationAcknowledgementEmail({
      name: data.owner_name,
      estimateLowAed: estimate.lowAed,
      estimateHighAed: estimate.highAed,
      estimateMidAed: estimate.midAed,
      addressLine: data.address_line || null,
      buildingName: data.building_name || null,
    });
    await sendEmail({
      to: data.owner_email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  }

  return {
    status: "ok",
    id: insertedId,
    estimate: estimate
      ? {
          lowAed: estimate.lowAed,
          midAed: estimate.midAed,
          highAed: estimate.highAed,
        }
      : null,
  };
}

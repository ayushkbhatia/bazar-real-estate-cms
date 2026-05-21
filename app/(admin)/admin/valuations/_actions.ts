"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { valuationReportTemplate } from "@/lib/email-templates";
import { logAudit } from "@/lib/audit";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const claimSchema = z.object({
  id: z.string().regex(uuidRegex, "Invalid id"),
});

const updateSchema = z.object({
  id: z.string().regex(uuidRegex, "Invalid id"),
  advisor_estimate_aed: z
    .union([z.number().positive("Must be positive"), z.null()])
    .optional(),
  advisor_notes: z.string().max(2000).nullable().optional(),
});

const sendReportSchema = z.object({
  id: z.string().regex(uuidRegex, "Invalid id"),
  advisor_estimate_aed: z
    .number({ message: "Final number is required" })
    .positive("Must be positive")
    .max(10_000_000_000),
  advisor_notes: z.string().max(2000).nullable().optional(),
});

type ActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

/** Set the row to 'in_review' and assign the current advisor. */
export async function claimValuationRequest(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return needConfig();
  const parsed = claimSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Invalid input." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign in to claim." };

  const { data: before } = await supabase
    .from("valuation_requests")
    .select("status, assigned_advisor_id")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const { error } = await supabase
    .from("valuation_requests")
    .update({
      status: "in_review",
      assigned_advisor_id: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "valuation.claim",
    target_kind: "valuation_request",
    target_id: parsed.data.id,
    before: before
      ? {
          status: before.status,
          assigned_advisor_id: before.assigned_advisor_id,
        }
      : null,
    after: { status: "in_review", assigned_advisor_id: user.id },
  });

  revalidatePath(`/admin/valuations/${parsed.data.id}`);
  revalidatePath("/admin/valuations");
  return { status: "ok" };
}

/** Save advisor draft (estimate + notes) without sending. */
export async function saveAdvisorDraft(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return needConfig();
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Invalid input." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("valuation_requests")
    .update({
      advisor_estimate_aed: parsed.data.advisor_estimate_aed ?? null,
      advisor_notes: parsed.data.advisor_notes ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "valuation.draft_saved",
    target_kind: "valuation_request",
    target_id: parsed.data.id,
    after: {
      advisor_estimate_aed: parsed.data.advisor_estimate_aed ?? null,
      advisor_notes: parsed.data.advisor_notes ?? null,
    },
  });

  revalidatePath(`/admin/valuations/${parsed.data.id}`);
  return { status: "ok" };
}

/** Persist the final number + notes, set status to 'sent', email the owner. */
export async function sendValuationReport(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return needConfig();
  const parsed = sendReportSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { status: "error", message: msg };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign in." };

  const { data: row, error: readErr } = await supabase
    .from("valuation_requests")
    .select(
      "id, owner_name, owner_email, building_name, address_line, estimate_low_aed, estimate_high_aed",
    )
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (readErr || !row)
    return {
      status: "error",
      message: readErr?.message ?? "Row not found.",
    };

  const sentAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("valuation_requests")
    .update({
      advisor_estimate_aed: parsed.data.advisor_estimate_aed,
      advisor_notes: parsed.data.advisor_notes ?? null,
      status: "sent",
      assigned_advisor_id: user.id,
      sent_at: sentAt,
      reviewed_at: sentAt,
    })
    .eq("id", parsed.data.id);
  if (updErr) return { status: "error", message: updErr.message };

  await logAudit({
    action: "valuation.report_sent",
    target_kind: "valuation_request",
    target_id: parsed.data.id,
    after: {
      advisor_estimate_aed: parsed.data.advisor_estimate_aed,
      status: "sent",
    },
  });

  // Look up the advisor's display name for the email signature.
  const { data: staff } = await supabase
    .from("staff")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const tpl = valuationReportTemplate({
    name: row.owner_name,
    finalEstimateAed: parsed.data.advisor_estimate_aed,
    rangeLowAed: row.estimate_low_aed ? Number(row.estimate_low_aed) : null,
    rangeHighAed: row.estimate_high_aed ? Number(row.estimate_high_aed) : null,
    advisorName: staff?.display_name ?? null,
    advisorNotes: parsed.data.advisor_notes ?? null,
    addressLine: row.address_line,
    buildingName: row.building_name,
  });
  const emailResult = await sendEmail({
    to: row.owner_email,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });
  if (emailResult.status === "error") {
    // Row was updated but the email bounced — surface so the advisor can retry.
    return {
      status: "error",
      message: `Saved, but the email failed: ${emailResult.message}. Resend from the row to retry.`,
    };
  }

  revalidatePath(`/admin/valuations/${parsed.data.id}`);
  revalidatePath("/admin/valuations");
  return { status: "ok" };
}

/** Move a row to 'archived' without sending anything. */
export async function archiveValuationRequest(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return needConfig();
  const parsed = claimSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Invalid input." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("valuation_requests")
    .update({ status: "archived" })
    .eq("id", parsed.data.id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "valuation.archived",
    target_kind: "valuation_request",
    target_id: parsed.data.id,
    after: { status: "archived" },
  });

  revalidatePath(`/admin/valuations/${parsed.data.id}`);
  revalidatePath("/admin/valuations");
  return { status: "ok" };
}

function needConfig(): ActionResult {
  return {
    status: "error",
    message: "Supabase is not configured.",
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

const DEAL_ROLES = ["admin", "editor", "agent"] as const;

export type CreateDealResult =
  | { status: "ok"; dealId: string }
  | { status: "error"; message: string };

const MIN_PRICE = 100_000;
const MAX_PRICE = 1_000_000_000;
const MIN_FEE_PCT = 0;
const MAX_FEE_PCT = 10;

export async function createDealFromEnquiry(input: {
  enquiryId: string;
  priceAed: number;
  advisoryFeePct: number;
  leadAgentId?: string | null;
  notes?: string | null;
}): Promise<CreateDealResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DEAL_ROLES);

  if (!Number.isFinite(input.priceAed) || input.priceAed < MIN_PRICE || input.priceAed > MAX_PRICE)
    return {
      status: "error",
      message: `Price must be between AED ${MIN_PRICE.toLocaleString()} and AED ${MAX_PRICE.toLocaleString()}.`,
    };
  if (
    !Number.isFinite(input.advisoryFeePct) ||
    input.advisoryFeePct < MIN_FEE_PCT ||
    input.advisoryFeePct > MAX_FEE_PCT
  )
    return {
      status: "error",
      message: `Advisory fee must be between ${MIN_FEE_PCT}% and ${MAX_FEE_PCT}%.`,
    };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign-in required." };

  // Pull the enquiry — must exist, be closed_won, and link to a property +
  // account so we have a buyer.
  const { data: enquiry } = await supabase
    .from("enquiries")
    .select("id, status, property_id, account_id, assigned_agent_id")
    .eq("id", input.enquiryId)
    .maybeSingle();
  if (!enquiry)
    return { status: "error", message: "Enquiry not found / not allowed." };
  if (enquiry.status !== "closed_won")
    return {
      status: "error",
      message:
        "Enquiry must be marked Won before promoting to a deal.",
    };
  if (!enquiry.property_id)
    return {
      status: "error",
      message: "Enquiry has no property — link a property before promoting.",
    };
  if (!enquiry.account_id)
    return {
      status: "error",
      message:
        "Enquiry has no signed-in account — the buyer must register before a deal can be opened.",
    };

  // Guard against double-promotion.
  const { data: existing } = await supabase
    .from("deals")
    .select("id")
    .eq("enquiry_id", enquiry.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing)
    return { status: "error", message: "A deal already exists for this enquiry." };

  const advisoryFee = (input.priceAed * input.advisoryFeePct) / 100;
  const leadAgentId =
    input.leadAgentId ?? enquiry.assigned_agent_id ?? user.id;

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      property_id: enquiry.property_id,
      buyer_account_id: enquiry.account_id,
      lead_agent_id: leadAgentId,
      enquiry_id: enquiry.id,
      price_aed: input.priceAed,
      advisory_fee_aed: advisoryFee,
      stage: "mou",
      notes: input.notes?.trim() ? input.notes.trim() : null,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !deal)
    return {
      status: "error",
      message: error?.message ?? "Failed to create deal.",
    };

  await logAudit({
    action: "deal.created",
    target_kind: "deal",
    target_id: deal.id,
    before: null,
    after: {
      enquiry_id: enquiry.id,
      property_id: enquiry.property_id,
      buyer_account_id: enquiry.account_id,
      lead_agent_id: leadAgentId,
      price_aed: input.priceAed,
      advisory_fee_aed: advisoryFee,
      stage: "mou",
    },
  });

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiry.id}`);
  revalidatePath("/admin/deals");
  return { status: "ok", dealId: deal.id };
}

export async function createDealFromEnquiryAndRedirect(input: {
  enquiryId: string;
  priceAed: number;
  advisoryFeePct: number;
  leadAgentId?: string | null;
  notes?: string | null;
}): Promise<CreateDealResult> {
  const res = await createDealFromEnquiry(input);
  if (res.status === "error") return res;
  redirect(`/admin/deals/${res.dealId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import type { Database } from "@/db/types";

type Status = Database["public"]["Enums"]["enquiry_status"];
type Temperature = Database["public"]["Enums"]["enquiry_temperature"];

export type EnquiryActionResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string };

const VALID_STATUSES: Status[] = [
  "new",
  "qualified",
  "viewing_scheduled",
  "offer",
  "closed_won",
  "closed_lost",
];

const VALID_TEMPERATURES: Temperature[] = ["cold", "warm", "hot"];

type StaffCtxOk = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: { id: string };
};
type StaffCtxErr = { error: string };
type StaffCtx = StaffCtxOk | StaffCtxErr;

function isStaffErr(c: StaffCtx): c is StaffCtxErr {
  return "error" in c;
}

async function getStaffSupabase(): Promise<StaffCtx> {
  if (!isSupabaseConfigured)
    return { error: "Supabase env vars are not set." };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign-in required." };
  return { supabase, user };
}

export async function setEnquiryStatus(
  enquiryId: string,
  next: Status,
): Promise<EnquiryActionResult> {
  if (!VALID_STATUSES.includes(next))
    return { status: "error", message: "Unknown status." };
  const ctx = await getStaffSupabase();
  if (isStaffErr(ctx)) return { status: "error", message: ctx.error };

  const { data: before } = await ctx.supabase
    .from("enquiries")
    .select("status")
    .eq("id", enquiryId)
    .maybeSingle();

  const closing = next === "closed_won" || next === "closed_lost";
  const { error, data } = await ctx.supabase
    .from("enquiries")
    .update({
      status: next,
      closed_at: closing ? new Date().toISOString() : null,
    })
    .eq("id", enquiryId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / not allowed." };

  await logAudit({
    action: "enquiry.status_change",
    target_kind: "enquiry",
    target_id: enquiryId,
    before: { status: before?.status ?? null },
    after: { status: next },
  });

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  revalidatePath("/admin");
  return { status: "ok", message: "Status updated." };
}

export async function setEnquiryTemperature(
  enquiryId: string,
  next: Temperature,
): Promise<EnquiryActionResult> {
  if (!VALID_TEMPERATURES.includes(next))
    return { status: "error", message: "Unknown temperature." };
  const ctx = await getStaffSupabase();
  if (isStaffErr(ctx)) return { status: "error", message: ctx.error };

  const { data: before } = await ctx.supabase
    .from("enquiries")
    .select("temperature")
    .eq("id", enquiryId)
    .maybeSingle();

  const { error, data } = await ctx.supabase
    .from("enquiries")
    .update({ temperature: next })
    .eq("id", enquiryId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / not allowed." };

  await logAudit({
    action: "enquiry.temperature_change",
    target_kind: "enquiry",
    target_id: enquiryId,
    before: { temperature: before?.temperature ?? null },
    after: { temperature: next },
  });

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return { status: "ok", message: "Temperature updated." };
}

export async function assignEnquiryToMe(
  enquiryId: string,
): Promise<EnquiryActionResult> {
  const ctx = await getStaffSupabase();
  if (isStaffErr(ctx)) return { status: "error", message: ctx.error };

  const { data: before } = await ctx.supabase
    .from("enquiries")
    .select("assigned_agent_id")
    .eq("id", enquiryId)
    .maybeSingle();

  const { error, data } = await ctx.supabase
    .from("enquiries")
    .update({ assigned_agent_id: ctx.user.id })
    .eq("id", enquiryId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / not allowed." };

  await logAudit({
    action: "enquiry.assigned",
    target_kind: "enquiry",
    target_id: enquiryId,
    before: { assigned_agent_id: before?.assigned_agent_id ?? null },
    after: { assigned_agent_id: ctx.user.id },
  });

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return { status: "ok", message: "Assigned to you." };
}

export async function markConversationRead(
  enquiryId: string,
): Promise<EnquiryActionResult> {
  const ctx = await getStaffSupabase();
  if (isStaffErr(ctx)) return { status: "error", message: ctx.error };

  const { data: conv } = await ctx.supabase
    .from("conversations")
    .select("id")
    .eq("enquiry_id", enquiryId)
    .maybeSingle();
  if (!conv) return { status: "error", message: "Conversation not found." };

  const { error } = await ctx.supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conv.id)
    .eq("direction", "inbound")
    .is("read_at", null);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return { status: "ok" };
}

export async function updateInternalNotes(
  enquiryId: string,
  notes: string,
): Promise<EnquiryActionResult> {
  const ctx = await getStaffSupabase();
  if (isStaffErr(ctx)) return { status: "error", message: ctx.error };

  const trimmed = notes.trim().slice(0, 4000);
  const { error, data } = await ctx.supabase
    .from("enquiries")
    .update({ internal_notes: trimmed === "" ? null : trimmed })
    .eq("id", enquiryId)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / not allowed." };

  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return { status: "ok", message: "Notes saved." };
}

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { staffReplyTemplate } from "@/lib/email-templates";
import { requireRole } from "@/lib/auth";
import type { Database } from "@/db/types";

const ENQUIRY_WRITE_ROLES = ["admin", "editor", "agent"] as const;
const ENQUIRY_READ_ROLES = [
  "admin",
  "editor",
  "agent",
  "support",
] as const;

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
  if (isSupabaseConfigured) await requireRole(ENQUIRY_WRITE_ROLES);
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
  if (isSupabaseConfigured) await requireRole(ENQUIRY_WRITE_ROLES);
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
  if (isSupabaseConfigured) await requireRole(ENQUIRY_WRITE_ROLES);
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
  if (isSupabaseConfigured) await requireRole(ENQUIRY_READ_ROLES);
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

export type SendMessageResult =
  | { status: "ok"; messageId: string }
  | { status: "error"; message: string };

export async function sendMessage(
  enquiryId: string,
  bodyRaw: string,
): Promise<SendMessageResult> {
  if (isSupabaseConfigured) await requireRole(ENQUIRY_WRITE_ROLES);
  const ctx = await getStaffSupabase();
  if (isStaffErr(ctx)) return { status: "error", message: ctx.error };

  const body = bodyRaw.trim();
  if (body.length < 2)
    return { status: "error", message: "Write something first." };
  if (body.length > 4000)
    return { status: "error", message: "Trim to under 4000 characters." };

  const { data: enquiry } = await ctx.supabase
    .from("enquiries")
    .select(
      "first_response_at, name, email, property_id, properties:property_id(reference)",
    )
    .eq("id", enquiryId)
    .maybeSingle();
  if (!enquiry)
    return { status: "error", message: "Enquiry not found / not allowed." };

  const { data: staffRow } = await ctx.supabase
    .from("staff")
    .select("display_name")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  const { data: conv } = await ctx.supabase
    .from("conversations")
    .select("id")
    .eq("enquiry_id", enquiryId)
    .maybeSingle();
  if (!conv)
    return { status: "error", message: "Conversation row missing." };

  const { data: msg, error: msgErr } = await ctx.supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      direction: "outbound",
      author_kind: "staff",
      author_id: ctx.user.id,
      body,
      channel: "web",
    })
    .select("id")
    .maybeSingle();

  if (msgErr || !msg)
    return {
      status: "error",
      message: msgErr?.message ?? "Failed to send.",
    };

  // First-response stamp + bump status from `new` → `qualified` on first reply.
  if (!enquiry.first_response_at) {
    await ctx.supabase
      .from("enquiries")
      .update({
        first_response_at: new Date().toISOString(),
        status: "qualified",
      })
      .eq("id", enquiryId);
  }

  await logAudit({
    action: "enquiry.reply_sent",
    target_kind: "enquiry",
    target_id: enquiryId,
    before: null,
    after: { message_id: msg.id, length: body.length, channel: "web" },
  });

  // Best-effort email forward to the lead.
  if (enquiry.email) {
    const propRef =
      (enquiry.properties as { reference: string } | null)?.reference ?? null;
    const tpl = staffReplyTemplate({
      name: enquiry.name,
      body,
      staffDisplayName: staffRow?.display_name ?? null,
      propertyReference: propRef,
    });
    await sendEmail({
      to: enquiry.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  }

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return { status: "ok", messageId: msg.id };
}

export async function updateInternalNotes(
  enquiryId: string,
  notes: string,
): Promise<EnquiryActionResult> {
  if (isSupabaseConfigured) await requireRole(ENQUIRY_WRITE_ROLES);
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

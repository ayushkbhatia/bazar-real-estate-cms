"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { staffReplyTemplate } from "@/lib/email-templates";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { requireRole } from "@/lib/auth";
import type { Database } from "@/db/types";

const ENQUIRY_WRITE_ROLES = ["admin", "editor", "agent"] as const;
const ENQUIRY_READ_ROLES = [
  "admin",
  "editor",
  "agent",
  "support",
] as const;
/**
 * Archiving takes a lead out of every advisor's inbox, so it is the one
 * enquiry action reserved for the top role. `admin` is that role — the
 * `staff_role` enum has no separate super-admin tier; `admin` is the
 * "Full access" one (see `lib/schemas/staff.ts#ROLE_DESCRIPTION`).
 *
 * Migration 0116 enforces the same rule in Postgres with a BEFORE UPDATE
 * trigger, so a direct PostgREST call can't route around this line.
 */
const ENQUIRY_ARCHIVE_ROLES = ["admin"] as const;

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
    // An archived lead is out of the working set; nothing else may move it
    // until an admin restores it. Costs one predicate per write and closes
    // the gap left by the detail page still being reachable by URL.
    .is("archived_at", null)
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
    .is("archived_at", null)
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
    .is("archived_at", null)
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

/**
 * The three ways an advisor reaches a lead from the enquiry route.
 *
 * `whatsapp` is a deep-link handoff, not an API send: there is no WhatsApp
 * Business Cloud integration here (lib/whatsapp.ts builds wa.me URLs). The
 * action records that the advisor opened the chat and returns the URL for the
 * client to open; it cannot and does not claim delivery.
 */
export type TouchChannel = "email" | "whatsapp" | "call";

export type SendTouchResult =
  | {
      status: "ok";
      messageId: string;
      /** Set for `whatsapp` — the client opens this in a new tab. */
      whatsappUrl?: string;
      message: string;
    }
  | { status: "error"; message: string };

export async function sendEnquiryTouch(
  enquiryId: string,
  input: { channel: TouchChannel; body: string; subject?: string | null },
): Promise<SendTouchResult> {
  if (isSupabaseConfigured) await requireRole(ENQUIRY_WRITE_ROLES);
  const ctx = await getStaffSupabase();
  if (isStaffErr(ctx)) return { status: "error", message: ctx.error };

  const body = input.body.trim();
  if (body.length < 2)
    return { status: "error", message: "Write something first." };
  if (body.length > 4000)
    return { status: "error", message: "Trim to under 4000 characters." };

  const { data: enquiry } = await ctx.supabase
    .from("enquiries")
    .select(
      "first_response_at, name, email, phone, property_id, archived_at, properties:property_id(reference)",
    )
    .eq("id", enquiryId)
    .maybeSingle();
  if (!enquiry)
    return { status: "error", message: "Enquiry not found / not allowed." };
  // Checked before the send, not after: the outward work here is a real
  // email or a WhatsApp hand-off, and an archived lead must not receive one.
  if (enquiry.archived_at !== null)
    return {
      status: "error",
      message: "This enquiry is archived — restore it before replying.",
    };

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
  if (!conv) return { status: "error", message: "Conversation row missing." };

  const propRef =
    (enquiry.properties as { reference: string } | null)?.reference ?? null;

  // ── Do the outward work FIRST, and only log what actually happened. ──
  // A message row is the record of a touch; writing one for a send that
  // failed would put a message in the lead's inbox history that they never
  // received, and stamp an SLA response that never went out.
  let whatsappUrl: string | undefined;
  let confirmation: string;

  if (input.channel === "email") {
    if (!enquiry.email)
      return { status: "error", message: "No email address on this lead." };

    const tpl = staffReplyTemplate({
      name: enquiry.name,
      body,
      staffDisplayName: staffRow?.display_name ?? null,
      propertyReference: propRef,
      subject: input.subject ?? null,
    });
    const sent = await sendEmail({
      to: enquiry.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
    if (sent.status === "error")
      return { status: "error", message: `Email failed: ${sent.message}` };
    if (sent.status === "skipped")
      return {
        status: "error",
        message:
          "Email isn't configured on this environment, so nothing was sent.",
      };
    confirmation = `Emailed ${enquiry.email}.`;
  } else if (input.channel === "whatsapp") {
    if (!enquiry.phone)
      return { status: "error", message: "No phone number on this lead." };
    const url = buildWhatsAppLink(enquiry.phone, body);
    if (!url)
      return {
        status: "error",
        message: "That phone number isn't a valid WhatsApp number.",
      };
    whatsappUrl = url;
    confirmation = "WhatsApp opened — the message is in your composer there.";
  } else {
    confirmation = "Call logged.";
  }

  const { data: msg, error: msgErr } = await ctx.supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      direction: "outbound",
      author_kind: "staff",
      author_id: ctx.user.id,
      body,
      channel: input.channel,
    })
    .select("id")
    .maybeSingle();

  if (msgErr || !msg)
    return { status: "error", message: msgErr?.message ?? "Failed to log." };

  // First-response stamp + bump `new` → `qualified`. Any outbound touch counts
  // — an advisor who phoned or messaged the lead on WhatsApp should not still
  // read as unresponded to the escalation banner and the escalation cron.
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
    action: "enquiry.touch_sent",
    target_kind: "enquiry",
    target_id: enquiryId,
    before: null,
    after: {
      message_id: msg.id,
      length: body.length,
      channel: input.channel,
    },
  });

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return {
    status: "ok",
    messageId: msg.id,
    whatsappUrl,
    message: confirmation,
  };
}

/**
 * Archive or restore a lead. Admin-only, audited, reversible.
 *
 * Archiving is not a status change and not a delete: the pipeline stage,
 * the conversation and the audit trail all survive untouched, and the row
 * simply stops appearing in the inbox, the Kanban board, the dashboard
 * counts and the escalation cron. Restoring puts it back exactly where it
 * was — which is why `status` is deliberately never written here.
 *
 * Nothing is erased, so this is not a PDPL deletion route; that stays with
 * the DSR console.
 */
export async function setEnquiryArchived(
  enquiryId: string,
  archived: boolean,
): Promise<EnquiryActionResult> {
  if (isSupabaseConfigured) await requireRole(ENQUIRY_ARCHIVE_ROLES);
  const ctx = await getStaffSupabase();
  if (isStaffErr(ctx)) return { status: "error", message: ctx.error };

  const { data: before } = await ctx.supabase
    .from("enquiries")
    .select("archived_at, status")
    .eq("id", enquiryId)
    .maybeSingle();
  if (!before) return { status: "error", message: "Not found / not allowed." };

  // Guard the no-op rather than writing a fresh timestamp over an existing
  // one: a second archive would otherwise move the filing date and log a
  // meaningless audit row.
  if (archived && before.archived_at !== null)
    return { status: "error", message: "Already archived." };
  if (!archived && before.archived_at === null)
    return { status: "error", message: "This enquiry isn't archived." };

  const nowIso = new Date().toISOString();
  const { error, data } = await ctx.supabase
    .from("enquiries")
    .update({
      archived_at: archived ? nowIso : null,
      // Cleared on restore so the pair never disagrees about whether the
      // row is filed and who filed it.
      archived_by: archived ? ctx.user.id : null,
    })
    .eq("id", enquiryId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / not allowed." };

  await logAudit({
    action: archived ? "enquiry.archived" : "enquiry.restored",
    target_kind: "enquiry",
    target_id: enquiryId,
    before: { archived_at: before.archived_at, status: before.status },
    after: {
      archived_at: archived ? nowIso : null,
      archived_by: archived ? ctx.user.id : null,
      status: before.status,
    },
  });

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  revalidatePath("/admin");
  return {
    status: "ok",
    message: archived ? "Enquiry archived." : "Enquiry restored.",
  };
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
    // Deliberately NOT archive-guarded: "archived as spam, see ticket 412"
    // is exactly the note someone needs to leave on a filed lead.
    .update({ internal_notes: trimmed === "" ? null : trimmed })
    .eq("id", enquiryId)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / not allowed." };

  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return { status: "ok", message: "Notes saved." };
}

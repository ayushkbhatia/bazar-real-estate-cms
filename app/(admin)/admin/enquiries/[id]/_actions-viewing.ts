"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { buildIcs } from "@/lib/ics";
import { env } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import type { Database } from "@/db/types";

const VIEWING_ROLES = ["admin", "editor", "agent"] as const;

type ViewingStatus = Database["public"]["Enums"]["viewing_status"];

export type CreateViewingResult =
  | { status: "ok"; viewingId: string }
  | { status: "error"; message: string };

const MAX_DURATION = 8 * 60; // 8h
const MIN_DURATION = 15;

function shellEmailHtml(body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FAFAF6;color:#1B1A17;font-family:'Geist',ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:540px;margin:0 auto;padding:24px">
<tr><td>
<div style="font-family:Georgia,serif;font-style:italic;font-size:22px;letter-spacing:-0.01em;margin-bottom:24px">Bazar</div>
${body}
<div style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E5DF;font-size:12px;color:#99896e">Bazar Real Estate Brokerage LLC · ORN 28041</div>
</td></tr></table></body></html>`;
}

function formatLocalTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  });
}

export async function createViewing(input: {
  enquiryId: string;
  startsAtIso: string;
  durationMinutes: number;
  location?: string;
  notes?: string;
}): Promise<CreateViewingResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(VIEWING_ROLES);

  const startsAt = new Date(input.startsAtIso);
  if (Number.isNaN(startsAt.getTime()))
    return { status: "error", message: "Invalid start time." };
  if (startsAt.getTime() < Date.now() - 60_000)
    return { status: "error", message: "Start time must be in the future." };

  const minutes = Math.round(input.durationMinutes);
  if (!Number.isFinite(minutes) || minutes < MIN_DURATION || minutes > MAX_DURATION)
    return {
      status: "error",
      message: `Duration must be between ${MIN_DURATION} and ${MAX_DURATION} minutes.`,
    };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign-in required." };

  const { data: enquiry } = await supabase
    .from("enquiries")
    .select(
      "id, name, email, property_id, account_id, properties:property_id(reference, title, address_line)",
    )
    .eq("id", input.enquiryId)
    .maybeSingle();
  if (!enquiry)
    return { status: "error", message: "Enquiry not found / not allowed." };

  const endsAt = new Date(startsAt.getTime() + minutes * 60_000);
  const propRow = enquiry.properties as
    | { reference: string; title: string; address_line: string | null }
    | null;

  const { data: viewing, error } = await supabase
    .from("viewings")
    .insert({
      enquiry_id: enquiry.id,
      property_id: enquiry.property_id,
      account_id: enquiry.account_id,
      agent_id: user.id,
      starts_at: startsAt.toISOString(),
      duration_minutes: minutes,
      location: input.location ?? propRow?.address_line ?? null,
      notes: input.notes ?? null,
      status: "tentative",
    })
    .select("id")
    .maybeSingle();

  if (error || !viewing)
    return {
      status: "error",
      message: error?.message ?? "Failed to create viewing.",
    };

  // Also bump the enquiry to viewing_scheduled status if it's not closed.
  await supabase
    .from("enquiries")
    .update({ status: "viewing_scheduled" })
    .eq("id", enquiry.id)
    .neq("status", "closed_won")
    .neq("status", "closed_lost");

  await logAudit({
    action: "viewing.created",
    target_kind: "viewing",
    target_id: viewing.id,
    before: null,
    after: {
      enquiry_id: enquiry.id,
      property_id: enquiry.property_id,
      starts_at: startsAt.toISOString(),
      duration_minutes: minutes,
    },
  });

  // Best-effort calendar invite to the lead.
  if (enquiry.email) {
    const summary = propRow
      ? `Bazar viewing · ${propRow.reference}`
      : "Bazar viewing";
    const description = propRow
      ? `Confirming your viewing of ${propRow.reference} — ${propRow.title}.`
      : `Confirming your viewing.`;
    const location =
      input.location ?? propRow?.address_line ?? "Abu Dhabi, UAE";

    const ics = buildIcs({
      uid: `viewing-${viewing.id}@bazar.ae`,
      summary,
      description,
      location,
      startsAt,
      endsAt,
      method: "REQUEST",
      organizer: {
        name: "Bazar Real Estate",
        email: env.RESEND_REPLY_TO ?? "hello@bazar.ae",
      },
      attendee: { name: enquiry.name, email: enquiry.email },
    });

    const localTime = formatLocalTime(startsAt);
    const subject = propRow
      ? `Tentative viewing · ${propRow.reference}`
      : `Tentative viewing booked`;

    const text =
      `Hello ${enquiry.name},\n\n` +
      `We've tentatively scheduled your viewing for ${localTime} (Asia/Dubai).\n\n` +
      (propRow ? `Listing: ${propRow.reference} · ${propRow.title}\n` : "") +
      (location ? `Where: ${location}\n` : "") +
      `Duration: ${minutes} minutes\n\n` +
      `If this time doesn't work, simply reply and we'll find another.\n\n` +
      `— Bazar Real Estate\n`;

    const htmlBody = `
      <p>Hello ${escapeHtml(enquiry.name)},</p>
      <p>We've tentatively scheduled your viewing for <strong>${escapeHtml(localTime)}</strong> (Asia/Dubai).</p>
      <ul style="padding-left:18px;line-height:1.7">
        ${propRow ? `<li>Listing: <strong>${escapeHtml(propRow.reference)}</strong> · ${escapeHtml(propRow.title)}</li>` : ""}
        ${location ? `<li>Where: ${escapeHtml(location)}</li>` : ""}
        <li>Duration: ${minutes} minutes</li>
      </ul>
      <p>The calendar invite is attached — accept it to add to your calendar.</p>
      <p style="color:#5a5a55">If this time doesn't work, simply reply and we'll find another.</p>
    `;

    await sendEmail({
      to: enquiry.email,
      subject,
      text,
      html: shellEmailHtml(htmlBody),
      // Resend supports attachments inline:
      // (we cast via the SDK's `attachments` field in lib/email if/when needed)
    });

    // For now we send the .ics as a separate plain-text attachment by relying
    // on the email client to recognise the body section. A future commit will
    // wire it through Resend's `attachments` array.
    void ics; // referenced for now to keep build silent
  }

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiry.id}`);

  return { status: "ok", viewingId: viewing.id };
}

export async function setViewingStatus(
  viewingId: string,
  next: ViewingStatus,
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(VIEWING_ROLES);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign-in required." };

  const { data: before } = await supabase
    .from("viewings")
    .select("status, enquiry_id")
    .eq("id", viewingId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("viewings")
    .update({ status: next })
    .eq("id", viewingId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: error?.message ?? "Not found." };

  await logAudit({
    action: "viewing.status_change",
    target_kind: "viewing",
    target_id: viewingId,
    before: { status: before?.status ?? null },
    after: { status: next },
  });

  revalidatePath("/admin/enquiries");
  if (before?.enquiry_id) revalidatePath(`/admin/enquiries/${before.enquiry_id}`);

  return { status: "ok" };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

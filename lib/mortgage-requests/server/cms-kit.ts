import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getCurrentStaffRow, getCurrentUser } from "@/lib/auth";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import { sendEmail } from "@/lib/email";
import { reportError } from "@/lib/observability";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cmsT } from "../cms-strings";
import { getMortgageRole } from "./cms-auth";
import { MAX_ATTEMPTS, scrubReason } from "./notify";

/**
 * What every mortgage CMS action shares (docs/mortgage SPEC §4.3): who is
 * calling, the database's refusals as the page shows them, the paths to
 * revalidate, and the record of a message an action sends itself.
 */

export type MortgageActionResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      code: "not_allowed" | "not_found" | "conflict" | "slot_taken" | "invalid" | "failed";
      message: string;
      /** For a form: the fields to highlight. */
      fields?: string[];
    };

export const NOT_ALLOWED: MortgageActionResult = { ok: false, code: "not_allowed", message: cmsT("common.notOwner") };
export const INVALID: MortgageActionResult = { ok: false, code: "invalid", message: cmsT("common.failed") };
export const FAILED: MortgageActionResult = { ok: false, code: "failed", message: cmsT("common.failed") };

/** The caller, when they are active staff on the mortgage team; null otherwise. */
export async function teamSession() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [staff, role] = await Promise.all([getCurrentStaffRow(), getMortgageRole()]);
  if (!staff || staff.status !== "active" || !role) return null;
  return { user, staff, role, supabase: await createSupabaseServerClient() };
}

/** A database refusal as the page shows it. SQLSTATEs from 0139, 0143 and 0145. */
export function refused(error: { code?: string; message: string }, source: string): MortgageActionResult {
  switch (error.code) {
    case "MR403":
      return NOT_ALLOWED;
    case "MR404":
      return { ok: false, code: "not_found", message: cmsT("common.notFound") };
    case "MR409":
      return error.message.includes("slot_taken")
        ? { ok: false, code: "slot_taken", message: cmsT("c6.book.taken") }
        : { ok: false, code: "conflict", message: cmsT("common.conflict") };
    case "MR422":
      return error.message.includes("slot has passed")
        ? { ok: false, code: "invalid", message: cmsT("c6.book.passed") }
        : INVALID;
    default:
      // The code only: the message can quote a value.
      void reportError(new Error(`mortgage action failed (${error.code ?? "unknown"})`), { source });
      return FAILED;
  }
}

/** The queue, and a request's file, its decision and one of its documents, when named. */
export function refreshMortgagePaths(reference?: string, documentKind?: string) {
  revalidatePath("/admin/mortgages");
  if (reference) revalidatePath(`/admin/mortgages/${reference}`);
  if (reference) revalidatePath(`/admin/mortgages/${reference}/decision`);
  if (reference && documentKind) revalidatePath(`/admin/mortgages/${reference}/documents/${documentKind}`);
}

const UUID = z.string().uuid();
export const targetSchema = z.object({
  requestId: UUID,
  reference: z.string().regex(/^BZM-\d{2}-\d{4,}$/),
  updatedAt: z.string().min(10).max(40),
});
export type Target = z.infer<typeof targetSchema>;

/**
 * Send an email that carries a secure link, and record what happened. The
 * token exists only in the email — the database keeps its hash — so it can't
 * wait in the outbox: the row is the record, never retried (a failed send is
 * retried by sending a new link). WhatsApp is recorded as not connected (D1).
 */
export async function sendLinkEmail(
  admin: SupabaseClient,
  input: {
    requestId: string;
    kind: "preapproval_invite" | "reupload_request" | "bank_package" | "bank_reminder";
    dedupe: string;
    to: string;
    replyTo?: string | null;
    email: RenderedEmail;
    whatsapp: boolean;
    source: string;
  },
): Promise<"sent" | "skipped" | "failed"> {
  let status: "sent" | "skipped" | "failed" = "failed";
  let providerId: string | null = null;
  let reason: string | null = null;
  try {
    const sent = await sendEmail({
      to: input.to,
      subject: input.email.subject,
      text: input.email.text,
      html: input.email.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    if (sent.status === "ok") {
      status = "sent";
      providerId = sent.id;
    } else if (sent.status === "skipped") {
      status = "skipped";
      reason = sent.reason;
    } else {
      reason = sent.message;
    }
  } catch (e) {
    reason = e instanceof Error ? e.message : String(e);
  }

  const at = new Date().toISOString();
  const rows: Record<string, unknown>[] = [
    {
      request_id: input.requestId,
      kind: input.kind,
      channel: "email",
      status,
      attempts: MAX_ATTEMPTS,
      dedupe: input.dedupe,
      sent_at: status === "sent" ? at : null,
      provider_id: providerId,
      last_error: reason ? scrubReason(reason) : null,
    },
  ];
  if (input.whatsapp) {
    rows.push({
      request_id: input.requestId,
      kind: input.kind,
      channel: "whatsapp",
      status: "skipped",
      attempts: MAX_ATTEMPTS,
      dedupe: input.dedupe,
      last_error: "whatsapp isn't connected yet",
    });
  }
  const { error } = await admin.from("mortgage_notifications").insert(rows);
  if (error) await reportError(new Error(`send record failed (${error.code})`), { source: input.source });
  await admin.from("mortgage_events").insert({
    request_id: input.requestId,
    actor_kind: "system",
    type: `notification.${status}`,
    data: { kind: input.kind, channel: "email" },
    created_at: at,
  });
  return status;
}

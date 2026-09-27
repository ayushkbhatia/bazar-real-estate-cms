import "server-only";
import {
  sendEmail,
  type SendEmailInput,
  type SendEmailResult,
} from "@/lib/email";
import { reportError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Send a new lead its acknowledgement, and record on the row that it went out.
 *
 * Two things acknowledge a lead. The intake action that wrote the row sends
 * the email inline, the moment the visitor presses the button. Behind it,
 * /api/cron/enquiry-auto-reply sweeps every minute for rows whose
 * `ack_sent_at` is still null and sends them the same email — the fallback for
 * a send that failed or was skipped. The inline sends never stamped that
 * column, so to the sweep every lead looked unacknowledged, and every visitor
 * who left an email address got the acknowledgement twice.
 *
 * So the stamp belongs with the send, and only on `ok`. A send that errored
 * or was skipped leaves the column null, which is exactly what hands the lead
 * to the sweep for another try.
 *
 * Never throws over the stamp. By then the lead is saved and the email has
 * gone; a failed write costs at worst the duplicate this exists to prevent,
 * which is no reason to show the visitor an error.
 */
export async function sendEnquiryAcknowledgement(
  enquiryId: string,
  email: SendEmailInput,
): Promise<SendEmailResult> {
  const result = await sendEmail(email);
  if (result.status === "ok") await markAcknowledged(enquiryId);
  return result;
}

async function markAcknowledged(enquiryId: string): Promise<void> {
  try {
    // Service role, as the intake's own insert is: the visitor is anonymous.
    // Without the key there is no sweep either — it needs the same one — so
    // there is nothing to keep it away from.
    const admin = createAdminClient();
    if (!admin) return;
    const { error } = await admin
      .from("enquiries")
      .update({ ack_sent_at: new Date().toISOString() })
      .eq("id", enquiryId)
      // If the sweep somehow got there first, its time is the true one.
      .is("ack_sent_at", null);
    if (error) throw error;
  } catch (err) {
    await reportError(err, {
      source: "enquiry-acknowledgement/stamp",
      level: "warning",
      context: { enquiryId },
    });
  }
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDataExport, type DataExportPayload } from "@/lib/dsr";

/**
 * Data-subject lookup, keyed by email.
 *
 * With customer accounts removed, everything Bazar holds about a person hangs
 * off their email address rather than an `accounts` row: enquiries and their
 * message threads, valuation requests, mortgage enquiries and the newsletter
 * list.
 *
 * Service-role throughout — the subject has no session, and a staff member is
 * acting on their behalf after verifying identity over email. RLS would hide
 * most of this from an ordinary staff client.
 */

export type SubjectTally = {
  enquiries: number;
  messages: number;
  valuation_requests: number;
  mortgage_inquiries: number;
  newsletter: number;
};

export type SubjectRecord = {
  email: string;
  found: boolean;
  tally: SubjectTally;
  export: DataExportPayload;
};

const EMPTY: SubjectTally = {
  enquiries: 0,
  messages: 0,
  valuation_requests: 0,
  mortgage_inquiries: 0,
  newsletter: 0,
};

/**
 * Everything held about one address, plus the export archive.
 *
 * Returns `found: false` rather than throwing when nothing matches — "we hold
 * no data about you" is a legitimate and reportable answer to an access
 * request, not an error.
 */
export async function getSubjectByEmail(
  emailRaw: string,
): Promise<SubjectRecord | null> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  try {
    const [enquiries, valuations, mortgages, newsletter] =
      await Promise.all([
        admin
          .from("enquiries")
          .select("id, name, email, phone, brief_raw, source, status, created_at")
          .ilike("email", email),
        admin
          .from("valuation_requests")
          .select("*")
          .ilike("owner_email", email),
        admin
          .from("mortgage_inquiries")
          .select("*")
          .ilike("applicant_email", email),
        admin
          .from("newsletter_subscribers")
          .select("*")
          .ilike("email", email)
          .maybeSingle(),
      ]);

    const enquiryRows = enquiries.data ?? [];

    // Message bodies live two joins away: enquiry → conversation → messages.
    // Advisor replies are included because they are the context of the
    // subject's own conversation, matching what the old self-service export
    // did (see the notes on buildDataExport).
    let messageRows: Record<string, unknown>[] = [];
    if (enquiryRows.length > 0) {
      const { data: convs } = await admin
        .from("conversations")
        .select("id, enquiry_id")
        .in(
          "enquiry_id",
          enquiryRows.map((e) => e.id as string),
        );
      const convIds = (convs ?? []).map((c) => c.id as string);
      if (convIds.length > 0) {
        const { data: msgs } = await admin
          .from("messages")
          .select("id, conversation_id, direction, author_kind, body, channel, sent_at")
          .in("conversation_id", convIds);
        messageRows = (msgs ?? []) as Record<string, unknown>[];
      }
    }

    const tally: SubjectTally = {
      enquiries: enquiryRows.length,
      messages: messageRows.length,
      valuation_requests: (valuations.data ?? []).length,
      mortgage_inquiries: (mortgages.data ?? []).length,
      newsletter: newsletter.data ? 1 : 0,
    };

    const found = Object.values(tally).some((n) => n > 0);

    return {
      email,
      found,
      tally,
      export: buildDataExport({
        // No account row exists any more; the subject is the address itself.
        account: { email },
        enquiries: enquiryRows as Record<string, unknown>[],
        messages: messageRows,
        newsletter_subscription:
          (newsletter.data as Record<string, unknown> | null) ?? null,
      }),
    };
  } catch (error) {
    console.error("[getSubjectByEmail]", error);
    return null;
  }
}

export { EMPTY as EMPTY_TALLY };

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getSubjectByEmail } from "@/lib/queries/dsr-subject";
import { approxJsonByteSize, exportFilename, generateDsrToken } from "@/lib/dsr";
import { drainCrmErasures } from "@/lib/salesforce/erasure-queue";

/**
 * Staff fulfilment of PDPL data-subject requests.
 *
 * The self-service pages at /account/data-export and /account/data-deletion
 * went with the customer-account surface. The obligation did not: the privacy
 * notice directs subjects to info@bazarrealestate.ae, and this is where a
 * staff member fulfils what arrives there.
 *
 * Admin-only. Both actions write a `dsr_requests` row — that table is the
 * compliance evidence that a request was received and answered, and it is the
 * reason erasure never hard-deletes it.
 */
const DSR_ROLES = ["admin"] as const;

export type DsrActionResult =
  | { status: "ok"; message: string; detail?: string }
  | { status: "error"; message: string };

function normalise(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/**
 * Record an access request and return the archive for download.
 *
 * The archive is built fresh at fulfilment time rather than stored, so it can
 * never be stale; `dsr_requests.payload` keeps only its size, which is the
 * audit fact worth retaining.
 */
export async function fulfilExportRequest(
  emailRaw: unknown,
): Promise<
  | { status: "ok"; filename: string; json: string; message: string }
  | { status: "error"; message: string }
> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Backend not configured." };
  await requireRole(DSR_ROLES);

  const email = normalise(emailRaw);
  if (!email.includes("@"))
    return { status: "error", message: "Enter the subject's email address." };

  const subject = await getSubjectByEmail(email);
  if (!subject)
    return { status: "error", message: "Lookup failed — check the logs." };

  const json = JSON.stringify(subject.export, null, 2);

  const admin = createAdminClient();
  if (admin) {
    // account_id is nullable as of 0067 — nobody has an account any more.
    const { error } = await admin.from("dsr_requests").insert({
      account_id: null,
      kind: "export",
      status: "fulfilled",
      token: generateDsrToken(),
      email,
      payload: { bytes: approxJsonByteSize(subject.export), by: "staff" },
      confirmed_at: new Date().toISOString(),
      fulfilled_at: new Date().toISOString(),
    });
    if (error) return { status: "error", message: error.message };
  }

  await logAudit({
    action: "dsr.export_fulfilled",
    target_kind: "data_subject",
    target_id: email,
    before: null,
    after: { ...subject.tally, found: subject.found },
  });

  revalidatePath("/admin/dsr");
  return {
    status: "ok",
    filename: exportFilename(),
    json,
    message: subject.found
      ? `Archive built for ${email}.`
      : `No personal data held for ${email} — the archive records that.`,
  };
}

/**
 * Erase everything held about the subject.
 *
 * Calls `anonymise_by_email` (0067), which pseudonymises rather than deletes on
 * AML-relevant tables so the 7-year reconstruction duty still holds, and drops
 * the newsletter subscription outright since a consent record with no
 * identifiable subject serves no purpose.
 *
 * Since migration 0130 the subject also exists outside Postgres: every
 * enquiry is pushed to the client's Salesforce org, which the privacy notice
 * names as a processor. Erasing one copy and not the other would be worse
 * than not offering erasure at all, so the CRM records are marked for the
 * same treatment *before* the scrub runs — `anonymise_by_email` nulls
 * `enquiries.email`, and a moment later there is no way left to ask which
 * records belonged to this address.
 */
export async function fulfilErasureRequest(
  emailRaw: unknown,
): Promise<DsrActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Backend not configured." };
  await requireRole(DSR_ROLES);

  const email = normalise(emailRaw);
  if (!email.includes("@"))
    return { status: "error", message: "Enter the subject's email address." };

  const admin = createAdminClient();
  if (!admin)
    return {
      status: "error",
      message: "Service-role key is not configured — erasure can't run.",
    };

  // Snapshot what was held BEFORE scrubbing: afterwards it is unfindable by
  // email, and the audit row would be empty.
  const before = await getSubjectByEmail(email);

  // Mark the CRM work while the email still links the rows, and mark it
  // before the scrub rather than after: an interrupted request then leaves a
  // visible obligation for the cron to finish instead of an invisible one.
  //
  // Matched by id off an exact comparison rather than with `.ilike(email)`,
  // because `_` is a single-character wildcard to ilike and a perfectly legal
  // character in an address. `a_b@x.com` would also select `axb@x.com` — and
  // since `anonymise_by_email` matches exactly, that second row would keep
  // its real name in Postgres while carrying an erasure marker, and the cron
  // would go on to pseudonymise an unrelated subject's CRM record with it.
  const { data: owned, error: lookupError } = await admin
    .from("enquiries")
    .select("id, email, crm_sync_state")
    .ilike("email", email);
  if (lookupError) return { status: "error", message: lookupError.message };

  const mine = (owned ?? []).filter(
    (r) => (r.email ?? "").trim().toLowerCase() === email,
  );
  if (mine.length > 0) {
    const { error: markError } = await admin
      .from("enquiries")
      .update({ crm_erasure_due_at: new Date().toISOString() })
      .in(
        "id",
        mine.map((r) => r.id),
      );
    if (markError) return { status: "error", message: markError.message };

    // A lead still queued must never be pushed now — sending a subject to the
    // CRM after they asked to be forgotten is the worst available ordering.
    // Only the un-sent states move: overwriting 'synced' would destroy the
    // record that the push happened, which is what the erasure pass needs.
    const unsent = mine.filter(
      (r) => r.crm_sync_state === "pending" || r.crm_sync_state === "failed",
    );
    if (unsent.length > 0) {
      await admin
        .from("enquiries")
        .update({ crm_sync_state: "skipped" })
        .in(
          "id",
          unsent.map((r) => r.id),
        );
    }
  }

  const { data, error } = await admin.rpc("anonymise_by_email", {
    target_email: email,
  });
  if (error) return { status: "error", message: error.message };

  // Now that Postgres holds the pseudonym, push the same one to the CRM. Run
  // inline so the staff member sees both outcomes on one screen; whatever
  // does not complete keeps its marker and is retried by the sync cron, so
  // this never has to succeed for the request to be fulfilled.
  const crm = await drainCrmErasures(admin);

  await admin.from("dsr_requests").insert({
    account_id: null,
    kind: "delete",
    status: "fulfilled",
    token: generateDsrToken(),
    email,
    // The RPC returns the scrub tally as jsonb; store it verbatim as the
    // record of what was actually erased, plus what happened in the CRM —
    // `dsr_requests` is the compliance evidence, and "we also told
    // Salesforce" is part of what it has to evidence.
    payload: { ...((data ?? {}) as Record<string, unknown>), crm } as never,
    confirmed_at: new Date().toISOString(),
    fulfilled_at: new Date().toISOString(),
  });

  await logAudit({
    action: "dsr.erasure_fulfilled",
    target_kind: "data_subject",
    target_id: email,
    before: before ? { ...before.tally } : null,
    after: { ...((data ?? {}) as Record<string, unknown>), crm },
  });

  const tally = (data ?? {}) as Record<string, number | boolean | string>;
  const parts = Object.entries(tally)
    .filter(([k, v]) => typeof v === "number" && v > 0 && k !== "email")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);

  if (crm.scrubbed > 0) parts.push(`Salesforce leads: ${crm.scrubbed}`);

  revalidatePath("/admin/dsr");

  // An outstanding CRM record is the one outcome a staff member must not read
  // as "done" — the Postgres obligation is discharged, the Salesforce one is
  // not, and they may be the person who has to chase it.
  if (crm.remaining > 0) {
    return {
      status: "ok",
      message: `Erased everything held for ${email} in this database.`,
      detail: `${parts.join(", ") || "Nothing was held here"} — but ${crm.remaining} Salesforce ${crm.remaining === 1 ? "record is" : "records are"} still to scrub (${crm.lastError ?? "unknown error"}). The sync cron will retry; if it stays outstanding, chase it before closing the request.`,
    };
  }

  return {
    status: "ok",
    message: `Erased everything held for ${email}.`,
    detail: parts.join(", ") || "Nothing was held for that address.",
  };
}

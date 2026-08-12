"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getSubjectByEmail } from "@/lib/queries/dsr-subject";
import { approxJsonByteSize, exportFilename, generateDsrToken } from "@/lib/dsr";

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

  const { data, error } = await admin.rpc("anonymise_by_email", {
    target_email: email,
  });
  if (error) return { status: "error", message: error.message };

  await admin.from("dsr_requests").insert({
    account_id: null,
    kind: "delete",
    status: "fulfilled",
    token: generateDsrToken(),
    email,
    // The RPC returns the scrub tally as jsonb; store it verbatim as the
    // record of what was actually erased.
    payload: (data ?? {}) as never,
    confirmed_at: new Date().toISOString(),
    fulfilled_at: new Date().toISOString(),
  });

  await logAudit({
    action: "dsr.erasure_fulfilled",
    target_kind: "data_subject",
    target_id: email,
    before: before ? { ...before.tally } : null,
    after: (data ?? null) as Record<string, unknown> | null,
  });

  const tally = (data ?? {}) as Record<string, number | boolean | string>;
  const detail = Object.entries(tally)
    .filter(([k, v]) => typeof v === "number" && v > 0 && k !== "email")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(", ");

  revalidatePath("/admin/dsr");
  return {
    status: "ok",
    message: `Erased everything held for ${email}.`,
    detail: detail || "Nothing was held for that address.",
  };
}

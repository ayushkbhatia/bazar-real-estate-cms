/**
 * Submitting an application: the logic behind POST /api/mortgage/requests
 * (docs/mortgage/SPEC.md §2.4 first row, §4.2).
 *
 * The route handler has already checked the flag, the rate limit and the bot
 * check. This does the rest, in the order that makes a retry safe:
 *
 *   1. A repeated Idempotency-Key answers with the request it already made —
 *      before the draft is looked at, because a draft that was submitted is
 *      claimed and would otherwise answer 409 to the applicant's own retry.
 *   2. The draft's token, for a pre-approval.
 *   3. The promise's due time from sla.ts, and the consent's text by version.
 *   4. `mortgage_create_request()` creates the request, its documents and
 *      consent, attaches the draft's files and queues the confirmation email,
 *      all in one transaction (0141). A file still scanning refuses the whole
 *      thing, so nothing half-made is left behind.
 *   5. Objects of files the request didn't need (the applicant changed
 *      employment type after uploading) are deleted, best effort.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isIP } from "node:net";
import { z } from "zod";
import { CONSENT_WORDINGS, isConsentVersion } from "../consent";
import { detailsSchema, ENTRY_POINTS, type Service } from "../details";
import { clockDueFrom, slaPolicy } from "../sla";
import { authoriseDraft, FILE_COLUMNS, retireFiles, type DraftDeps, type FileRow } from "./drafts";
import { MortgageApiError } from "./errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A listing reference as the property page sends it; anything else is dropped. */
const PROPERTY_REF = /^[A-Za-z0-9][A-Za-z0-9-]{1,39}$/;

export function submitBodySchema(now: () => Date = () => new Date()) {
  const common = {
    details: detailsSchema(now),
    // An unknown entry point is recorded as a direct visit, not refused.
    entryPoint: z.enum(ENTRY_POINTS).catch("direct"),
    propertyRef: z
      .string()
      .optional()
      .transform((v) => (v && PROPERTY_REF.test(v) ? v : undefined)),
    turnstileToken: z.string().max(4096).optional(),
  };
  return z.discriminatedUnion("service", [
    z.object({ service: z.literal("consultancy"), ...common }),
    z.object({
      service: z.literal("pre_approval"),
      ...common,
      draftId: z.string().regex(UUID, "invalid"),
      /** The files the applicant sees as ready: only these are attached. */
      fileIds: z.array(z.string().regex(UUID, "invalid")).min(1).max(30),
      consent: z.object({ given: z.literal(true), wordingVersion: z.string().max(40) }),
    }),
  ]);
}

export type SubmitBody = z.infer<ReturnType<typeof submitBodySchema>>;

export type SubmitResult = {
  requestId: string;
  reference: string;
  service: Service;
  submittedAt: string;
  /** The promise, for a pre-approval: W7 shows it. */
  dueAt: string | null;
  /** False when this answered a repeat of a submit that had already succeeded. */
  created: boolean;
};

export type SubmitDeps = DraftDeps;

type RequestRow = {
  id: string;
  reference: string;
  service: Service;
  submitted_at: string;
  sla_due_at: string | null;
};

function resultOf(row: RequestRow, created: boolean): SubmitResult {
  return {
    requestId: row.id,
    reference: row.reference,
    service: row.service,
    submittedAt: row.submitted_at,
    dueAt: row.sla_due_at,
    created,
  };
}

async function existing(db: SupabaseClient, key: string): Promise<RequestRow | null> {
  const { data, error } = await db
    .from("mortgage_requests")
    .select("id, reference, service, submitted_at, sla_due_at")
    .eq("submission_key", key)
    .maybeSingle();
  if (error) throw new Error(`request lookup failed: ${error.message}`);
  return (data as RequestRow | null) ?? null;
}

async function policyNow(db: SupabaseClient) {
  const [settings, holidays] = await Promise.all([
    db
      .from("mortgage_settings")
      .select("sla_budget_minutes, sla_risk_minutes, working_hours")
      .eq("id", 1)
      .single(),
    db.from("mortgage_holidays").select("day"),
  ]);
  if (settings.error) throw new Error(`settings read failed: ${settings.error.message}`);
  if (holidays.error) throw new Error(`holidays read failed: ${holidays.error.message}`);
  return slaPolicy(
    settings.data as { sla_budget_minutes: number; sla_risk_minutes: number; working_hours: unknown },
    (holidays.data as { day: string }[]).map((h) => h.day),
  );
}

/** The database's refusals, as the API's errors. */
function fromDatabase(error: { code?: string; message: string }): MortgageApiError | null {
  if (error.code === "MR422") {
    if (error.message.includes("files_not_ready")) return new MortgageApiError(409, "files_not_ready");
    if (error.message.includes("documents_incomplete")) return new MortgageApiError(422, "documents_incomplete");
    if (error.message.includes("draft_expired")) return new MortgageApiError(410, "draft_expired");
    return new MortgageApiError(422, "invalid", error.message);
  }
  if (error.code === "MR409") return new MortgageApiError(409, "draft_submitted");
  if (error.code === "MR404") return new MortgageApiError(404, "not_found");
  return null;
}

export async function submitRequest(
  deps: SubmitDeps,
  input: {
    body: SubmitBody;
    idempotencyKey: string | null;
    draftToken: string | null;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<SubmitResult> {
  const { body } = input;
  const now = deps.now?.() ?? new Date();

  if (!input.idempotencyKey || !UUID.test(input.idempotencyKey)) {
    throw new MortgageApiError(422, "invalid", "Idempotency-Key must be a UUID", {}, "idempotencyKey");
  }
  const key = input.idempotencyKey.toLowerCase();

  const repeat = await existing(deps.db, key);
  if (repeat) return resultOf(repeat, false);

  let dueAt: string | null = null;
  let consentText: string | null = null;
  if (body.service === "pre_approval") {
    if (!isConsentVersion(body.consent.wordingVersion)) {
      throw new MortgageApiError(422, "invalid", "unknown consent wording", {}, "consent");
    }
    consentText = CONSENT_WORDINGS[body.consent.wordingVersion];
    await authoriseDraft(deps, body.draftId, input.draftToken);
    await retireUnlisted(deps, body.draftId, body.fileIds);
    dueAt = clockDueFrom(now, await policyNow(deps.db));
  }

  const d = body.details;
  const { data, error } = await deps.db.rpc("mortgage_create_request", {
    p_service: body.service,
    p_full_name: d.fullName,
    p_date_of_birth: d.dateOfBirth,
    p_mobile_e164: d.mobile,
    p_email: d.email,
    p_residency: d.residency,
    p_employment_type: d.employmentType,
    p_entry_point: body.entryPoint,
    p_property_ref: body.propertyRef ?? null,
    p_submission_key: key,
    p_consent_version: body.service === "pre_approval" ? body.consent.wordingVersion : null,
    p_consent_text: consentText,
    p_ip: input.ip && isIP(input.ip) ? input.ip : null,
    p_user_agent: input.userAgent ? input.userAgent.slice(0, 500) : null,
    p_sla_due_at: dueAt,
    p_draft_id: body.service === "pre_approval" ? body.draftId : null,
    p_locale: "en",
    p_at: now.toISOString(),
  });
  if (error) {
    const mapped = fromDatabase(error);
    if (mapped) throw mapped;
    throw new Error(`create request failed: ${error.code ?? ""} ${error.message}`);
  }
  const row = data as RequestRow;
  // The same key racing itself: the other call made it, at its own time.
  const created = new Date(row.submitted_at).getTime() === now.getTime();

  if (body.service === "pre_approval" && created) {
    await removeOrphans(deps, body.draftId);
  }
  return resultOf(row, created);
}

/**
 * The applicant submits what they see. A file the browser lost track of — an
 * upload abandoned mid-way by a closed tab, a delete that never arrived — is
 * retired before the attach, rather than attached unseen or left pending to
 * block the submit with files_not_ready.
 */
async function retireUnlisted(deps: SubmitDeps, draftId: string, fileIds: readonly string[]): Promise<void> {
  const { data, error } = await deps.db
    .from("mortgage_files")
    .select(FILE_COLUMNS)
    .eq("draft_id", draftId)
    .is("document_id", null)
    .neq("state", "removed");
  if (error) throw new Error(`file read failed: ${error.message}`);
  const listed = new Set(fileIds.map((id) => id.toLowerCase()));
  await retireFiles(deps, (data as FileRow[]).filter((f) => !listed.has(f.id)));
}

/**
 * Delete the objects of the draft's files the request didn't take. Their rows
 * stay, marked removed. Best effort: an object left behind is unreachable
 * (nothing references it) and costs storage, not privacy.
 */
async function removeOrphans(deps: SubmitDeps, draftId: string): Promise<void> {
  try {
    const { data } = await deps.db
      .from("mortgage_files")
      .select("storage_key")
      .eq("draft_id", draftId)
      .eq("state", "removed")
      .is("document_id", null);
    const keys = ((data as { storage_key: string }[] | null) ?? []).map((f) => f.storage_key);
    if (keys.length > 0) await deps.storage.remove(keys);
  } catch {
    // Left for a person to notice; see the note above.
  }
}

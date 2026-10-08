/**
 * @vitest-environment node
 */

/**
 * Reviewing documents and the secure links (PLAN Phase 5), against the local
 * Supabase stack (`npm run db:local:reset && npm run test:db`):
 *
 *   · review: checks, figures and statement periods change only while a
 *     document is in review, and only by its owner or the Head of mortgages;
 *     Accept needs every required check;
 *   · a re-upload request pauses the promise, and sending the re-upload
 *     resumes it with exactly the working time that was left, however long
 *     the applicant took, leaving the accepted documents as they were;
 *   · the link: a code first; five wrong codes lock it for good; a code
 *     expires, and a new one can't be sent within a minute; expired, revoked
 *     and used links open nothing; a session for one link opens no other;
 *   · the invite: the applicant's own pre-approval, linked to the
 *     consultation, owned by the adviser who sent it, made once.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendEmailInput, SendEmailResult } from "@/lib/email";
import { CURRENT_CONSENT_VERSION } from "./consent";
import type { DocKind } from "./documents";
import { clockPause, clockResume, slaStatus, type SlaPolicy } from "./sla";
import { completeFile, createDraft, presignFile, purgeExpiredDrafts, type DraftDeps } from "./server/drafts";
import { MortgageApiError } from "./server/errors";
import {
  CODE_TTL_MS,
  completeLinkFile,
  findLink,
  fulfilReupload,
  inviteReplay,
  linkState,
  MAX_CODE_ATTEMPTS,
  presignLinkFile,
  requireSession,
  sendLinkCode,
  sessionCookieName,
  submitInvite,
  verifyLinkCode,
  type LinkDeps,
  type LinkRow,
} from "./server/links";
import { loadMortgageSettings } from "./server/settings";
import { supabaseStorage } from "./server/storage";
import { submitBodySchema, submitRequest } from "./server/submit";
import { hashToken, newToken } from "./server/tokens";
import { buildPdf, jpegBytes } from "./testing/fixtures";
import { client, createTestStaff, localStack, retireTestStaff, type LocalStack, type TestStaff } from "./testing/local-stack";

const stack = localStack();
if (!stack) console.warn("mortgage review and link tests skipped: start the local stack with `npm run db:local:reset`");

type Request = {
  id: string;
  reference: string;
  status: string;
  owner_staff_id: string | null;
  updated_at: string;
  sla_due_at: string | null;
  sla_paused_at: string | null;
  sla_remaining_seconds: number | null;
  sla_paused_seconds: number;
  sla_started_at: string | null;
  sla_stopped_at: string | null;
};
type Doc = { id: string; kind: DocKind; state: string; checks: Record<string, boolean>; recorded: Record<string, unknown>; accepted_at: string | null };
type FileRow = { id: string; state: string; upload_round: number; document_id: string | null; kind: DocKind };

const HOUR = 3_600_000;

describe.skipIf(!stack)("mortgage review and secure links (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let deps: DraftDeps;
  let policy: SlaPolicy;
  let head: TestStaff;
  let adviserA: TestStaff;
  let adviserB: TestStaff;
  const sent: SendEmailInput[] = [];

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    deps = { db: service, storage: supabaseStorage(service) };
    policy = (await loadMortgageSettings(service)).policy;
    [head, adviserA, adviserB] = await Promise.all([
      createTestStaff(local, service, "support", "head"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "support", "adviser"),
    ]);
  }, 60_000);

  afterAll(async () => {
    sent.length = 0;
    await retireTestStaff(service);
  });

  // ── Helpers ─────────────────────────────────────────────────

  /** The link's emails, caught: the code is read from the last one, as the applicant would. */
  function linkDeps(now?: Date): LinkDeps {
    return {
      ...deps,
      ...(now ? { now: () => now } : {}),
      send: async (input: SendEmailInput): Promise<SendEmailResult> => {
        sent.push(input);
        return { status: "ok", id: `test-${sent.length}` };
      },
    };
  }

  async function refusal(promise: Promise<unknown>): Promise<MortgageApiError> {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(MortgageApiError);
    return error as MortgageApiError;
  }

  async function uploadInto(draft: { draftId: string; draftToken: string }, kind: DocKind, bytes: Uint8Array = buildPdf()) {
    const mime = bytes[0] === 0xff ? "image/jpeg" : "application/pdf";
    const { fileId, uploadUrl, headers } = await presignFile(deps, {
      draftId: draft.draftId,
      token: draft.draftToken,
      kind,
      name: mime === "image/jpeg" ? "photo.jpg" : "document.pdf",
      size: bytes.length,
      mime,
    });
    expect((await fetch(uploadUrl, { method: "PUT", headers, body: bytes as BodyInit })).status).toBe(200);
    expect(await completeFile(deps, { draftId: draft.draftId, token: draft.draftToken, fileId })).toMatchObject({ status: "ready" });
    return fileId;
  }

  /** A submitted salaried pre-approval, owned by `owner`. */
  async function application(owner: TestStaff): Promise<{ request: Request; docs: Record<string, Doc> }> {
    const draft = await createDraft(deps, { ip: "203.0.113.30" });
    const files = [
      await uploadInto(draft, "emirates_id", jpegBytes()),
      await uploadInto(draft, "passport"),
      await uploadInto(draft, "salary_certificate"),
      await uploadInto(draft, "bank_statements_3m"),
      await uploadInto(draft, "bank_statements_3m"),
    ];
    const body = submitBodySchema().parse({
      service: "pre_approval",
      details: {
        residency: "uae_resident_expat",
        employmentType: "salaried",
        fullName: "Link Test Applicant",
        dateOfBirth: "1990-03-14",
        mobile: "+971502184417",
        email: `applicant-${randomUUID().slice(0, 8)}@example.com`,
      },
      entryPoint: "direct",
      draftId: draft.draftId,
      fileIds: files,
      consent: { given: true, wordingVersion: CURRENT_CONSENT_VERSION },
    });
    const made = await submitRequest(deps, {
      body,
      idempotencyKey: randomUUID(),
      draftToken: draft.draftToken,
      ip: "203.0.113.30",
      userAgent: "vitest",
    });
    await service.from("mortgage_requests").update({ owner_staff_id: owner.id }).eq("id", made.requestId);
    return { request: await read(made.requestId), docs: await documents(made.requestId) };
  }

  async function read(id: string): Promise<Request> {
    const { data, error } = await service.from("mortgage_requests").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data as Request;
  }

  async function documents(requestId: string): Promise<Record<string, Doc>> {
    const { data } = await service.from("mortgage_documents").select("id, kind, state, checks, recorded, accepted_at").eq("request_id", requestId);
    return Object.fromEntries(((data ?? []) as Doc[]).map((d) => [d.kind, d]));
  }

  async function filesOf(documentId: string): Promise<FileRow[]> {
    const { data } = await service
      .from("mortgage_files")
      .select("id, state, upload_round, document_id, kind")
      .eq("document_id", documentId)
      .order("uploaded_at");
    return (data ?? []) as FileRow[];
  }

  async function eventTypes(requestId: string): Promise<string[]> {
    const { data } = await service.from("mortgage_events").select("type").eq("request_id", requestId).order("created_at");
    return ((data ?? []) as { type: string }[]).map((e) => e.type);
  }

  /** Accept a document as `staff`, ticking every check its list needs. */
  async function accept(staff: TestStaff, doc: Doc, checks: string[]) {
    for (const key of checks) {
      const { error } = await staff.client.rpc("mortgage_set_check", { p_document_id: doc.id, p_key: key, p_value: true });
      expect(error).toBeNull();
    }
    const { error } = await staff.client.rpc("mortgage_accept_document", { p_document_id: doc.id, p_required_checks: checks });
    expect(error).toBeNull();
  }

  /**
   * C4, as the action does it: the owner's first open moves New to In review,
   * the promise pauses with the working time left, and the link is made.
   */
  async function askAgain(staff: TestStaff, requestId: string, doc: Doc, reason: string, at = new Date()) {
    let request = await read(requestId);
    if (request.status === "new") {
      const { error } = await service.rpc("mortgage_transition", {
        p_request_id: requestId,
        p_event: "first_document_opened",
        p_actor_kind: "system",
      });
      expect(error).toBeNull();
      request = await read(requestId);
    }
    const token = newToken();
    const { data, error } = await staff.client.rpc("mortgage_request_reupload", {
      p_document_id: doc.id,
      p_reason: reason,
      p_message: "Please send it again.\nThank you.",
      p_channels: ["whatsapp", "email"],
      p_token_hash: hashToken(token),
      p_expires_at: new Date(at.getTime() + 7 * 24 * HOUR).toISOString(),
      p_sla: request.sla_due_at ? clockPause(request, at, policy) : {},
      p_expected_updated_at: request.updated_at,
    });
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    const made = data as { reupload_id: string; link_id: string };
    return { token, ...made };
  }

  /** Ask for a code and read it from the email, as the applicant would. */
  async function code(token: string, now?: Date): Promise<string> {
    await sendLinkCode(linkDeps(now), token);
    const text = sent.at(-1)!.text ?? "";
    const match = text.match(/\b(\d{6})\b/);
    expect(match).not.toBeNull();
    return match![1]!;
  }

  async function verified(token: string, now?: Date): Promise<{ link: LinkRow; session: string }> {
    const { session } = await verifyLinkCode(linkDeps(now), token, await code(token, now));
    const link = await requireSession(deps, token, () => session);
    return { link, session };
  }

  async function uploadThrough(token: string, session: string, kind: DocKind, bytes: Uint8Array = buildPdf()) {
    let link = await requireSession(deps, token, () => session);
    const mime = bytes[0] === 0xff ? "image/jpeg" : "application/pdf";
    const name = mime === "image/jpeg" ? "again.jpg" : "again.pdf";
    const { fileId, uploadUrl, headers } = await presignLinkFile(deps, link, { kind, name, size: bytes.length, mime });
    expect((await fetch(uploadUrl, { method: "PUT", headers, body: bytes as BodyInit })).status).toBe(200);
    link = await requireSession(deps, token, () => session);
    expect(await completeLinkFile(deps, link, fileId)).toMatchObject({ status: "ready" });
    return fileId;
  }

  // ── Review ──────────────────────────────────────────────────

  it("checks and Accept: only the owner or the Head, only while in review, every required check", async () => {
    const { request, docs } = await application(adviserA);
    const cert = docs.salary_certificate!;

    // Another adviser can't touch it.
    const other = await adviserB.client.rpc("mortgage_set_check", { p_document_id: cert.id, p_key: "name_matches", p_value: true });
    expect(other.error?.code).toBe("MR403");

    // Accept with a check missing is refused.
    await adviserA.client.rpc("mortgage_set_check", { p_document_id: cert.id, p_key: "name_matches", p_value: true });
    const early = await adviserA.client.rpc("mortgage_accept_document", {
      p_document_id: cert.id,
      p_required_checks: ["name_matches", "addressed_to_bank"],
    });
    expect(early.error?.code).toBe("MR422");

    // The figures C5 prices on, merged; only flat strings and numbers are kept (the action checks their types).
    const bad = await adviserA.client.rpc("mortgage_set_recorded", { p_document_id: cert.id, p_values: { monthly_gross_aed: { amount: 1 } } });
    expect(bad.error?.code).toBe("MR422");
    const good = await adviserA.client.rpc("mortgage_set_recorded", {
      p_document_id: cert.id,
      p_values: { monthly_gross_aed: 32500, employer: "Corniche Medical Centre L.L.C." },
    });
    expect(good.error).toBeNull();

    // The Head may act on any request.
    await accept(head, cert, ["name_matches", "addressed_to_bank"]);
    const after = (await documents(request.id)).salary_certificate!;
    expect(after).toMatchObject({ state: "accepted", checks: { name_matches: true, addressed_to_bank: true } });
    expect(after.recorded).toMatchObject({ monthly_gross_aed: 32500, employer: "Corniche Medical Centre L.L.C." });

    // An accepted document is settled.
    const late = await adviserA.client.rpc("mortgage_set_check", { p_document_id: cert.id, p_key: "name_matches", p_value: false });
    expect(late.error?.code).toBe("MR409");
    expect(await eventTypes(request.id)).toEqual(expect.arrayContaining(["document.check_set", "document.recorded", "document.accepted"]));
  }, 90_000);

  it("statement periods are whole months, at most two years", async () => {
    const { docs } = await application(adviserA);
    const [file] = await filesOf(docs.bank_statements_3m!.id);
    const set = (from: string, to: string) =>
      adviserA.client.rpc("mortgage_set_statement_period", { p_file_id: file!.id, p_from: from, p_to: to });
    expect((await set("2026-06-02", "2026-08-31")).error?.code).toBe("MR422");
    expect((await set("2026-06-01", "2026-08-30")).error?.code).toBe("MR422");
    expect((await set("2023-06-01", "2026-08-31")).error?.code).toBe("MR422");
    expect((await set("2026-06-01", "2026-08-31")).error).toBeNull();
    const { data } = await service.from("mortgage_files").select("period_from, period_to").eq("id", file!.id).single();
    expect(data).toEqual({ period_from: "2026-06-01", period_to: "2026-08-31" });
  }, 90_000);

  // ── The re-upload ───────────────────────────────────────────

  it("a re-upload pauses the promise; sending it resumes with the time that was left, accepted documents untouched", async () => {
    const { request, docs } = await application(adviserA);
    await accept(adviserA, docs.emirates_id!, ["name_matches", "not_expired", "front_and_back"]);
    const acceptedBefore = (await documents(request.id)).emirates_id!;
    const idFilesBefore = await filesOf(acceptedBefore.id);
    const statements = docs.bank_statements_3m!;
    const statementFilesBefore = await filesOf(statements.id);

    const pausedAt = new Date();
    const { token, link_id } = await askAgain(adviserA, request.id, statements, "period_incomplete", pausedAt);
    const paused = await read(request.id);
    expect(paused.status).toBe("awaiting_applicant");
    expect(paused.sla_paused_at).not.toBeNull();
    const leftAtPause = paused.sla_remaining_seconds!;
    expect(leftAtPause).toBeGreaterThan(0);
    expect((await documents(request.id)).bank_statements_3m!.state).toBe("reupload_requested");

    // One open request per document: asking again waits for this one.
    const twice = await askAgain(adviserA, request.id, (await documents(request.id)).bank_statements_3m!, "unreadable").catch(
      (e: { code?: string }) => e,
    );
    expect((twice as { code?: string }).code).toBe("MR409");

    // The applicant answers three days later.
    const answeredAt = new Date(pausedAt.getTime() + 72 * HOUR);
    const { session } = await verified(token, answeredAt);
    const fileId = await uploadThrough(token, session, "bank_statements_3m");
    const link = await requireSession({ ...deps, now: () => answeredAt }, token, () => session);
    expect(link.id).toBe(link_id);
    await fulfilReupload({ ...deps, now: () => answeredAt }, link, [fileId]);

    const resumed = await read(request.id);
    expect(resumed.status).toBe("in_review");
    expect(resumed.sla_paused_at).toBeNull();
    expect(resumed.sla_paused_seconds).toBeGreaterThan(0);
    // The paused time doesn't count: what's left now is what was left then.
    expect(slaStatus(resumed, answeredAt, policy).remainingSeconds).toBe(leftAtPause);

    // Added to (period incomplete), not replaced; back to review from a clean slate.
    const statementFiles = await filesOf(statements.id);
    expect(statementFiles.filter((f) => f.state === "active").map((f) => f.id)).toEqual([...statementFilesBefore.map((f) => f.id), fileId]);
    expect(statementFiles.find((f) => f.id === fileId)!.upload_round).toBe(1);
    expect((await documents(request.id)).bank_statements_3m).toMatchObject({ state: "to_review", checks: {} });

    // The accepted document is exactly as it was.
    const acceptedAfter = (await documents(request.id)).emirates_id!;
    expect(acceptedAfter).toEqual(acceptedBefore);
    expect(await filesOf(acceptedAfter.id)).toEqual(idFilesBefore);

    // Used: the link opens nothing now, and the team was told.
    expect(linkState(await findLink(service, token), answeredAt, session)).toBe("used");
    expect((await refusal(sendLinkCode(linkDeps(answeredAt), token))).code).toBe("link_unavailable");
    const { count } = await service
      .from("mortgage_notifications")
      .select("id", { count: "exact", head: true })
      .eq("request_id", request.id)
      .eq("kind", "team_reupload_received");
    expect(count).toBeGreaterThan(0);
    expect(await eventTypes(request.id)).toEqual(expect.arrayContaining(["reupload.requested", "link.verified", "reupload.fulfilled"]));
  }, 120_000);

  it("an unreadable document is replaced, not added to", async () => {
    const { request, docs } = await application(adviserA);
    const cert = docs.salary_certificate!;
    const [old] = await filesOf(cert.id);
    const { token } = await askAgain(adviserA, request.id, cert, "unreadable");
    const { session, link } = await verified(token);
    // The link fixes the kind: whatever the page says, the file is the certificate.
    const fileId = await uploadThrough(token, session, "passport");
    await fulfilReupload(deps, await requireSession(deps, token, () => session), [fileId]);
    expect(link.document_id).toBe(cert.id);
    const files = await filesOf(cert.id);
    expect(files.find((f) => f.id === old!.id)!.state).toBe("removed");
    expect(files.filter((f) => f.state === "active").map((f) => [f.id, f.kind])).toEqual([[fileId, "salary_certificate"]]);
  }, 120_000);

  it("cancelling revokes the link, resumes the promise and clears what was never sent", async () => {
    const { request, docs } = await application(adviserA);
    const { token, reupload_id } = await askAgain(adviserA, request.id, docs.passport!, "expired");
    const { session } = await verified(token);
    const unsent = await uploadThrough(token, session, "passport");
    const paused = await read(request.id);
    const { error } = await adviserA.client.rpc("mortgage_cancel_reupload", {
      p_reupload_id: reupload_id,
      p_sla: clockResume(paused, new Date(), policy),
      p_expected_updated_at: paused.updated_at,
    });
    expect(error).toBeNull();
    expect(await read(request.id)).toMatchObject({ status: "in_review", sla_paused_at: null });
    expect((await documents(request.id)).passport!.state).toBe("to_review");
    expect(linkState(await findLink(service, token), new Date(), null)).toBe("unavailable");
    expect((await refusal(sendLinkCode(linkDeps(), token))).code).toBe("link_unavailable");

    // The upload the applicant never sent goes at the worker's next sweep.
    await purgeExpiredDrafts(deps);
    const { data: gone } = await service.from("mortgage_files").select("id").eq("id", unsent);
    expect(gone).toEqual([]);
  }, 90_000);

  // ── The link's own rules ────────────────────────────────────

  it("five wrong codes lock the link for good; a code expires; a new one waits a minute", async () => {
    const { request, docs } = await application(adviserA);
    const { token } = await askAgain(adviserA, request.id, docs.passport!, "expired");
    const t0 = new Date();

    const right = await code(token, t0);
    // Too soon for another.
    expect((await refusal(sendLinkCode(linkDeps(new Date(t0.getTime() + 30_000)), token))).code).toBe("code_cooldown");
    // Too late for this one.
    const expired = await refusal(verifyLinkCode(linkDeps(new Date(t0.getTime() + CODE_TTL_MS + 1000)), token, right));
    expect(expired.code).toBe("code_expired");

    const fresh = await code(token, new Date(t0.getTime() + CODE_TTL_MS + 2000));
    const wrong = fresh === "000000" ? "111111" : "000000";
    const at = new Date(t0.getTime() + CODE_TTL_MS + 3000);
    const lefts: number[] = [];
    for (let i = 0; i < MAX_CODE_ATTEMPTS - 1; i++) {
      const e = await refusal(verifyLinkCode(linkDeps(at), token, wrong));
      expect(e.code).toBe("code_wrong");
      lefts.push(Number(e.details.attemptsLeft));
    }
    expect(lefts).toEqual([4, 3, 2, 1].slice(0, MAX_CODE_ATTEMPTS - 1));
    expect((await refusal(verifyLinkCode(linkDeps(at), token, wrong))).code).toBe("link_locked");
    // Even the right code, and a new one, are refused now.
    expect((await refusal(verifyLinkCode(linkDeps(at), token, fresh))).code).toBe("link_locked");
    expect((await refusal(sendLinkCode(linkDeps(new Date(at.getTime() + 5 * 60_000)), token))).code).toBe("link_locked");
    expect(await eventTypes(request.id)).toContain("link.locked");
  }, 120_000);

  it("an expired link opens nothing, and one link's session opens no other", async () => {
    const one = await application(adviserA);
    const two = await application(adviserA);
    const a = await askAgain(adviserA, one.request.id, one.docs.passport!, "expired");
    const b = await askAgain(adviserA, two.request.id, two.docs.passport!, "expired");
    const { session } = await verified(a.token);

    // A's session doesn't open B, under either cookie.
    expect((await refusal(requireSession(deps, b.token, () => session))).code).toBe("unauthorised");
    const linkB = (await findLink(service, b.token))!;
    expect((await refusal(requireSession(deps, b.token, (name) => (name === sessionCookieName(linkB.id) ? session : undefined)))).code).toBe(
      "unauthorised",
    );
    // Nor does B's token with a made-up session.
    expect((await refusal(requireSession(deps, b.token, () => newToken()))).code).toBe("unauthorised");

    // Seven days on, A is expired: no code, no uploads, no sending.
    const later = new Date(Date.now() + 8 * 24 * HOUR);
    expect(linkState(await findLink(service, a.token), later, session)).toBe("expired");
    expect((await refusal(sendLinkCode(linkDeps(later), a.token))).code).toBe("link_unavailable");
    expect((await refusal(requireSession({ ...deps, now: () => later }, a.token, () => session))).code).toBe("link_unavailable");
    const { error } = await service.rpc("mortgage_fulfil_reupload", {
      p_link_id: (await findLink(service, a.token))!.id,
      p_file_ids: [randomUUID()],
      p_replace: true,
      p_sla: {},
      p_at: later.toISOString(),
    });
    expect(error?.code).toBe("MR410");
  }, 120_000);

  it("sending only what the link's draft holds", async () => {
    const one = await application(adviserA);
    const two = await application(adviserA);
    const a = await askAgain(adviserA, one.request.id, one.docs.passport!, "expired");
    const b = await askAgain(adviserA, two.request.id, two.docs.passport!, "expired");
    const sa = await verified(a.token);
    const sb = await verified(b.token);
    const fromB = await uploadThrough(b.token, sb.session, "passport");
    // B's file can't be sent through A.
    await uploadThrough(a.token, sa.session, "passport");
    const e = await refusal(fulfilReupload(deps, await requireSession(deps, a.token, () => sa.session), [fromB]));
    expect(e.code).toBe("files_not_ready");
    expect((await read(one.request.id)).status).toBe("awaiting_applicant");
  }, 120_000);

  // ── The invite ──────────────────────────────────────────────

  it("an invite makes the applicant's own pre-approval, linked, owned by the adviser who sent it, once", async () => {
    const { data: created, error: createError } = await service.rpc("mortgage_create_request", {
      p_service: "consultancy",
      p_full_name: "Invite Test Applicant",
      p_date_of_birth: "1986-11-02",
      p_mobile_e164: "+971507741290",
      p_email: `invitee-${randomUUID().slice(0, 8)}@example.com`,
      p_residency: "uae_national",
      p_employment_type: "salaried",
      p_entry_point: "calculator_advisor",
    });
    expect(createError).toBeNull();
    const parent = created as Request;
    await service.from("mortgage_requests").update({ owner_staff_id: adviserA.id }).eq("id", parent.id);
    const token = newToken();
    const { error: inviteError } = await adviserA.client.rpc("mortgage_create_invite", {
      p_request_id: parent.id,
      p_token_hash: hashToken(token),
      p_expires_at: new Date(Date.now() + 7 * 24 * HOUR).toISOString(),
    });
    expect(inviteError).toBeNull();
    const { data: cursorBefore } = await service.from("mortgage_settings").select("round_robin_last_staff_id").eq("id", 1).single();

    const { session } = await verified(token);
    const files = [
      await uploadThrough(token, session, "emirates_id", jpegBytes()),
      await uploadThrough(token, session, "passport"),
      await uploadThrough(token, session, "salary_certificate"),
      await uploadThrough(token, session, "bank_statements_3m"),
    ];
    const submissionKey = randomUUID();
    const made = await submitInvite(deps, await requireSession(deps, token, () => session), {
      fileIds: files,
      consentVersion: CURRENT_CONSENT_VERSION,
      submissionKey,
      ip: "203.0.113.31",
      userAgent: "vitest",
    });

    const { data: child } = await service.from("mortgage_requests").select("*").eq("id", made.requestId).single();
    expect(child).toMatchObject({
      service: "pre_approval",
      status: "new",
      entry_point: "consult_invite",
      parent_request_id: parent.id,
      owner_staff_id: adviserA.id,
      full_name: "Invite Test Applicant",
    });
    expect((child as Request).sla_due_at).toBe(made.dueAt);
    const childDocs = await documents(made.requestId);
    expect(Object.keys(childDocs).sort()).toEqual(["bank_statements_3m", "emirates_id", "passport", "salary_certificate"]);

    // Assigned once, to the inviter, without moving the round robin.
    const { data: assigned } = await service
      .from("mortgage_events")
      .select("data")
      .eq("request_id", made.requestId)
      .eq("type", "owner.assigned");
    expect(assigned).toEqual([{ data: { owner_staff_id: adviserA.id, via: "invite" } }]);
    const { data: cursorAfter } = await service.from("mortgage_settings").select("round_robin_last_staff_id").eq("id", 1).single();
    expect(cursorAfter).toEqual(cursorBefore);
    const { data: alerts } = await service
      .from("mortgage_notifications")
      .select("recipient_staff_id")
      .eq("request_id", made.requestId)
      .eq("kind", "team_new_request");
    expect(new Set(((alerts ?? []) as { recipient_staff_id: string }[]).map((a) => a.recipient_staff_id))).toContain(adviserA.id);

    // The consultation records it; the link is spent.
    const { data: used } = await service
      .from("mortgage_events")
      .select("data")
      .eq("request_id", parent.id)
      .eq("type", "invite.used");
    expect(used).toEqual([{ data: { reference: made.reference } }]);
    expect(linkState(await findLink(service, token), new Date(), session)).toBe("used");

    // A retry whose first answer was lost gets the same application back; nothing new is made.
    expect(await inviteReplay(service, token, submissionKey)).toMatchObject({ requestId: made.requestId, reference: made.reference });
    expect(await inviteReplay(service, token, randomUUID())).toBeNull();
    const { count } = await service
      .from("mortgage_requests")
      .select("id", { count: "exact", head: true })
      .eq("parent_request_id", parent.id);
    expect(count).toBe(1);
  }, 150_000);
});

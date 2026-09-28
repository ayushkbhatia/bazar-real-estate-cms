/**
 * @vitest-environment node
 */

/**
 * Submitting an application (PLAN Phase 3), against the local Supabase stack
 * (`npm run db:local:reset && npm run test:db`):
 *
 *   · `mortgage_create_request()` attaches the draft's files in the same
 *     transaction, and a refused attach leaves nothing behind — no request,
 *     no reference, no consent, no email;
 *   · a repeated Idempotency-Key answers with the request it already made;
 *   · the submit keeps only the files the applicant sees, stores the consent
 *     text by version, and starts the promise from sla.ts;
 *   · Replace keeps the old file until the new one is clean;
 *   · the notification outbox sends once, retries with a backoff, and gives
 *     up after five attempts;
 *   · visitors can ask whether the flow is open, and nothing else.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONSENT_WORDINGS, CURRENT_CONSENT_VERSION } from "./consent";
import type { DocKind } from "./documents";
import { clockDueFrom, slaPolicy } from "./sla";
import { completeFile, createDraft, presignFile, type DraftDeps } from "./server/drafts";
import { deliverNotifications, MAX_ATTEMPTS } from "./server/notify";
import { devScanner } from "./server/scan";
import { supabaseStorage } from "./server/storage";
import { submitBodySchema, submitRequest, type SubmitBody } from "./server/submit";
import { buildPdf, jpegBytes } from "./testing/fixtures";
import { client, localStack, type LocalStack } from "./testing/local-stack";

const stack = localStack();
if (!stack) console.warn("mortgage submit tests skipped: start the local stack with `npm run db:local:reset`");

type Draft = Awaited<ReturnType<typeof createDraft>>;

describe.skipIf(!stack)("mortgage submit (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let deps: DraftDeps;
  let flagBefore: string;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    deps = { db: service, storage: supabaseStorage(service), scanner: devScanner };
    const { data } = await service.from("mortgage_settings").select("flag").eq("id", 1).single();
    flagBefore = (data as { flag: string }).flag;
  });

  afterAll(async () => {
    await service.from("mortgage_settings").update({ flag: flagBefore }).eq("id", 1);
  });

  const newDraft = () => createDraft(deps, { ip: "203.0.113.20" });

  async function upload(draft: Draft, kind: DocKind, bytes: Uint8Array, replaces?: string[]) {
    const mime = bytes[0] === 0xff ? "image/jpeg" : "application/pdf";
    const { fileId, uploadUrl, headers } = await presignFile(deps, {
      draftId: draft.draftId,
      token: draft.draftToken,
      kind,
      name: mime === "image/jpeg" ? "photo.jpg" : "document.pdf",
      size: bytes.length,
      mime,
      replaces,
    });
    const put = await fetch(uploadUrl, { method: "PUT", headers, body: bytes as BodyInit });
    expect(put.status).toBe(200);
    return fileId;
  }

  async function uploadReady(draft: Draft, kind: DocKind, bytes: Uint8Array = buildPdf(), replaces?: string[]) {
    const fileId = await upload(draft, kind, bytes, replaces);
    expect(await completeFile(deps, { draftId: draft.draftId, token: draft.draftToken, fileId })).toMatchObject({
      status: "ready",
    });
    return fileId;
  }

  /** A complete salaried set: two ID sides, passport, certificate, two statements. */
  async function salariedSet(draft: Draft) {
    return [
      await uploadReady(draft, "emirates_id", jpegBytes()),
      await uploadReady(draft, "emirates_id", jpegBytes()),
      await uploadReady(draft, "passport"),
      await uploadReady(draft, "salary_certificate"),
      await uploadReady(draft, "bank_statements_3m"),
      await uploadReady(draft, "bank_statements_3m"),
    ];
  }

  const details = {
    residency: "uae_resident_expat",
    employmentType: "salaried",
    fullName: "Priya Raman",
    dateOfBirth: "1990-03-14",
    mobile: "+971502184417",
    email: "priya.raman@example.com",
  } as const;

  function preApproval(draft: Draft, fileIds: string[]): SubmitBody {
    return submitBodySchema().parse({
      service: "pre_approval",
      details,
      entryPoint: "property_detail",
      propertyRef: "BAZ-TEST-1",
      draftId: draft.draftId,
      fileIds,
      consent: { given: true, wordingVersion: CURRENT_CONSENT_VERSION },
    });
  }

  const key = () => crypto.randomUUID();

  async function request(id: string) {
    const { data } = await service.from("mortgage_requests").select("*").eq("id", id).single();
    return data as Record<string, unknown>;
  }

  async function counter(): Promise<number> {
    const yy = Number(new Date().getUTCFullYear().toString().slice(2));
    const { data } = await service.from("mortgage_reference_counters").select("last_number").eq("yy", yy).maybeSingle();
    return (data as { last_number?: number } | null)?.last_number ?? 0;
  }

  // ── Submit ──────────────────────────────────────────────────

  it("creates a pre-approval with its files, consent, clock and confirmation in one go", async () => {
    const draft = await newDraft();
    const files = await salariedSet(draft);
    const now = new Date();
    const result = await submitRequest(
      { ...deps, now: () => now },
      { body: preApproval(draft, files), idempotencyKey: key(), draftToken: draft.draftToken, ip: "203.0.113.20", userAgent: "vitest" },
    );
    expect(result).toMatchObject({ service: "pre_approval", created: true });
    expect(result.reference).toMatch(/^BZM-\d{2}-\d{4,}$/);

    const r = await request(result.requestId);
    expect(r).toMatchObject({ status: "new", property_ref: "BAZ-TEST-1", entry_point: "property_detail", locale: "en" });

    // The promise, from sla.ts on the settings in force.
    const [{ data: settings }, { data: holidays }] = await Promise.all([
      service.from("mortgage_settings").select("sla_budget_minutes, sla_risk_minutes, working_hours").eq("id", 1).single(),
      service.from("mortgage_holidays").select("day"),
    ]);
    const policy = slaPolicy(settings as never, (holidays as { day: string }[]).map((h) => h.day));
    expect(new Date(r.sla_due_at as string).toISOString()).toBe(clockDueFrom(now, policy));
    expect(result.dueAt && new Date(result.dueAt).toISOString()).toBe(clockDueFrom(now, policy));

    // Every file on its document.
    const { data: docs } = await service
      .from("mortgage_documents")
      .select("kind, mortgage_files(id, state)")
      .eq("request_id", result.requestId);
    const counts = Object.fromEntries(
      (docs as { kind: string; mortgage_files: { state: string }[] }[]).map((d) => [
        d.kind,
        d.mortgage_files.filter((f) => f.state === "active").length,
      ]),
    );
    expect(counts).toEqual({ emirates_id: 2, passport: 1, salary_certificate: 1, bank_statements_3m: 2 });

    // The consent text is the version's, not anything the browser sent.
    const { data: consent } = await service.from("mortgage_consents").select("*").eq("request_id", result.requestId).single();
    expect(consent).toMatchObject({
      wording_version: CURRENT_CONSENT_VERSION,
      wording_text: CONSENT_WORDINGS[CURRENT_CONSENT_VERSION],
      ip: "203.0.113.20",
      user_agent: "vitest",
    });

    // One confirmation, queued.
    const { data: outbox } = await service.from("mortgage_notifications").select("kind, channel, status").eq("request_id", result.requestId);
    expect(outbox).toEqual([{ kind: "applicant_received", channel: "email", status: "queued" }]);
  });

  it("answers a repeated key with the request it already made, draft claimed or not", async () => {
    const draft = await newDraft();
    const files = await salariedSet(draft);
    const idempotencyKey = key();
    const input = { body: preApproval(draft, files), idempotencyKey, draftToken: draft.draftToken, ip: null, userAgent: null };
    const first = await submitRequest(deps, input);
    const again = await submitRequest(deps, input);
    expect(again).toMatchObject({ requestId: first.requestId, reference: first.reference, created: false });

    const { count } = await service
      .from("mortgage_notifications")
      .select("id", { count: "exact", head: true })
      .eq("request_id", first.requestId);
    expect(count).toBe(1);
  });

  it("leaves nothing behind when a file isn't ready: no request, no reference, no consent", async () => {
    const draft = await newDraft();
    const files = await salariedSet(draft);
    // A statement uploaded but never completed stays pending — and is listed.
    const pending = await upload(draft, "bank_statements_3m", buildPdf());
    const before = await counter();
    const idempotencyKey = key();

    await expect(
      submitRequest(deps, {
        body: preApproval(draft, [...files, pending]),
        idempotencyKey,
        draftToken: draft.draftToken,
        ip: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ status: 409, code: "files_not_ready" });

    expect(await counter()).toBe(before);
    const { data } = await service.from("mortgage_requests").select("id").eq("submission_key", idempotencyKey);
    expect(data).toEqual([]);
  });

  it("attaches only the files the applicant sees, and retires the rest", async () => {
    const draft = await newDraft();
    const files = await salariedSet(draft);
    // An extra statement the browser lost track of (a closed tab, a lost delete).
    const stray = await uploadReady(draft, "bank_statements_3m");
    const result = await submitRequest(deps, {
      body: preApproval(draft, files),
      idempotencyKey: key(),
      draftToken: draft.draftToken,
      ip: null,
      userAgent: null,
    });
    const { data: strayRow } = await service.from("mortgage_files").select("state, document_id").eq("id", stray).single();
    expect(strayRow).toEqual({ state: "removed", document_id: null });
    const { data: attached } = await service
      .from("mortgage_files")
      .select("id, mortgage_documents!inner(request_id)")
      .eq("mortgage_documents.request_id", result.requestId);
    expect((attached as { id: string }[]).map((f) => f.id).sort()).toEqual([...files].sort());
  });

  it("refuses a document with no file, and a wrong or expired draft", async () => {
    const draft = await newDraft();
    const partial = [
      await uploadReady(draft, "emirates_id", jpegBytes()),
      await uploadReady(draft, "passport"),
      await uploadReady(draft, "salary_certificate"),
    ];
    const base = { idempotencyKey: key(), ip: null, userAgent: null };
    await expect(
      submitRequest(deps, { ...base, body: preApproval(draft, partial), draftToken: draft.draftToken }),
    ).rejects.toMatchObject({ status: 422, code: "documents_incomplete" });

    await expect(
      submitRequest(deps, { ...base, idempotencyKey: key(), body: preApproval(draft, partial), draftToken: "x".repeat(43) }),
    ).rejects.toMatchObject({ status: 404 });

    await service.from("mortgage_upload_drafts").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", draft.draftId);
    await expect(
      submitRequest(deps, { ...base, idempotencyKey: key(), body: preApproval(draft, partial), draftToken: draft.draftToken }),
    ).rejects.toMatchObject({ status: 410, code: "draft_expired" });
  });

  it("creates a consultancy without a draft, and refuses one with a draft", async () => {
    const body = submitBodySchema().parse({ service: "consultancy", details, entryPoint: "newsletter" });
    expect(body.entryPoint).toBe("direct");
    const result = await submitRequest(deps, { body, idempotencyKey: key(), draftToken: null, ip: null, userAgent: null });
    expect(result).toMatchObject({ service: "consultancy", dueAt: null, created: true });

    const draft = await newDraft();
    const { error } = await service.rpc("mortgage_create_request", {
      p_service: "consultancy",
      p_full_name: "Ahmed Al Suwaidi",
      p_date_of_birth: "1986-11-02",
      p_mobile_e164: "+971507741290",
      p_email: "ahmed@example.com",
      p_residency: "uae_national",
      p_employment_type: "salaried",
      p_draft_id: draft.draftId,
    });
    expect(error?.code).toBe("MR422");
  });

  it("validates details with W2's rules, naming the field", () => {
    const parsed = submitBodySchema().safeParse({
      service: "consultancy",
      details: { ...details, dateOfBirth: "2099-01-01" },
      entryPoint: "home",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path.join(".")).toBe("details.dateOfBirth");
    expect(parsed.error?.issues[0]?.message).toBe("not_in_past");
  });

  // ── Replace ─────────────────────────────────────────────────

  it("keeps the old file until its replacement is clean, then retires it", async () => {
    const draft = await newDraft();
    const old = await uploadReady(draft, "passport");
    // Without `replaces`, a second passport breaks the one-file rule.
    await expect(
      presignFile(deps, { draftId: draft.draftId, token: draft.draftToken, kind: "passport", name: "p.pdf", size: 100, mime: "application/pdf" }),
    ).rejects.toMatchObject({ code: "too_many_files" });

    const replacement = await upload(draft, "passport", buildPdf(), [old]);
    expect((await service.from("mortgage_files").select("state").eq("id", old).single()).data).toEqual({ state: "active" });

    await completeFile(deps, { draftId: draft.draftId, token: draft.draftToken, fileId: replacement });
    expect((await service.from("mortgage_files").select("state").eq("id", old).single()).data).toEqual({ state: "removed" });
    const { data: oldRow } = await service.from("mortgage_files").select("storage_key").eq("id", old).single();
    expect(await deps.storage.read((oldRow as { storage_key: string }).storage_key)).toBeNull();
  });

  it("keeps the old file when the replacement is refused", async () => {
    const draft = await newDraft();
    const old = await uploadReady(draft, "passport");
    const locked = await upload(draft, "passport", buildPdf({ userPassword: "secret" }), [old]);
    await expect(completeFile(deps, { draftId: draft.draftId, token: draft.draftToken, fileId: locked })).rejects.toMatchObject({
      code: "encrypted_pdf",
    });
    expect((await service.from("mortgage_files").select("state").eq("id", old).single()).data).toEqual({ state: "active" });
  });

  it("only replaces ready files of the same document", async () => {
    const draft = await newDraft();
    const id = await uploadReady(draft, "emirates_id", jpegBytes());
    await expect(
      presignFile(deps, {
        draftId: draft.draftId,
        token: draft.draftToken,
        kind: "passport",
        name: "p.pdf",
        size: 100,
        mime: "application/pdf",
        replaces: [id],
      }),
    ).rejects.toMatchObject({ status: 422, field: "replaces" });
  });

  // ── The outbox ──────────────────────────────────────────────

  async function consultancy(): Promise<string> {
    const body = submitBodySchema().parse({ service: "consultancy", details, entryPoint: "home" });
    return (await submitRequest(deps, { body, idempotencyKey: key(), draftToken: null, ip: null, userAgent: null })).requestId;
  }

  async function outboxRow(requestId: string) {
    const { data } = await service.from("mortgage_notifications").select("*").eq("request_id", requestId).single();
    return data as { status: string; attempts: number; next_attempt_at: string; last_error: string | null; provider_id: string | null };
  }

  it("sends the confirmation once, and logs it", async () => {
    const requestId = await consultancy();
    const sent: { to: string; subject: string }[] = [];
    const send = async (input: { to: string; subject: string }) => {
      sent.push({ to: input.to, subject: input.subject });
      return { status: "ok" as const, id: "re_123" };
    };
    await deliverNotifications({ db: service, send }, { requestId });
    await deliverNotifications({ db: service, send }, { requestId });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(details.email);
    expect(sent[0]!.subject).toContain("BZM-");
    expect(await outboxRow(requestId)).toMatchObject({ status: "sent", attempts: 1, provider_id: "re_123" });
    const { data: events } = await service.from("mortgage_events").select("type").eq("request_id", requestId);
    expect((events as { type: string }[]).map((e) => e.type)).toContain("notification.sent");
  });

  it("retries a failed send after a backoff, keeping addresses out of the row", async () => {
    const requestId = await consultancy();
    const fail = async () => ({ status: "error" as const, message: `Invalid to: ${details.email}` });
    await deliverNotifications({ db: service, send: fail }, { requestId });
    const failed = await outboxRow(requestId);
    expect(failed).toMatchObject({ status: "failed", attempts: 1 });
    expect(failed.last_error).not.toContain(details.email);
    expect(new Date(failed.next_attempt_at).getTime()).toBeGreaterThan(Date.now());

    // Not due yet: nothing is claimed.
    let calls = 0;
    const ok = async () => {
      calls++;
      return { status: "ok" as const, id: "re_2" };
    };
    await deliverNotifications({ db: service, send: ok }, { requestId });
    expect(calls).toBe(0);

    // Due: sent.
    await service.from("mortgage_notifications").update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).eq("request_id", requestId);
    await deliverNotifications({ db: service, send: ok }, { requestId });
    expect(calls).toBe(1);
    expect(await outboxRow(requestId)).toMatchObject({ status: "sent", attempts: 2 });
  });

  it(`gives up after ${MAX_ATTEMPTS} attempts and leaves the row for a person`, async () => {
    const requestId = await consultancy();
    const fail = async () => ({ status: "error" as const, message: "provider down" });
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) {
      await service.from("mortgage_notifications").update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).eq("request_id", requestId);
      await deliverNotifications({ db: service, send: fail }, { requestId });
    }
    expect(await outboxRow(requestId)).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    const { data: events } = await service.from("mortgage_events").select("type").eq("request_id", requestId);
    expect((events as { type: string }[]).filter((e) => e.type === "notification.failed")).toHaveLength(1);
  });

  // The sender passes its own clock, as deliverNotifications does: the
  // outbox row was written with the app's time, and the database container's
  // clock can differ from it by a few milliseconds.
  const at = (offsetMs = 1000) => new Date(Date.now() + offsetMs).toISOString();

  it("never lets two senders claim one message", async () => {
    const requestId = await consultancy();
    const p_at = at();
    const claims = await Promise.all(
      Array.from({ length: 6 }, () => service.rpc("mortgage_claim_notifications", { p_request_id: requestId, p_at })),
    );
    const claimed = claims.flatMap((c) => (c.data as unknown[] | null) ?? []);
    expect(claimed).toHaveLength(1);
  });

  it("takes back a claim abandoned for ten minutes", async () => {
    const requestId = await consultancy();
    const first = await service.rpc("mortgage_claim_notifications", { p_request_id: requestId, p_at: at() });
    expect(first.data).toHaveLength(1);
    const soon = await service.rpc("mortgage_claim_notifications", { p_request_id: requestId, p_at: at(2000) });
    expect(soon.data).toEqual([]);
    const later = await service.rpc("mortgage_claim_notifications", {
      p_request_id: requestId,
      p_at: at(11 * 60_000),
    });
    expect(later.data).toHaveLength(1);
  });

  // ── What visitors can see ───────────────────────────────────

  it("tells visitors whether the flow is open, and nothing else", async () => {
    const anon = client(local, local.anonKey);
    await service.from("mortgage_settings").update({ flag: "off" }).eq("id", 1);
    expect((await anon.rpc("mortgage_flow_public")).data).toBe(false);
    await service.from("mortgage_settings").update({ flag: "staff" }).eq("id", 1);
    expect((await anon.rpc("mortgage_flow_public")).data).toBe(false);
    await service.from("mortgage_settings").update({ flag: "public" }).eq("id", 1);
    expect((await anon.rpc("mortgage_flow_public")).data).toBe(true);

    expect((await anon.from("mortgage_settings").select("flag")).data ?? []).toEqual([]);
    expect((await anon.from("mortgage_notifications").select("id")).error).not.toBeNull();
    expect((await anon.rpc("mortgage_claim_notifications", {})).error).not.toBeNull();
    expect((await anon.rpc("mortgage_create_request", { p_service: "consultancy" })).error).not.toBeNull();
  });
});

/**
 * @vitest-environment node
 */

/**
 * Uploads and document access (PLAN Phase 2), against the local Supabase
 * stack's real storage (`npm run db:local:reset && npm run test:db`):
 *
 *   · files go straight from the browser to the private bucket through a
 *     signed URL and are re-checked on completion (no malware scan, D6);
 *   · oversize, wrong-type and password-protected files are refused and their
 *     objects deleted;
 *   · expired drafts are purged with their objects; a draft's clean files
 *     attach to a request;
 *   · only the mortgage team gets a document — an admin without a mortgage
 *     role gets 403 — and every open is logged before a byte is read.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MB, type DocKind } from "./documents";
import { clockDueFrom, slaPolicy } from "./sla";
import {
  completeFile,
  createDraft,
  deleteFile,
  fileStatus,
  presignFile,
  purgeExpiredDrafts,
  type DraftDeps,
} from "./server/drafts";
import { MortgageApiError } from "./server/errors";
import { openStaffFile, staffFileResponse, type FileAccessDeps, type StaffCaller } from "./server/files";
import { MORTGAGE_BUCKET, supabaseStorage, type MortgageStorage } from "./server/storage";
import { sha256Hex } from "./server/verify";
import { buildPdf, jpegBytes, pngBytes } from "./testing/fixtures";
import { client, createTestStaff, localStack, retireTestStaff, type LocalStack, type TestStaff } from "./testing/local-stack";

const stack = localStack();
if (!stack) console.warn("mortgage storage tests skipped: start the local stack with `npm run db:local:reset`");

type Draft = Awaited<ReturnType<typeof createDraft>>;
type Uploaded = { fileId: string; putStatus: number; bytes: Uint8Array };

describe.skipIf(!stack)("mortgage uploads and document access (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let storage: MortgageStorage;
  let deps: DraftDeps;

  beforeAll(() => {
    service = client(local, local.serviceRoleKey);
    storage = supabaseStorage(service);
    deps = { db: service, storage };
  });

  afterAll(() => retireTestStaff(service));

  const newDraft = (d: DraftDeps = deps) => createDraft(d, { ip: "203.0.113.9" });

  async function presign(draft: Draft, kind: DocKind, name: string, size: number, mime: string, d = deps) {
    return presignFile(d, { draftId: draft.draftId, token: draft.draftToken, kind, name, size, mime });
  }

  /** Presign, then PUT the bytes straight to storage, as the browser does. */
  async function upload(
    draft: Draft,
    kind: DocKind,
    bytes: Uint8Array,
    opts: { name?: string; mime?: string; declaredSize?: number; d?: DraftDeps } = {},
  ): Promise<Uploaded> {
    const mime = opts.mime ?? (bytes[0] === 0xff ? "image/jpeg" : bytes[0] === 0x89 ? "image/png" : "application/pdf");
    const name = opts.name ?? (mime === "application/pdf" ? "document.pdf" : "photo.jpg");
    const { fileId, uploadUrl, headers } = await presign(draft, kind, name, opts.declaredSize ?? bytes.length, mime, opts.d);
    const res = await fetch(uploadUrl, { method: "PUT", headers, body: bytes as BodyInit });
    return { fileId, putStatus: res.status, bytes };
  }

  const complete = (draft: Draft, fileId: string, d = deps) =>
    completeFile(d, { draftId: draft.draftId, token: draft.draftToken, fileId });

  async function row(fileId: string) {
    const { data } = await service.from("mortgage_files").select("*").eq("id", fileId).single();
    return data as { state: string; scan_status: string; storage_key: string; size_bytes: number; page_count: number | null; sha256: string | null; document_id: string | null; mime: string };
  }

  const rejects = (promise: Promise<unknown>, status: number, code: string) =>
    expect(promise).rejects.toMatchObject({ status, code });

  // ── Uploading ───────────────────────────────────────────────

  it("takes a file straight to private storage, checks it and marks it ready, unscanned (D6)", async () => {
    const draft = await newDraft();
    const photo = jpegBytes(Math.round(1.2 * MB));
    const { fileId, putStatus } = await upload(draft, "emirates_id", photo);
    expect(putStatus).toBe(200);
    expect(await complete(draft, fileId)).toEqual({ status: "ready", sizeBytes: photo.length, pageCount: null });

    const stored = await row(fileId);
    expect(stored).toMatchObject({ state: "active", scan_status: "clean", mime: "image/jpeg", sha256: sha256Hex(photo) });
    expect(stored.storage_key).toBe(`f/${fileId}`);
    expect(sha256Hex((await storage.read(stored.storage_key))!)).toBe(sha256Hex(photo));
  });

  it("counts a PDF's pages", async () => {
    const draft = await newDraft();
    const { fileId } = await upload(draft, "passport", buildPdf({ pages: 3 }));
    expect(await complete(draft, fileId)).toMatchObject({ status: "ready", pageCount: 3 });
  });

  it("answers a repeated complete with where the file stands", async () => {
    const draft = await newDraft();
    const { fileId } = await upload(draft, "passport", buildPdf());
    await complete(draft, fileId);
    expect(await complete(draft, fileId)).toMatchObject({ status: "ready" });
  });

  // ── Refusing ────────────────────────────────────────────────

  it("refuses at presign what the rules forbid", async () => {
    const draft = await newDraft();
    await rejects(presign(draft, "passport", "passport.jpg", 11 * MB, "image/jpeg"), 422, "too_large");
    await rejects(presign(draft, "salary_certificate", "salary.png", MB, "image/png"), 422, "bad_type");
    await rejects(presign(draft, "passport", "passport.heic", MB, "image/heic"), 422, "bad_type");

    await presign(draft, "emirates_id", "front.jpg", MB, "image/jpeg");
    await presign(draft, "emirates_id", "back.jpg", MB, "image/jpeg");
    await rejects(presign(draft, "emirates_id", "third.jpg", MB, "image/jpeg"), 422, "too_many_files");

    // Files still uploading count toward the 25 MB statements total.
    await presign(draft, "bank_statements_3m", "jun.pdf", 12 * MB, "application/pdf");
    await presign(draft, "bank_statements_3m", "jul.pdf", 12 * MB, "application/pdf");
    const over = presign(draft, "bank_statements_3m", "aug.pdf", 2 * MB, "application/pdf");
    await expect(over).rejects.toMatchObject({ code: "total_exceeded", details: { limitBytes: 25 * MB } });
  });

  it("gives the numbers the oversize message needs", async () => {
    const draft = await newDraft();
    const error = await presign(draft, "trade_license", "licence.pdf", Math.round(14.8 * MB), "application/pdf").catch((e) => e);
    expect(error).toBeInstanceOf(MortgageApiError);
    expect(error.toJSON()).toEqual({ code: "too_large", sizeBytes: Math.round(14.8 * MB), limitBytes: 10 * MB });
  });

  it("re-checks the stored bytes: bigger than declared, or not what it claimed, is deleted", async () => {
    const draft = await newDraft();
    const big = await upload(draft, "passport", jpegBytes(11 * MB), { declaredSize: MB });
    expect(big.putStatus).toBe(200);
    await rejects(complete(draft, big.fileId), 422, "too_large");
    expect((await row(big.fileId)).state).toBe("removed");
    expect(await storage.read(`f/${big.fileId}`)).toBeNull();

    const disguised = await upload(draft, "salary_certificate", pngBytes(), { name: "salary.pdf", mime: "application/pdf" });
    await rejects(complete(draft, disguised.fileId), 422, "bad_type");
    expect(await storage.read(`f/${disguised.fileId}`)).toBeNull();
  });

  it("refuses password-protected PDFs and takes owner-restricted ones", async () => {
    const draft = await newDraft();
    const locked = await upload(draft, "bank_statements_3m", buildPdf({ pages: 2, userPassword: "14031990" }));
    await rejects(complete(draft, locked.fileId), 422, "encrypted_pdf");
    expect(await storage.read(`f/${locked.fileId}`)).toBeNull();

    const restricted = await upload(draft, "bank_statements_3m", buildPdf({ pages: 2, ownerPassword: "hr" }));
    expect(await complete(draft, restricted.fileId)).toMatchObject({ status: "ready", pageCount: 2 });
  });

  it("can't be tricked past the bucket's 40 MB cap by a small declared size", async () => {
    const draft = await newDraft();
    const huge = await upload(draft, "passport", jpegBytes(41 * MB), { declaredSize: MB });
    expect(huge.putStatus).not.toBe(200);
    await rejects(complete(draft, huge.fileId), 409, "upload_missing");
  });

  it("frees the running total when an upload is cancelled", async () => {
    const draft = await newDraft();
    const { fileId } = await presign(draft, "bank_statements_3m", "all.pdf", 25 * MB, "application/pdf");
    await rejects(presign(draft, "bank_statements_3m", "more.pdf", MB, "application/pdf"), 422, "total_exceeded");
    await deleteFile(deps, { draftId: draft.draftId, token: draft.draftToken, fileId });
    await expect(presign(draft, "bank_statements_3m", "more.pdf", MB, "application/pdf")).resolves.toHaveProperty("fileId");
  });

  // ── Drafts ──────────────────────────────────────────────────

  it("answers only the draft's own token, and only for its own files", async () => {
    const draft = await newDraft();
    const other = await newDraft();
    const { fileId } = await presign(draft, "passport", "p.pdf", MB, "application/pdf");
    await rejects(presignFile(deps, { draftId: draft.draftId, token: other.draftToken, kind: "passport", name: "p.pdf", size: MB, mime: "application/pdf" }), 404, "not_found");
    await rejects(fileStatus(deps, { draftId: other.draftId, token: other.draftToken, fileId }), 404, "not_found");
    await rejects(fileStatus(deps, { draftId: "not-a-uuid", token: draft.draftToken, fileId }), 404, "not_found");
    await rejects(fileStatus(deps, { draftId: draft.draftId, token: null, fileId }), 404, "not_found");
  });

  it("expires a draft after 24 hours, and the worker purges it with its objects", async () => {
    const draft = await newDraft();
    const { fileId } = await upload(draft, "passport", buildPdf());
    await complete(draft, fileId);
    expect(await storage.read(`f/${fileId}`)).not.toBeNull();

    const later: DraftDeps = { ...deps, now: () => new Date(Date.now() + 25 * 60 * 60 * 1000) };
    await rejects(presign(draft, "passport", "late.pdf", MB, "application/pdf", later), 410, "draft_expired");

    await purgeExpiredDrafts(later, { limit: 500 });
    expect((await service.from("mortgage_upload_drafts").select("id").eq("id", draft.draftId)).data).toEqual([]);
    expect((await service.from("mortgage_files").select("id").eq("id", fileId)).data).toEqual([]);
    expect(await storage.read(`f/${fileId}`)).toBeNull();
  });

  // ── Attaching to a request ──────────────────────────────────

  let policy: ReturnType<typeof slaPolicy>;
  async function preApproval(owner?: string): Promise<{ id: string; reference: string }> {
    policy ??= slaPolicy((await service.from("mortgage_settings").select("*").single()).data);
    const at = new Date();
    const { data, error } = await service.rpc("mortgage_create_request", {
      p_service: "pre_approval",
      p_full_name: "Upload Applicant",
      p_date_of_birth: "1990-03-14",
      p_mobile_e164: `+97150${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
      p_email: `upload-${crypto.randomUUID().slice(0, 8)}@example.com`,
      p_residency: "uae_resident_expat",
      p_employment_type: "salaried",
      p_consent_version: "v0.1",
      p_consent_text: "I authorise Bazar Real Estate to share these documents with its partner banks.",
      p_sla_due_at: clockDueFrom(at, policy),
      p_at: at.toISOString(),
    });
    if (error) throw new Error(error.message);
    if (owner) await service.from("mortgage_requests").update({ owner_staff_id: owner }).eq("id", data.id);
    return data;
  }

  /** A salaried applicant's four documents, uploaded and clean. */
  async function fullDraft(): Promise<{ draft: Draft; files: Record<string, Uploaded> }> {
    const draft = await newDraft();
    const files = {
      emirates_id: await upload(draft, "emirates_id", jpegBytes(300_000)),
      passport: await upload(draft, "passport", buildPdf({ pages: 1 })),
      salary_certificate: await upload(draft, "salary_certificate", buildPdf({ pages: 1 })),
      bank_statements_3m: await upload(draft, "bank_statements_3m", buildPdf({ pages: 3 })),
    };
    for (const f of Object.values(files)) await complete(draft, f.fileId);
    return { draft, files };
  }

  it("attaches a draft's clean files to the request's documents, dropping kinds it doesn't need", async () => {
    const request = await preApproval();
    const { draft, files } = await fullDraft();
    const stray = await upload(draft, "trade_license", buildPdf()); // from before switching to Salaried
    await complete(draft, stray.fileId);

    const { data: orphans, error } = await service.rpc("mortgage_attach_draft", {
      p_request_id: request.id,
      p_draft_id: draft.draftId,
    });
    expect(error).toBeNull();
    expect(orphans).toEqual([stray.fileId]);
    expect((await row(stray.fileId)).state).toBe("removed");

    const { data: docs } = await service.from("mortgage_documents").select("id, kind").eq("request_id", request.id);
    for (const doc of docs as { id: string; kind: string }[]) {
      expect((await row(files[doc.kind].fileId)).document_id, doc.kind).toBe(doc.id);
    }
    const again = await service.rpc("mortgage_attach_draft", { p_request_id: request.id, p_draft_id: draft.draftId });
    expect(again.error?.code).toBe("MR409");
  });

  it("won't attach a draft with a file still uploading, or one missing a document", async () => {
    const request = await preApproval();
    const draft = await newDraft();
    await upload(draft, "passport", buildPdf());
    const unready = await service.rpc("mortgage_attach_draft", { p_request_id: request.id, p_draft_id: draft.draftId });
    expect(unready.error).toMatchObject({ code: "MR422", message: "files_not_ready" });

    const partial = await newDraft();
    const one = await upload(partial, "passport", buildPdf());
    await complete(partial, one.fileId);
    const incomplete = await service.rpc("mortgage_attach_draft", { p_request_id: request.id, p_draft_id: partial.draftId });
    expect(incomplete.error).toMatchObject({ code: "MR422", message: "documents_incomplete" });
  });

  // ── Staff access (SPEC §7–8, D10) ───────────────────────────

  describe("opening documents", () => {
    let owner: TestStaff;
    let otherAdviser: TestStaff;
    let admin: TestStaff;
    let agent: TestStaff;

    beforeAll(async () => {
      owner = await createTestStaff(local, service, "support", "adviser");
      otherAdviser = await createTestStaff(local, service, "support", "adviser");
      admin = await createTestStaff(local, service, "admin", null);
      agent = await createTestStaff(local, service, "agent", null);
    }, 60_000);

    const callerOf = (who: TestStaff, mortgageRole: "head" | "adviser" | null): StaffCaller => ({
      userId: who.id,
      status: "active",
      mortgageRole,
    });

    /** The route's dependencies, with the access log written through the caller's own session. */
    function accessDeps(who: TestStaff, overrides: Partial<FileAccessDeps> = {}): FileAccessDeps {
      return {
        db: service,
        storage,
        logAccess: async ({ requestId, type, data }) => {
          const { error } = await who.client.rpc("mortgage_log_event", {
            p_request_id: requestId,
            p_type: type,
            p_data: data,
            p_actor_kind: "staff",
          });
          if (error) throw new Error(`access log failed: ${error.code}`);
        },
        ...overrides,
      };
    }

    async function attachedRequest(ownerId: string) {
      const request = await preApproval(ownerId);
      const { draft, files } = await fullDraft();
      const { error } = await service.rpc("mortgage_attach_draft", { p_request_id: request.id, p_draft_id: draft.draftId });
      if (error) throw new Error(error.message);
      return { request, files };
    }

    async function events(requestId: string, fileId: string) {
      const { data } = await service
        .from("mortgage_events")
        .select("type, actor_id, data")
        .eq("request_id", requestId)
        .contains("data", { file_id: fileId });
      return data as { type: string; actor_id: string; data: Record<string, unknown> }[];
    }

    it("gives the mortgage team the document, logging the open before the first byte", async () => {
      const { request, files } = await attachedRequest(owner.id);
      const passport = files.passport;

      // A storage that checks, at every read, that the open is already logged.
      const loggedAtEachRead: boolean[] = [];
      const watching: MortgageStorage = {
        ...storage,
        read: async (key) => {
          loggedAtEachRead.push((await events(request.id, passport.fileId)).some((e) => e.type === "document.viewed"));
          return storage.read(key);
        },
      };
      const opened = await openStaffFile(accessDeps(owner, { storage: watching }), {
        caller: callerOf(owner, "adviser"),
        fileId: passport.fileId,
        download: false,
      });
      expect(loggedAtEachRead.length).toBeGreaterThan(0);
      expect(loggedAtEachRead.every(Boolean)).toBe(true);
      expect(sha256Hex(opened.bytes)).toBe(sha256Hex(passport.bytes));
      expect(opened.mime).toBe("application/pdf");
      expect(await events(request.id, passport.fileId)).toEqual([
        { type: "document.viewed", actor_id: owner.id, data: { file_id: passport.fileId, kind: "passport" } },
      ]);
    });

    it("moves a new request into review on its owner's first open, and not on anyone else's", async () => {
      const { request, files } = await attachedRequest(owner.id);
      await openStaffFile(accessDeps(otherAdviser), { caller: callerOf(otherAdviser, "adviser"), fileId: files.passport.fileId, download: false });
      const afterOther = await service.from("mortgage_requests").select("status").eq("id", request.id).single();
      expect(afterOther.data!.status).toBe("new");

      await openStaffFile(accessDeps(owner), { caller: callerOf(owner, "adviser"), fileId: files.passport.fileId, download: false });
      const afterOwner = await service.from("mortgage_requests").select("status").eq("id", request.id).single();
      expect(afterOwner.data!.status).toBe("in_review");
    });

    it("refuses admins and other staff without a mortgage role (403), and signed-out callers (401)", async () => {
      const { request, files } = await attachedRequest(owner.id);
      const fileId = files.salary_certificate.fileId;
      for (const [who, caller] of [
        [admin, callerOf(admin, null)],
        [agent, callerOf(agent, null)],
      ] as const) {
        const response = await staffFileResponse(accessDeps(who), { caller, fileId, download: false });
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ code: "forbidden" });
      }
      expect((await staffFileResponse(accessDeps(owner), { caller: null, fileId, download: false })).status).toBe(401);
      // Even if the route's own check were wrong, the database refuses to log an outsider's open.
      const forged = await accessDeps(admin).logAccess({ requestId: request.id, type: "document.viewed", data: {} }).catch((e) => e);
      expect(String(forged)).toContain("MR403");
    });

    it("returns no bytes when the open can't be logged", async () => {
      const { files } = await attachedRequest(owner.id);
      const read = vi.fn(storage.read);
      const failing = accessDeps(owner, {
        storage: { ...storage, read },
        logAccess: async () => {
          throw new Error("log down");
        },
      });
      await expect(
        openStaffFile(failing, { caller: callerOf(owner, "adviser"), fileId: files.passport.fileId, download: false }),
      ).rejects.toThrow("log down");
      expect(read).not.toHaveBeenCalled();
    });

    it("serves only files on a request, finished and present", async () => {
      const { files } = await attachedRequest(owner.id);
      const caller = callerOf(owner, "adviser");
      const draft = await newDraft();
      const loose = await upload(draft, "passport", buildPdf());
      await complete(draft, loose.fileId);
      await expect(openStaffFile(accessDeps(owner), { caller, fileId: loose.fileId, download: false })).rejects.toMatchObject({ status: 404 });

      await service.from("mortgage_files").update({ state: "pending" }).eq("id", files.passport.fileId);
      await expect(openStaffFile(accessDeps(owner), { caller, fileId: files.passport.fileId, download: false })).rejects.toMatchObject({ status: 404 });

      await expect(openStaffFile(accessDeps(owner), { caller, fileId: crypto.randomUUID(), download: false })).rejects.toMatchObject({ status: 404 });
      await expect(openStaffFile(accessDeps(owner), { caller, fileId: "../../etc/passwd", download: false })).rejects.toMatchObject({ status: 404 });
    });

    it("logs a download as a download, with headers that keep it out of every cache", async () => {
      const { request, files } = await attachedRequest(owner.id);
      const response = await staffFileResponse(accessDeps(owner), {
        caller: callerOf(owner, "adviser"),
        fileId: files.bank_statements_3m.fileId,
        download: true,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="document\.pdf"/);
      expect(response.headers.get("cache-control")).toBe("no-store, private");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-security-policy")).toContain("sandbox");
      expect(new Uint8Array(await response.arrayBuffer())).toHaveLength(files.bank_statements_3m.bytes.length);
      expect((await events(request.id, files.bank_statements_3m.fileId)).map((e) => e.type)).toEqual(["document.downloaded"]);
    });

    it("keeps the bucket closed to signed-in staff and anonymous visitors alike", async () => {
      const { files } = await attachedRequest(owner.id);
      const key = `f/${files.passport.fileId}`;
      for (const who of [owner.client, admin.client, client(local, local.anonKey)]) {
        const download = await who.storage.from(MORTGAGE_BUCKET).download(key);
        expect(download.error).not.toBeNull();
        const put = await who.storage.from(MORTGAGE_BUCKET).upload(`f/${crypto.randomUUID()}`, buildPdf(), { contentType: "application/pdf" });
        expect(put.error).not.toBeNull();
        const signed = await who.storage.from(MORTGAGE_BUCKET).createSignedUrl(key, 60);
        expect(signed.error).not.toBeNull();
      }
    });
  });
});

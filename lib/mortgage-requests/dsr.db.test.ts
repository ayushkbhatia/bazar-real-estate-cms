/**
 * @vitest-environment node
 */

/**
 * Retention and erasure (Phase 7, migration 0151), against the local Supabase
 * stack (`npm run db:local:reset && npm run test:db`):
 *
 *   · retention deletes a closed request's files once `retention_months` have
 *     passed — objects first, rows kept as removed and nameless, one line on
 *     the activity — and nothing else: not a recent or open request, not while
 *     the months are unset, not twice;
 *   · erasure finds a subject by email and by mobile, exports what's held,
 *     then deletes the requests with everything hanging off them (the
 *     activity log and a secure link's unsent uploads included), objects
 *     first, and names the banks that already hold a package;
 *   · only the service role may do either, and the activity log stays
 *     append-only everywhere else.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clockDueFrom, type SlaPolicy } from "./sla";
import { eraseMortgageRequests, findMortgageRequests, mortgageExport } from "./server/dsr";
import { purgeRetainedFiles } from "./server/retention";
import { loadMortgageSettings } from "./server/settings";
import type { MortgageStorage } from "./server/storage";
import { client, createTestStaff, localStack, psql, retireTestStaff, type LocalStack, type TestStaff } from "./testing/local-stack";

const stack = localStack();
if (!stack) console.warn("mortgage retention and erasure tests skipped: start the local stack with `npm run db:local:reset`");

/** Storage that remembers what it was asked to delete. */
function memoryStorage() {
  const removed: string[] = [];
  const storage: MortgageStorage = {
    async presignUpload(key) {
      return { url: `memory://${key}`, headers: {} };
    },
    async read() {
      return null;
    },
    async remove(keys) {
      removed.push(...keys);
    },
  };
  return { storage, removed };
}

describe.skipIf(!stack)("retention and erasure (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let policy: SlaPolicy;
  let head: TestStaff;
  let bankId: string;
  let bankCode: string;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    policy = (await loadMortgageSettings(service)).policy;
    head = await createTestStaff(local, service, "support", "head");
    bankCode = `R${randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
    const { data, error } = await service
      .from("mortgage_partner_banks")
      .insert({ code: bankCode, name: "Retention Test Bank", active: false })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    bankId = (data as { id: string }).id;
  }, 60_000);

  afterAll(() => retireTestStaff(service));

  // ── Helpers ─────────────────────────────────────────────────

  const mobile = () => `+97150${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

  async function request(opts: { email?: string; mobile?: string } = {}): Promise<{ id: string; reference: string }> {
    const at = new Date();
    const { data, error } = await service.rpc("mortgage_create_request", {
      p_service: "pre_approval",
      p_full_name: "Test Applicant",
      p_date_of_birth: "1990-01-01",
      p_mobile_e164: opts.mobile ?? mobile(),
      p_email: opts.email ?? `applicant-${randomUUID().slice(0, 8)}@example.com`,
      p_residency: "uae_resident_expat",
      p_employment_type: "salaried",
      p_entry_point: "direct",
      p_at: at.toISOString(),
      p_consent_version: "v0.1",
      p_consent_text: "Consent.",
      p_sla_due_at: clockDueFrom(at, policy),
    });
    if (error) throw new Error(`create failed: ${error.code} ${error.message}`);
    return data as { id: string; reference: string };
  }

  /** A clean file on each of the request's documents; returns their storage keys. */
  async function files(requestId: string, name = "statement.pdf"): Promise<string[]> {
    const { data: docs } = await service.from("mortgage_documents").select("id, kind").eq("request_id", requestId);
    const rows = ((docs ?? []) as { id: string; kind: string }[]).map((d) => {
      const id = randomUUID();
      return {
        id,
        document_id: d.id,
        kind: d.kind,
        state: "active",
        storage_key: `f/${id}`,
        original_name: name,
        mime: "application/pdf",
        size_bytes: 1000,
        scan_status: "clean",
      };
    });
    const { error } = await service.from("mortgage_files").insert(rows);
    if (error) throw new Error(error.message);
    return rows.map((r) => r.storage_key);
  }

  /** Closed `months` months ago: the decision, then the date moved back as only the transition may. */
  function closeMonthsAgo(id: string, months: number) {
    psql(`
      begin;
      select set_config('mortgage.transition', 'on', true);
      update public.mortgage_requests
         set status = 'declined', decision = 'declined', decided_at = now() - interval '${months} months',
             closed_at = now() - interval '${months} months', sla_stopped_at = now() - interval '${months} months'
       where id = '${id}';
      commit;`);
  }

  async function liveFiles(requestId: string) {
    const { data } = await service
      .from("mortgage_files")
      .select("id, state, original_name, document:mortgage_documents!inner(request_id)")
      .eq("document.request_id", requestId);
    return (data ?? []) as { id: string; state: string; original_name: string }[];
  }

  // ── Retention ───────────────────────────────────────────────

  it("deletes a long-closed request's files, objects first, and leaves recent and open ones", async () => {
    const old = await request();
    const recent = await request();
    const open = await request();
    const oldKeys = await files(old.id, "passport-scan.pdf");
    const recentKeys = await files(recent.id);
    const openKeys = await files(open.id);
    closeMonthsAgo(old.id, 13);
    closeMonthsAgo(recent.id, 2);

    const mem = memoryStorage();
    // Unset (D7): nothing is due.
    expect(await purgeRetainedFiles({ db: service, storage: mem.storage }, { months: null })).toEqual({ months: null, files: 0, remaining: false });
    expect(mem.removed).toEqual([]);

    const report = await purgeRetainedFiles({ db: service, storage: mem.storage }, { months: 12 });
    expect(report.files).toBeGreaterThanOrEqual(oldKeys.length);
    expect(mem.removed).toEqual(expect.arrayContaining(oldKeys));
    for (const key of [...recentKeys, ...openKeys]) expect(mem.removed).not.toContain(key);

    const retired = await liveFiles(old.id);
    expect(retired.every((f) => f.state === "removed" && f.original_name === "deleted")).toBe(true);
    expect((await liveFiles(recent.id)).every((f) => f.state === "active")).toBe(true);
    const { data: events } = await service.from("mortgage_events").select("type, data").eq("request_id", old.id).eq("type", "files.purged");
    expect(events).toEqual([{ type: "files.purged", data: { files: oldKeys.length, reason: "retention" } }]);
    // The request itself stays.
    expect((await service.from("mortgage_requests").select("id").eq("id", old.id)).data).toHaveLength(1);

    // Again: nothing more of this request is due.
    const again = memoryStorage();
    await purgeRetainedFiles({ db: service, storage: again.storage }, { months: 12 });
    for (const key of oldKeys) expect(again.removed).not.toContain(key);
  }, 60_000);

  // ── Erasure ─────────────────────────────────────────────────

  it("finds a subject by email and by mobile, exports what's held, then erases all of it", async () => {
    const email = `subject-${randomUUID().slice(0, 8)}@example.com`;
    const phone = mobile();
    const first = await request({ email });
    const second = await request({ mobile: phone }); // another address, the same mobile
    const bystander = await request();
    const firstKeys = await files(first.id, "emirates-id.pdf");
    const secondKeys = await files(second.id);
    const bystanderKeys = await files(bystander.id);

    // A bank was sent the first request, and wrote a letter.
    const { data: sub, error: subError } = await service
      .from("mortgage_bank_submissions")
      .insert({ request_id: first.id, bank_id: bankId, status: "declined" })
      .select("id")
      .single();
    expect(subError).toBeNull();
    const letterId = randomUUID();
    const letter = await service.from("mortgage_files").insert({
      id: letterId,
      bank_submission_id: (sub as { id: string }).id,
      state: "active",
      storage_key: `f/${letterId}`,
      original_name: "letter.pdf",
      mime: "application/pdf",
      size_bytes: 500,
      scan_status: "clean",
    });
    expect(letter.error).toBeNull();
    // A secure link whose upload was never sent: its draft doesn't hang off the request.
    const { data: draft, error: draftError } = await service
      .from("mortgage_upload_drafts")
      .insert({ token_hash: randomUUID().replace(/-/g, "").padEnd(64, "0"), expires_at: new Date(Date.now() + 86_400_000).toISOString() })
      .select("id")
      .single();
    expect(draftError).toBeNull();
    const draftId = (draft as { id: string }).id;
    const link = await service.from("mortgage_access_links").insert({
      request_id: first.id,
      purpose: "preapproval_invite",
      token_hash: randomUUID().replace(/-/g, "").padEnd(64, "1"),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      draft_id: draftId,
    });
    expect(link.error).toBeNull();
    const unsentId = randomUUID();
    const unsent = await service.from("mortgage_files").insert({
      id: unsentId,
      draft_id: draftId,
      state: "active",
      storage_key: `f/${unsentId}`,
      original_name: "unsent.pdf",
      mime: "application/pdf",
      size_bytes: 400,
      scan_status: "clean",
    });
    expect(unsent.error).toBeNull();

    const found = await findMortgageRequests(service, { email: ` ${email.toUpperCase()} `, mobile: phone.replace("+971", "0") });
    expect(found.map((r) => r.id).sort()).toEqual([first.id, second.id].sort());

    const exported = await mortgageExport(service, [first.id]);
    expect(exported).toHaveLength(1);
    expect(exported[0]).toMatchObject({
      reference: first.reference,
      applicant: { email, full_name: "Test Applicant" },
      consents: [expect.objectContaining({ wording_version: "v0.1" })],
      shared_with_banks: [expect.objectContaining({ bank: "Retention Test Bank", status: "declined" })],
    });
    const docs = (exported[0]!.documents as { files: { original_name: string }[] }[]).flatMap((d) => d.files.map((f) => f.original_name));
    expect(docs).toContain("emirates-id.pdf");

    const mem = memoryStorage();
    const erased = await eraseMortgageRequests({ db: service, storage: mem.storage }, found.map((r) => r.id));
    expect(erased.requests.sort()).toEqual([first.reference, second.reference].sort());
    expect(erased.files).toBe(firstKeys.length + secondKeys.length + 2);
    expect(erased.events).toBeGreaterThan(0);
    // "Retention Test Bank" is more than a word, so it's named by its code, as the designs name banks.
    expect(erased.shared_with_banks).toEqual([
      expect.objectContaining({ reference: first.reference, bank: bankCode, label: bankCode, status: "declined" }),
    ]);
    expect(mem.removed.sort()).toEqual([...firstKeys, ...secondKeys, `f/${letterId}`, `f/${unsentId}`].sort());

    for (const id of [first.id, second.id]) {
      expect((await service.from("mortgage_requests").select("id").eq("id", id)).data).toEqual([]);
      expect((await service.from("mortgage_events").select("id").eq("request_id", id)).data).toEqual([]);
      expect((await service.from("mortgage_consents").select("id").eq("request_id", id)).data).toEqual([]);
    }
    expect((await service.from("mortgage_files").select("id").in("id", [letterId, unsentId])).data).toEqual([]);
    expect((await service.from("mortgage_upload_drafts").select("id").eq("id", draftId)).data).toEqual([]);

    // Nobody else's.
    expect((await service.from("mortgage_requests").select("id").eq("id", bystander.id)).data).toHaveLength(1);
    for (const key of bystanderKeys) expect(mem.removed).not.toContain(key);
  }, 60_000);

  it("keeps both to the service role, and the log append-only everywhere else", async () => {
    const r = await request();
    for (const [fn, args] of [
      ["mortgage_erase_requests", { p_request_ids: [r.id] }],
      ["mortgage_erasure_files", { p_request_ids: [r.id] }],
      ["mortgage_retention_files", { p_months: 1 }],
      ["mortgage_retire_files", { p_file_ids: [] }],
    ] as const) {
      const { error } = await head.client.rpc(fn, args as never);
      expect(error?.code, fn).toBe("42501");
    }
    const { error } = await service.from("mortgage_events").delete().eq("request_id", r.id);
    expect(error).not.toBeNull();
    expect((await service.from("mortgage_events").select("id").eq("request_id", r.id)).data!.length).toBeGreaterThan(0);
  }, 60_000);
});

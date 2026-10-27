/**
 * @vitest-environment node
 */

/**
 * Internal notes and case documents (0171), against the local Supabase stack
 * (`npm run db:local:reset && npm run test:db`):
 *
 *   · a note is added by the owner or the Head, never by another adviser or an
 *     admin without a mortgage role, never on a stale page; it is logged and
 *     signed-in staff can read it but not write it directly;
 *   · a case document starts with a pending file, is completed only by the
 *     service role, at most 10 per request, removed by the owner or the Head
 *     (its file retired, the slot freed);
 *   · the file route may log an open of a case document's file, and only for
 *     its own request;
 *   · erasure lists a case document's file, so its bucket object goes first.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { client, createTestStaff, localStack, retireTestStaff, type LocalStack, type TestStaff } from "./testing/local-stack";

const stack = localStack();
if (!stack) console.warn("mortgage notes / case documents tests skipped: start the local stack with `npm run db:local:reset`");

type Row = { id: string; updated_at: string };

describe.skipIf(!stack)("internal notes and case documents (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let head: TestStaff;
  let owner: TestStaff;
  let other: TestStaff;
  let admin: TestStaff;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    [head, owner, other, admin] = await Promise.all([
      createTestStaff(local, service, "support", "head"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "admin", null),
    ]);
  }, 60_000);

  afterAll(async () => {
    await retireTestStaff(service);
  });

  async function create(): Promise<Row> {
    const { data, error } = await service.rpc("mortgage_create_request", {
      p_service: "consultancy",
      p_full_name: "Test Applicant",
      p_date_of_birth: "1990-01-01",
      p_mobile_e164: `+97150${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
      p_email: `applicant-${randomUUID().slice(0, 8)}@example.com`,
      p_residency: "uae_resident_expat",
      p_employment_type: "salaried",
      p_entry_point: "direct",
      p_at: new Date().toISOString(),
    });
    if (error) throw new Error(`create failed: ${error.code} ${error.message}`);
    await service.from("mortgage_requests").update({ owner_staff_id: owner.id }).eq("id", (data as Row).id);
    return read((data as Row).id);
  }

  async function read(id: string): Promise<Row> {
    const { data, error } = await service.from("mortgage_requests").select("id, updated_at").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data as Row;
  }

  function addDoc(who: TestStaff, r: Row, title = "Offer letter", fileId = randomUUID()) {
    return who.client.rpc("mortgage_add_case_document", {
      p_request_id: r.id,
      p_title: title,
      p_description: "From the bank, signed.",
      p_file_id: fileId,
      p_original_name: "offer.pdf",
      p_mime: "application/pdf",
      p_size_bytes: 12_345,
      p_expected_updated_at: r.updated_at,
    });
  }

  // ── Notes ───────────────────────────────────────────────────

  it("lets the owner and the Head add a note, and nobody else", async () => {
    const r = await create();
    for (const who of [other, admin]) {
      const { error } = await who.client.rpc("mortgage_add_note", {
        p_request_id: r.id, p_body: "Not mine.", p_expected_updated_at: r.updated_at,
      });
      expect(error?.code).toBe("MR403");
    }

    const { data, error } = await owner.client.rpc("mortgage_add_note", {
      p_request_id: r.id, p_body: "  Called the bank; waiting on the valuation.  ", p_expected_updated_at: r.updated_at,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ body: "Called the bank; waiting on the valuation.", author_id: owner.id });

    // The page it was added from is now stale.
    const stale = await head.client.rpc("mortgage_add_note", {
      p_request_id: r.id, p_body: "Late.", p_expected_updated_at: r.updated_at,
    });
    expect(stale.error?.code).toBe("MR409");
    const fresh = await read(r.id);
    const byHead = await head.client.rpc("mortgage_add_note", {
      p_request_id: r.id, p_body: "Approved to proceed.", p_expected_updated_at: fresh.updated_at,
    });
    expect(byHead.error).toBeNull();

    const { data: events } = await service.from("mortgage_events").select("type, actor_id")
      .eq("request_id", r.id).eq("type", "note.added").order("created_at");
    expect(events).toEqual([
      { type: "note.added", actor_id: owner.id },
      { type: "note.added", actor_id: head.id },
    ]);
  });

  it("refuses an empty note, and lets signed-in staff read notes but not write them", async () => {
    const r = await create();
    const empty = await owner.client.rpc("mortgage_add_note", {
      p_request_id: r.id, p_body: "   ", p_expected_updated_at: r.updated_at,
    });
    expect(empty.error?.code).toBe("MR422");

    const direct = await owner.client.from("mortgage_notes").insert({ request_id: r.id, body: "Sneaky." });
    expect(direct.error).not.toBeNull();

    await owner.client.rpc("mortgage_add_note", {
      p_request_id: r.id, p_body: "Visible to the team.", p_expected_updated_at: r.updated_at,
    });
    const { data } = await other.client.from("mortgage_notes").select("body").eq("request_id", r.id);
    expect(data).toEqual([{ body: "Visible to the team." }]);
  });

  // ── Case documents ──────────────────────────────────────────

  it("adds a case document with a pending file that only the service role completes", async () => {
    const r = await create();
    const fileId = randomUUID();
    const { data, error } = await addDoc(owner, r, "Valuation report", fileId);
    expect(error).toBeNull();
    expect(data).toMatchObject({ title: "Valuation report", description: "From the bank, signed." });

    const { data: file } = await service.from("mortgage_files").select("state, storage_key, case_document_id")
      .eq("id", fileId).single();
    expect(file).toMatchObject({ state: "pending", storage_key: `f/${fileId}` });

    const byStaff = await owner.client.rpc("mortgage_complete_case_document", { p_file_id: fileId, p_sha256: "a".repeat(64) });
    expect(byStaff.error).not.toBeNull();

    const bySystem = await service.rpc("mortgage_complete_case_document", { p_file_id: fileId, p_sha256: "a".repeat(64) });
    expect(bySystem.error).toBeNull();
    const { data: done } = await service.from("mortgage_files").select("state, scan_status").eq("id", fileId).single();
    expect(done).toEqual({ state: "active", scan_status: "clean" });
  });

  it("refuses another adviser, an admin, a missing title, and an eleventh document", async () => {
    const r = await create();
    for (const who of [other, admin]) expect((await addDoc(who, r)).error?.code).toBe("MR403");
    expect((await addDoc(owner, r, "  ")).error?.code).toBe("MR422");

    for (let i = 1; i <= 10; i++) {
      const fresh = await read(r.id);
      const { error } = await addDoc(owner, fresh, `Document ${i}`);
      expect(error, `document ${i}`).toBeNull();
    }
    const eleventh = await addDoc(owner, await read(r.id), "One too many");
    expect(eleventh.error?.code).toBe("MR422");
  });

  it("removes a document: its file retired, its slot freed, the removal logged", async () => {
    const r = await create();
    const fileId = randomUUID();
    const { data: doc } = await addDoc(owner, r, "Wrong file", fileId);
    const docId = (doc as { id: string }).id;

    const byOther = await other.client.rpc("mortgage_remove_case_document", { p_case_document_id: docId });
    expect(byOther.error?.code).toBe("MR403");

    const { data: removed, error } = await head.client.rpc("mortgage_remove_case_document", { p_case_document_id: docId });
    expect(error).toBeNull();
    expect(removed).toEqual([{ file_id: fileId, storage_key: `f/${fileId}` }]);

    const { data: file } = await service.from("mortgage_files").select("state").eq("id", fileId).single();
    expect(file).toEqual({ state: "removed" });
    const again = await head.client.rpc("mortgage_remove_case_document", { p_case_document_id: docId });
    expect(again.error?.code).toBe("MR404");

    const { data: events } = await service.from("mortgage_events").select("type").eq("request_id", r.id)
      .in("type", ["case_document.added", "case_document.removed"]).order("created_at");
    expect(events?.map((e) => e.type)).toEqual(["case_document.added", "case_document.removed"]);
  });

  it("lets the file route log an open of a case document's file, for its own request only", async () => {
    const r = await create();
    const elsewhere = await create();
    const fileId = randomUUID();
    await addDoc(owner, r, "Offer letter", fileId);

    const own = await other.client.rpc("mortgage_log_event", {
      p_request_id: r.id, p_type: "document.viewed", p_data: { file_id: fileId }, p_actor_kind: "staff",
    });
    expect(own.error).toBeNull();
    const wrong = await other.client.rpc("mortgage_log_event", {
      p_request_id: elsewhere.id, p_type: "document.viewed", p_data: { file_id: fileId }, p_actor_kind: "staff",
    });
    expect(wrong.error?.code).toBe("MR403");
  });

  it("lists a case document's file for erasure, and erasing the request deletes it", async () => {
    const r = await create();
    const fileId = randomUUID();
    await addDoc(owner, r, "Offer letter", fileId);

    const { data: listed } = await service.rpc("mortgage_erasure_files", { p_request_ids: [r.id] });
    expect((listed as { file_id: string }[]).map((f) => f.file_id)).toContain(fileId);

    const { error } = await service.rpc("mortgage_erase_requests", { p_request_ids: [r.id] });
    expect(error).toBeNull();
    const { data: gone } = await service.from("mortgage_files").select("id").eq("id", fileId);
    expect(gone).toEqual([]);
  });
});

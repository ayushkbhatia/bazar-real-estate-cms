/**
 * @vitest-environment node
 */

/**
 * Partner banks and the decision (Phase 6, migration 0149), against the local
 * Supabase stack (`npm run db:local:reset && npm run test:db`):
 *
 *   · sending: only an in-review file with every document accepted and
 *     consent on file, only by the owner or the Head, only to a bank that can
 *     take a package; one expiring link per bank, its hash stored;
 *   · the package: a withdrawn link shows nothing, an expired one says so, and
 *     every open and download is logged as the bank before anything is read;
 *   · a reminder rotates the link, and a second one within ten minutes waits;
 *   · a response: an offer needs its figures and a clean letter, a decline
 *     needs neither; a new letter replaces the old;
 *   · pre-approving: a valid lead offer with its letter and consent on file;
 *     the clock stops, banks still deciding are withdrawn, and the applicant is
 *     emailed the adviser's words with the letter attached;
 *   · the banks themselves: the Head or an admin;
 *   · a withdrawal of consent (0152): the banks still deciding withdrawn, every
 *     link stopped, the reminder and the package refused.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendEmailInput, SendEmailResult } from "@/lib/email";
import { clockDueFrom, slaStatus, type SlaFields, type SlaPolicy } from "./sla";
import { bankLabel, findPackage, openPackageFile, packageLinks, packageState, packageView } from "./server/banks";
import { deliverNotifications } from "./server/notify";
import { completeLetter } from "./server/letters";
import { loadMortgageSettings } from "./server/settings";
import type { MortgageStorage } from "./server/storage";
import { hashToken } from "./server/tokens";
import { buildPdf } from "./testing/fixtures";
import { client, createTestStaff, localStack, psql, retireTestStaff, type LocalStack, type TestStaff } from "./testing/local-stack";

const stack = localStack();
if (!stack) console.warn("mortgage bank tests skipped: start the local stack with `npm run db:local:reset`");

type Row = SlaFields & {
  id: string;
  reference: string;
  status: string;
  updated_at: string;
  decision: string | null;
  decision_message: string | null;
  decided_by: string | null;
  lead_bank_submission_id: string | null;
};

type Submission = {
  id: string;
  bank_id: string;
  status: string;
  package_token_hash: string | null;
  package_expires_at: string | null;
  reminder_sent_at: string | null;
  max_amount_aed: number | null;
};

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
const MESSAGE = "Good news, Test: you're pre-approved.\n\nI'll call you tomorrow morning to talk it through. Yasmin";

/** Storage that remembers what was read, and when, against the event log. */
function memoryStorage() {
  const objects = new Map<string, Uint8Array>();
  const reads: string[] = [];
  const storage: MortgageStorage = {
    async presignUpload(key) {
      return { url: `memory://${key}`, headers: {} };
    },
    async read(key) {
      reads.push(key);
      return objects.get(key) ?? null;
    },
    async remove(keys) {
      for (const k of keys) objects.delete(k);
    },
  };
  return { storage, objects, reads };
}

describe.skipIf(!stack)("partner banks and the decision (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let policy: SlaPolicy;
  let head: TestStaff;
  let owner: TestStaff;
  let other: TestStaff;
  let admin: TestStaff;
  let days: number;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    const loaded = await loadMortgageSettings(service);
    policy = loaded.policy;
    days = loaded.settings.link_expiry_days;
    [head, owner, other, admin] = await Promise.all([
      createTestStaff(local, service, "support", "head"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "admin", null),
    ]);
  }, 60_000);

  // Banks can't be deleted (their submissions point at them): switch this run's off, so the
  // local list the CMS offers stays the seeded three.
  const made: string[] = [];
  afterAll(async () => {
    if (made.length) await service.from("mortgage_partner_banks").update({ active: false }).in("id", made);
    await retireTestStaff(service);
  });

  // ── Helpers ─────────────────────────────────────────────────

  const code = () => `T${randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase()}`;

  async function bank(opts: { name?: string; active?: boolean; inboxes?: string[] } = {}): Promise<{ id: string; code: string; name: string }> {
    const row = {
      code: code(),
      name: opts.name ?? "Test Bank of Abu Dhabi",
      active: opts.active ?? true,
      package_emails: opts.inboxes ?? ["packages@bank.example.com"],
    };
    const { data, error } = await service.from("mortgage_partner_banks").insert(row).select("id, code, name").single();
    if (error) throw new Error(error.message);
    made.push((data as { id: string }).id);
    return data as { id: string; code: string; name: string };
  }

  async function read(id: string): Promise<Row> {
    const { data, error } = await service.from("mortgage_requests").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data as Row;
  }

  /** A Fast Pre-Approval, opened by its owner, with every document accepted. */
  async function inReview(opts: { accepted?: boolean } = {}): Promise<Row> {
    const at = new Date();
    const { data, error } = await service.rpc("mortgage_create_request", {
      p_service: "pre_approval",
      p_full_name: "Test Applicant",
      p_date_of_birth: "1990-01-01",
      p_mobile_e164: `+97150${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
      p_email: `applicant-${randomUUID().slice(0, 8)}@example.com`,
      p_residency: "uae_resident_expat",
      p_employment_type: "salaried",
      p_entry_point: "direct",
      p_at: at.toISOString(),
      p_consent_version: "v0.1",
      p_consent_text: "Consent.",
      p_sla_due_at: clockDueFrom(at, policy),
    });
    if (error) throw new Error(`create failed: ${error.code} ${error.message}`);
    const id = (data as Row).id;
    await service.from("mortgage_requests").update({ owner_staff_id: owner.id }).eq("id", id);
    const { error: moveError } = await service.rpc("mortgage_transition", {
      p_request_id: id,
      p_event: "first_document_opened",
      p_actor_kind: "system",
      p_sla: {},
      p_data: {},
    });
    if (moveError) throw new Error(moveError.message);
    if (opts.accepted ?? true) await service.from("mortgage_documents").update({ state: "accepted" }).eq("request_id", id);
    return read(id);
  }

  function send(as: TestStaff, row: Row, bankIds: string[], expected: string | null = row.updated_at) {
    const { links, packages } = packageLinks(bankIds, new Date(), days);
    return {
      links,
      result: as.client.rpc("mortgage_send_to_banks", {
        p_request_id: row.id,
        p_packages: packages,
        p_manifest: { documents: 4, summary: true },
        p_expected_updated_at: expected as string,
      }),
    };
  }

  /** A file with the banks: its row, one submission per bank, and each package's token. */
  async function withBanks(count = 2) {
    const banks = await Promise.all(Array.from({ length: count }, () => bank()));
    const row = await inReview();
    const { links, result } = send(owner, row, banks.map((b) => b.id));
    const { error } = await result;
    if (error) throw new Error(`send failed: ${error.code} ${error.message}`);
    const subs = await submissions(row.id);
    const byBank = (id: string) => subs.find((s) => s.bank_id === id)!;
    return {
      row: await read(row.id),
      banks,
      subs: banks.map((b) => byBank(b.id)),
      tokens: banks.map((b) => links.find((l) => l.bankId === b.id)!.token),
    };
  }

  async function submissions(requestId: string): Promise<Submission[]> {
    const { data } = await service.from("mortgage_bank_submissions").select("*").eq("request_id", requestId);
    return (data ?? []) as Submission[];
  }

  async function submission(id: string): Promise<Submission> {
    const { data } = await service.from("mortgage_bank_submissions").select("*").eq("id", id).single();
    return data as Submission;
  }

  /** A letter's row through the adviser's session, its bytes in memory, checked. */
  async function letter(as: TestStaff, submissionId: string, mem: ReturnType<typeof memoryStorage>, name = "bank-letter.pdf") {
    const { data, error } = await as.client.rpc("mortgage_letter_presign", {
      p_submission_id: submissionId,
      p_name: name,
      p_size_bytes: 2000,
    });
    if (error) throw new Error(`presign failed: ${error.code} ${error.message}`);
    const file = data as { id: string; storage_key: string };
    mem.objects.set(file.storage_key, buildPdf({ lines: () => ["Pre-approval letter", name] }));
    const checked = await completeLetter({ db: service, storage: mem.storage }, file.id);
    expect(checked).toMatchObject({ status: "ready", fileId: file.id });
    return file;
  }

  function record(
    as: TestStaff,
    submissionId: string,
    opts: Partial<{
      status: "pre_approved" | "declined";
      amount: number | null;
      rate: number | null;
      type: "fixed" | "variable" | null;
      years: number | null;
      validUntil: string | null;
      letter: string | null;
    }> = {},
  ) {
    const offer = (opts.status ?? "pre_approved") === "pre_approved";
    const args = {
      p_submission_id: submissionId,
      p_status: opts.status ?? "pre_approved",
      p_max_amount_aed: opts.amount !== undefined ? opts.amount : offer ? 2_150_000 : null,
      p_rate_pct: opts.rate !== undefined ? opts.rate : offer ? 3.99 : null,
      p_rate_type: opts.type !== undefined ? opts.type : offer ? "fixed" : null,
      p_fixed_years: opts.years !== undefined ? opts.years : offer ? 3 : null,
      p_valid_until: opts.validUntil !== undefined ? opts.validUntil : offer ? inDays(60) : null,
      p_letter_file_id: opts.letter ?? null,
      p_notes: "",
    };
    return as.client.rpc("mortgage_record_bank_response", args as never);
  }

  function preApprove(as: TestStaff, row: Row, lead: string, opts: { message?: string; channels?: string[]; expected?: string } = {}) {
    return as.client.rpc("mortgage_pre_approve", {
      p_request_id: row.id,
      p_lead_submission_id: lead,
      p_message: opts.message ?? `  ${MESSAGE}  `,
      p_channels: opts.channels ?? ["email", "whatsapp"],
      p_expected_updated_at: opts.expected ?? row.updated_at,
    });
  }

  async function events(id: string) {
    const { data } = await service
      .from("mortgage_events")
      .select("type, actor_kind, actor_id, data, created_at")
      .eq("request_id", id)
      .order("created_at");
    return (data ?? []) as { type: string; actor_kind: string; actor_id: string | null; data: Record<string, unknown>; created_at: string }[];
  }

  // ── Sending ─────────────────────────────────────────────────

  it("sends an accepted file to the chosen banks: one expiring link each, only its hash kept", async () => {
    const { row, banks, subs, tokens } = await withBanks(2);
    expect(row.status).toBe("with_banks");
    for (const [i, s] of subs.entries()) {
      expect(s).toMatchObject({ status: "sent" });
      expect(s.package_token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(s.package_token_hash).not.toContain(tokens[i]);
      const days_ = (new Date(s.package_expires_at!).getTime() - Date.now()) / DAY;
      expect(days_).toBeGreaterThan(days - 0.01);
      expect(days_).toBeLessThanOrEqual(days);
    }
    const sent = (await events(row.id)).find((e) => e.type === "bank.package_sent");
    expect(sent).toMatchObject({ actor_id: owner.id, data: { banks: banks.map((b) => b.code), documents: 4 } });
    // "Test Bank of Abu Dhabi" is more than a word: the log names it by its code, as the designs do.
    expect(sent!.data.labels).toEqual(banks.map((b) => b.code));
  }, 60_000);

  it("won't send before every document is accepted, without consent, by someone else, or to a bank that can't take it", async () => {
    const ready = await bank();
    const notAccepted = await inReview({ accepted: false });
    expect((await send(owner, notAccepted, [ready.id]).result).error?.code).toBe("MR422");

    const noConsent = await inReview();
    await service.from("mortgage_consents").update({ withdrawn_at: new Date().toISOString() }).eq("request_id", noConsent.id);
    expect((await send(owner, await read(noConsent.id), [ready.id]).result).error?.code).toBe("MR422");

    const row = await inReview();
    expect((await send(other, row, [ready.id]).result).error?.code).toBe("MR403");
    expect((await send(admin, row, [ready.id]).result).error?.code).toBe("MR403");

    const off = await bank({ active: false });
    const noInbox = await bank({ inboxes: [] }).catch(() => null);
    const refusedOff = await send(owner, row, [off.id]).result;
    expect(refusedOff.error?.code).toBe("MR422");
    expect(refusedOff.error?.message).toContain("bank_unavailable");
    // An active bank can't be saved without an inbox through the function; straight in, it still can't take a package.
    if (noInbox) expect((await send(owner, row, [noInbox.id]).result).error?.message).toContain("bank_unavailable");

    expect((await send(owner, row, [ready.id], "2020-01-01T00:00:00Z").result).error?.code).toBe("MR409");
    expect((await read(row.id)).status).toBe("in_review");
    expect(await submissions(row.id)).toEqual([]);
  }, 60_000);

  // ── The package ─────────────────────────────────────────────

  it("opens the package behind its link: accepted documents only, every download logged as the bank first", async () => {
    const { row, subs, tokens } = await withBanks(1);
    const found = await findPackage(service, tokens[0]!);
    expect(found?.submission.id).toBe(subs[0]!.id);
    expect(packageState(found, new Date())).toBe("open");
    expect(await findPackage(service, "not-a-token")).toBeNull();
    expect(await findPackage(service, "A".repeat(43))).toBeNull();

    // One accepted document with a clean file; one sent back, whose file the bank must not get.
    const { data: docs } = await service.from("mortgage_documents").select("id, kind").eq("request_id", row.id).order("kind");
    const [shown, hidden] = docs as { id: string; kind: string }[];
    await service.from("mortgage_documents").update({ state: "to_review" }).eq("id", hidden!.id);
    const mem = memoryStorage();
    const files = [shown, hidden].map((d) => ({
      id: randomUUID(),
      document_id: d!.id,
      kind: d!.kind,
      state: "active",
      storage_key: `f/${randomUUID()}`,
      original_name: `${d!.kind}.pdf`,
      mime: "application/pdf",
      size_bytes: 1000,
      scan_status: "clean",
    }));
    const { error } = await service.from("mortgage_files").insert(files);
    expect(error).toBeNull();
    for (const f of files) mem.objects.set(f.storage_key, buildPdf());

    const view = await packageView(service, found!);
    expect(view.reference).toBe(row.reference);
    expect(view.documents.map((d) => d.kind)).not.toContain(hidden!.kind);
    expect(view.documents.find((d) => d.kind === shown!.kind)?.files.map((f) => f.id)).toEqual([files[0]!.id]);

    const before = (await events(row.id)).length;
    const opened = await openPackageFile({ db: service, storage: mem.storage }, tokens[0]!, files[0]!.id);
    expect(opened.name).toBe(files[0]!.original_name);
    const log = await events(row.id);
    expect(log.length).toBe(before + 1);
    expect(log.at(-1)).toMatchObject({ type: "document.downloaded", actor_kind: "bank", data: { file_id: files[0]!.id } });

    await expect(openPackageFile({ db: service, storage: mem.storage }, tokens[0]!, files[1]!.id)).rejects.toMatchObject({ status: 404 });
    expect(mem.reads).toEqual([files[0]!.storage_key]);

    // Expired: the page says so and no file comes out. Withdrawn: nothing at all.
    await service.from("mortgage_bank_submissions").update({ package_expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", subs[0]!.id);
    expect(packageState(await findPackage(service, tokens[0]!), new Date())).toBe("expired");
    await expect(openPackageFile({ db: service, storage: mem.storage }, tokens[0]!, files[0]!.id)).rejects.toMatchObject({ status: 410 });
    await service.from("mortgage_bank_submissions").update({ status: "withdrawn" }).eq("id", subs[0]!.id);
    expect(packageState(await findPackage(service, tokens[0]!), new Date())).toBe("unavailable");
    await expect(openPackageFile({ db: service, storage: mem.storage }, tokens[0]!, files[0]!.id)).rejects.toMatchObject({ status: 404 });
    expect(mem.reads).toHaveLength(1);
  }, 60_000);

  // ── Reminders ───────────────────────────────────────────────

  it("a reminder issues a fresh link, retires the old one, and waits ten minutes before another", async () => {
    const { row, subs, tokens } = await withBanks(1);
    const [link] = packageLinks([subs[0]!.bank_id], new Date(), days).links;
    const { error } = await owner.client.rpc("mortgage_bank_reminder", {
      p_submission_id: subs[0]!.id,
      p_token_hash: hashToken(link!.token),
      p_expires_at: link!.expiresAt,
    });
    expect(error).toBeNull();
    expect(await findPackage(service, tokens[0]!)).toBeNull();
    expect((await findPackage(service, link!.token))?.submission.id).toBe(subs[0]!.id);
    expect((await submission(subs[0]!.id)).reminder_sent_at).not.toBeNull();
    expect((await events(row.id)).at(-1)).toMatchObject({ type: "bank.reminder_sent", actor_id: owner.id });

    const [again] = packageLinks([subs[0]!.bank_id], new Date(), days).packages;
    const second = await owner.client.rpc("mortgage_bank_reminder", {
      p_submission_id: subs[0]!.id,
      p_token_hash: again!.token_hash,
      p_expires_at: again!.expires_at,
    });
    expect(second.error?.code).toBe("MR409");
    expect(second.error?.message).toContain("reminded_recently");
    expect((await other.client.rpc("mortgage_bank_reminder", {
      p_submission_id: subs[0]!.id,
      p_token_hash: again!.token_hash,
      p_expires_at: again!.expires_at,
    })).error?.code).toBe("MR403");
  }, 60_000);

  // ── Responses ───────────────────────────────────────────────

  it("records an offer only with its figures and a clean letter, and a decline with neither", async () => {
    const { row, subs } = await withBanks(2);
    const mem = memoryStorage();

    // No letter yet, then one still being checked: refused.
    expect((await record(owner, subs[0]!.id)).error?.message).toContain("letter_not_ready");
    const { data: pending } = await owner.client.rpc("mortgage_letter_presign", { p_submission_id: subs[0]!.id, p_name: "x.pdf", p_size_bytes: 10 });
    expect((await record(owner, subs[0]!.id, { letter: (pending as { id: string }).id })).error?.message).toContain("letter_not_ready");
    // Too big to presign, and not by someone else.
    expect((await owner.client.rpc("mortgage_letter_presign", { p_submission_id: subs[0]!.id, p_name: "x.pdf", p_size_bytes: 11 * 1_048_576 })).error?.code).toBe("MR422");
    expect((await other.client.rpc("mortgage_letter_presign", { p_submission_id: subs[0]!.id, p_name: "x.pdf", p_size_bytes: 10 })).error?.code).toBe("MR403");

    const first = await letter(owner, subs[0]!.id, mem, "FAB-letter.pdf");
    for (const bad of [
      { amount: 0 },
      { rate: 30 },
      { type: "fixed" as const, years: null },
      { type: "variable" as const, years: 3 },
      { validUntil: inDays(-2) },
    ]) {
      expect((await record(owner, subs[0]!.id, { ...bad, letter: first.id })).error?.message).toContain("bad_offer");
    }
    expect((await record(other, subs[0]!.id, { letter: first.id })).error?.code).toBe("MR403");
    expect((await record(owner, subs[0]!.id, { letter: first.id })).error).toBeNull();
    expect(await submission(subs[0]!.id)).toMatchObject({ status: "pre_approved", max_amount_aed: 2150000 });
    expect((await events(row.id)).at(-1)).toMatchObject({
      type: "bank.response_recorded",
      data: { status: "pre_approved", amount: 2150000, rate: 3.99, letter: "FAB-letter.pdf" },
    });

    // A new letter replaces the old one.
    const second = await letter(owner, subs[0]!.id, mem, "FAB-letter-v2.pdf");
    expect((await record(owner, subs[0]!.id, { letter: second.id, amount: 2_200_000 })).error).toBeNull();
    const { data: letters } = await service.from("mortgage_files").select("id, state").eq("bank_submission_id", subs[0]!.id).eq("state", "active");
    expect((letters as { id: string }[]).map((l) => l.id)).toEqual([second.id]);

    // A decline: no figures, no letter.
    expect((await record(owner, subs[1]!.id, { status: "declined" })).error).toBeNull();
    expect(await submission(subs[1]!.id)).toMatchObject({ status: "declined", max_amount_aed: null });
  }, 60_000);

  // ── The pre-approval ────────────────────────────────────────

  it("pre-approves on a valid lead offer: the clock stops, the others are withdrawn, the applicant gets the letter", async () => {
    const { row, banks, subs } = await withBanks(2);
    const mem = memoryStorage();
    const lead = await letter(owner, subs[0]!.id, mem, "lead-letter.pdf");
    expect((await record(owner, subs[0]!.id, { letter: lead.id })).error).toBeNull();

    const fresh = await read(row.id);
    expect((await preApprove(owner, fresh, subs[0]!.id)).error).toBeNull();

    const after = await read(row.id);
    expect(after).toMatchObject({
      status: "pre_approved",
      decision: "pre_approved",
      decision_message: MESSAGE,
      decided_by: owner.id,
      lead_bank_submission_id: subs[0]!.id,
    });
    expect(after.sla_stopped_at).not.toBeNull();
    expect(slaStatus(after, new Date(), policy)).toMatchObject({ state: "met", stopped: true });
    expect((await submission(subs[1]!.id)).status).toBe("withdrawn");
    expect((await events(row.id)).find((e) => e.type === "decision.pre_approved")).toMatchObject({
      actor_id: owner.id,
      data: { lead: banks[0]!.code, amount: 2150000, channels: ["email", "whatsapp"], banks_withdrawn: 1 },
    });

    const sent: SendEmailInput[] = [];
    await deliverNotifications(
      {
        db: service,
        storage: mem.storage,
        send: async (input): Promise<SendEmailResult> => {
          sent.push(input);
          return { status: "ok", id: "test" };
        },
        staffEmail: async () => "adviser@example.com",
      },
      { requestId: row.id },
    );
    const { data: request } = await service.from("mortgage_requests").select("email").eq("id", row.id).single();
    const email = sent.find((s) => s.attachments?.length);
    expect(email).toBeDefined();
    expect(email!.to).toBe((request as { email: string }).email);
    expect(email!.replyTo).toBe("adviser@example.com");
    expect(email!.text).toContain("you're pre-approved");
    expect(email!.attachments).toEqual([
      { filename: "lead-letter.pdf", content: mem.objects.get(lead.storage_key), contentType: "application/pdf" },
    ]);
    const { data: outbox } = await service
      .from("mortgage_notifications")
      .select("channel, status")
      .eq("request_id", row.id)
      .eq("kind", "decision_pre_approved")
      .order("channel");
    expect(outbox).toEqual([
      { channel: "email", status: "sent" },
      { channel: "whatsapp", status: "skipped" },
    ]);
  }, 60_000);

  it("won't pre-approve on an offer that isn't there or has expired, nor for someone else, nor twice", async () => {
    const { row, subs } = await withBanks(2);
    const mem = memoryStorage();
    const lead = await letter(owner, subs[0]!.id, mem);
    expect((await record(owner, subs[0]!.id, { letter: lead.id })).error).toBeNull();
    const fresh = await read(row.id);

    expect((await preApprove(owner, fresh, subs[1]!.id)).error?.message).toContain("lead_not_pre_approved");
    expect((await preApprove(owner, fresh, subs[0]!.id, { message: "\n \t\n" })).error?.code).toBe("MR422");
    expect((await preApprove(owner, fresh, subs[0]!.id, { channels: ["whatsapp"] })).error?.code).toBe("MR422");
    expect((await preApprove(other, fresh, subs[0]!.id)).error?.code).toBe("MR403");
    expect((await preApprove(admin, fresh, subs[0]!.id)).error?.code).toBe("MR403");
    expect((await preApprove(owner, fresh, subs[0]!.id, { expected: "2020-01-01T00:00:00Z" })).error?.code).toBe("MR409");

    await service.from("mortgage_bank_submissions").update({ valid_until: inDays(-2) }).eq("id", subs[0]!.id);
    expect((await preApprove(owner, fresh, subs[0]!.id)).error?.message).toContain("offer_expired");
    await service.from("mortgage_bank_submissions").update({ valid_until: inDays(30) }).eq("id", subs[0]!.id);

    expect((await preApprove(head, fresh, subs[0]!.id)).error).toBeNull();
    expect((await preApprove(head, await read(row.id), subs[0]!.id)).error?.code).toBe("MR409");
    expect((await read(row.id)).decided_by).toBe(head.id);
  }, 60_000);

  it("won't pre-approve once consent is withdrawn", async () => {
    const { row, subs } = await withBanks(1);
    const lead = await letter(owner, subs[0]!.id, memoryStorage());
    expect((await record(owner, subs[0]!.id, { letter: lead.id })).error).toBeNull();
    await service.from("mortgage_consents").update({ withdrawn_at: new Date().toISOString() }).eq("request_id", row.id);
    const refused = await preApprove(owner, await read(row.id), subs[0]!.id);
    expect(refused.error?.message).toContain("no_consent");
    expect((await read(row.id)).status).toBe("with_banks");
  }, 60_000);

  // ── Consent withdrawn (SECURITY-REVIEW SR-17, SR-22) ─────────

  function withdraw(as: TestStaff, row: Row, expected: string | null = row.updated_at) {
    return as.client.rpc("mortgage_withdraw_consent", { p_request_id: row.id, p_expected_updated_at: expected ?? undefined });
  }

  it("records a withdrawal of consent: banks still deciding withdrawn, every link stopped, the reminder refused", async () => {
    const { row, subs, tokens } = await withBanks(2);
    expect((await withdraw(other, row)).error?.code).toBe("MR403");
    expect((await withdraw(admin, row)).error?.code).toBe("MR403");
    expect((await withdraw(owner, row, "2020-01-01T00:00:00Z")).error?.code).toBe("MR409");

    const before = Date.now();
    const { data, error } = await withdraw(owner, row);
    expect(error).toBeNull();
    const after = data as Row;
    expect(after.status).toBe("with_banks");
    expect(after.updated_at).not.toBe(row.updated_at);

    const { data: consent } = await service.from("mortgage_consents").select("withdrawn_at").eq("request_id", row.id).single();
    expect(new Date((consent as { withdrawn_at: string }).withdrawn_at).getTime()).toBeGreaterThanOrEqual(before - 5_000);
    for (const s of await submissions(row.id)) {
      expect(s.status).toBe("withdrawn");
      expect(new Date(s.package_expires_at!).getTime()).toBeLessThanOrEqual(Date.now());
    }
    expect((await events(row.id)).find((e) => e.type === "consent.withdrawn")).toMatchObject({
      actor_kind: "staff",
      actor_id: owner.id,
      data: { banks_withdrawn: 2, links_stopped: 2 },
    });

    // The links show nothing, and nothing new can go to a bank.
    for (const token of tokens) expect(packageState(await findPackage(service, token), new Date())).toBe("unavailable");
    const [link] = packageLinks([subs[0]!.bank_id], new Date(), days).links;
    const reminder = await owner.client.rpc("mortgage_bank_reminder", {
      p_submission_id: subs[0]!.id,
      p_token_hash: hashToken(link!.token),
      p_expires_at: link!.expiresAt,
    });
    expect(reminder.error?.code).toBe("MR422");
    expect(reminder.error?.message).toContain("no_consent");

    // Once is enough: there's nothing left to withdraw.
    expect((await withdraw(head, after)).error?.code).toBe("MR409");
  }, 60_000);

  it("closes the package, and its downloads, when consent is gone however it went", async () => {
    const { row, tokens } = await withBanks(1);
    const { data: docs } = await service.from("mortgage_documents").select("id, kind").eq("request_id", row.id).limit(1);
    const doc = (docs as { id: string; kind: string }[])[0]!;
    const file = {
      id: randomUUID(),
      document_id: doc.id,
      kind: doc.kind,
      state: "active",
      storage_key: `f/${randomUUID()}`,
      original_name: `${doc.kind}.pdf`,
      mime: "application/pdf",
      size_bytes: 1000,
      scan_status: "clean",
    };
    expect((await service.from("mortgage_files").insert(file)).error).toBeNull();
    const mem = memoryStorage();
    mem.objects.set(file.storage_key, buildPdf());
    expect(packageState(await findPackage(service, tokens[0]!), new Date())).toBe("open");

    // Withdrawn straight in the table (as the runbook once did): the link is still live, the consent isn't.
    await service.from("mortgage_consents").update({ withdrawn_at: new Date().toISOString() }).eq("request_id", row.id);
    const found = await findPackage(service, tokens[0]!);
    expect(found?.consented).toBe(false);
    expect(packageState(found, new Date())).toBe("unavailable");
    await expect(openPackageFile({ db: service, storage: mem.storage }, tokens[0]!, file.id)).rejects.toMatchObject({ status: 404 });
    expect(mem.reads).toEqual([]);
  }, 60_000);

  // ── The banks ───────────────────────────────────────────────

  it("the Head or an admin keeps the list of banks; an adviser can't", async () => {
    const save = (as: TestStaff, over: Partial<{ id: string | null; code: string; color: string | null; active: boolean; inboxes: string[] }> = {}) =>
      as.client.rpc("mortgage_save_bank", {
        p_id: (over.id ?? null) as string,
        p_code: over.code ?? code().toLowerCase(),
        p_name: "Emirates Test Bank",
        p_brand_color: (over.color === undefined ? "#1f4e79" : over.color) as string,
        p_active: over.active ?? true,
        p_package_emails: over.inboxes ?? ["  Packages@Bank.example.com ", "packages@bank.example.com", ""],
        p_sort_order: 9,
      });

    const { data, error } = await save(head);
    expect(error).toBeNull();
    const saved = data as { id: string; code: string; package_emails: string[] };
    made.push(saved.id);
    expect(saved.code).toMatch(/^T[0-9A-F]{7}$/);
    expect(saved.package_emails).toEqual(["packages@bank.example.com"]);

    expect((await save(admin, { id: saved.id, code: saved.code, active: false })).error).toBeNull();
    expect((await save(owner)).error?.code).toBe("MR403");
    expect((await save(head, { code: saved.code })).error?.code).toBe("MR409");
    expect((await save(head, { inboxes: [] })).error?.code).toBe("MR422");
    expect((await save(head, { inboxes: ["not an address"] })).error?.code).toBe("MR422");
    expect((await save(head, { color: "red" })).error?.code).toBe("MR422");
    const oklch = await save(head, { color: "oklch(0.45 0.08 320)" });
    expect(oklch.error).toBeNull();
    made.push((oklch.data as { id: string }).id);
  }, 60_000);

  it("names a bank as the database does", () => {
    for (const name of ["Mashreq", "First Abu Dhabi Bank", "  Emirates NBD  "]) {
      const fromDb = psql(
        `select public.mortgage_bank_label(json_populate_record(null::public.mortgage_partner_banks, json_build_object('code', 'CODE', 'name', '${name}')))`,
      ).trim();
      expect(bankLabel({ code: "CODE", name })).toBe(fromDb);
    }
  });
});

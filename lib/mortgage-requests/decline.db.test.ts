/**
 * @vitest-environment node
 */

/**
 * Declining a Fast Pre-Approval (decision D19, migration 0147), against the
 * local Supabase stack (`npm run db:local:reset && npm run test:db`):
 *
 *   · from New, In review, Awaiting applicant and With banks, by the owner or
 *     the Head; never a consultancy, never twice, never on a stale page;
 *   · the clock stops (met or breached); stopped while paused, it keeps
 *     the working time left at the pause;
 *   · an open re-upload is cancelled and its link stops working; banks still
 *     considering the file are withdrawn;
 *   · the reason and the message are kept, and only the function writes them;
 *   · the applicant is emailed the adviser's message from the outbox, with
 *     replies going to whoever decided; WhatsApp is recorded as due (D1).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendEmailInput, SendEmailResult } from "@/lib/email";
import { DECLINE_REASONS, declineMessage } from "./decline";
import { clockDueFrom, clockPause, slaStatus, type SlaFields, type SlaPolicy } from "./sla";
import { deliverNotifications } from "./server/notify";
import { loadMortgageSettings } from "./server/settings";
import { hashToken, newToken } from "./server/tokens";
import { client, createTestStaff, localStack, psql, retireTestStaff, type LocalStack, type TestStaff } from "./testing/local-stack";

const stack = localStack();
if (!stack) console.warn("mortgage decline tests skipped: start the local stack with `npm run db:local:reset`");

type Row = SlaFields & {
  id: string;
  reference: string;
  status: string;
  updated_at: string;
  decision: string | null;
  decline_reason: string | null;
  decision_message: string | null;
  decided_by: string | null;
  sla_paused_seconds: number;
};

const MESSAGE = declineMessage("debt_burden", { applicantFirstName: "Test", adviserFirstName: "Yasmin" });

describe.skipIf(!stack)("declining a Fast Pre-Approval (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let policy: SlaPolicy;
  let head: TestStaff;
  let owner: TestStaff;
  let other: TestStaff;
  let admin: TestStaff;
  let bankId: string;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    policy = (await loadMortgageSettings(service)).policy;
    [head, owner, other, admin] = await Promise.all([
      createTestStaff(local, service, "support", "head"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "admin", null),
    ]);
    const { data: bank, error } = await service
      .from("mortgage_partner_banks")
      .insert({ code: `D${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`, name: "Decline Test Bank" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    bankId = (bank as { id: string }).id;
  }, 60_000);

  // Its submissions keep the bank: switch it off, so the local list the CMS offers stays the seeded three.
  afterAll(async () => {
    if (bankId) await service.from("mortgage_partner_banks").update({ active: false }).eq("id", bankId);
    await retireTestStaff(service);
  });

  // ── Helpers ─────────────────────────────────────────────────

  async function create(kind: "pre_approval" | "consultancy" = "pre_approval"): Promise<Row> {
    const at = new Date();
    const { data, error } = await service.rpc("mortgage_create_request", {
      p_service: kind,
      p_full_name: "Test Applicant",
      p_date_of_birth: "1990-01-01",
      p_mobile_e164: `+97150${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
      p_email: `applicant-${randomUUID().slice(0, 8)}@example.com`,
      p_residency: "uae_resident_expat",
      p_employment_type: "salaried",
      p_entry_point: "direct",
      p_at: at.toISOString(),
      ...(kind === "pre_approval"
        ? { p_consent_version: "v0.1", p_consent_text: "Consent.", p_sla_due_at: clockDueFrom(at, policy) }
        : {}),
    });
    if (error) throw new Error(`create failed: ${error.code} ${error.message}`);
    const row = data as Row;
    await service.from("mortgage_requests").update({ owner_staff_id: owner.id }).eq("id", row.id);
    return read(row.id);
  }

  async function read(id: string): Promise<Row> {
    const { data, error } = await service.from("mortgage_requests").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data as Row;
  }

  async function move(row: Row, event: string, actor: "system" | "staff") {
    const { error } = await service.rpc("mortgage_transition", {
      p_request_id: row.id,
      p_event: event,
      p_actor_kind: actor,
      p_sla: {},
      p_data: {},
    });
    if (error) throw new Error(`${event} failed: ${error.code} ${error.message}`);
    return read(row.id);
  }

  function decline(
    as: TestStaff,
    row: Row,
    opts: { reason?: string; message?: string; channels?: string[]; expected?: string | null } = {},
  ) {
    return as.client.rpc("mortgage_decline", {
      p_request_id: row.id,
      p_reason: opts.reason ?? "debt_burden",
      p_message: opts.message ?? `  ${MESSAGE}  `,
      p_channels: opts.channels ?? ["email", "whatsapp"],
      p_expected_updated_at: opts.expected === undefined ? row.updated_at : opts.expected,
    });
  }

  async function events(id: string) {
    const { data } = await service.from("mortgage_events").select("type, actor_id, data").eq("request_id", id).order("created_at");
    return (data ?? []) as { type: string; actor_id: string | null; data: Record<string, unknown> }[];
  }

  // ── The decline ─────────────────────────────────────────────

  it("from In review: the decision is kept, the clock stops, the applicant hears from the outbox", async () => {
    const row = await move(await create(), "first_document_opened", "system");
    const { error } = await decline(owner, row);
    expect(error).toBeNull();

    const after = await read(row.id);
    expect(after).toMatchObject({
      status: "declined",
      decision: "declined",
      decline_reason: "debt_burden",
      decision_message: MESSAGE,
      decided_by: owner.id,
    });
    expect(after.sla_stopped_at).not.toBeNull();
    expect(slaStatus(after, new Date(), policy)).toMatchObject({ state: "met", stopped: true });

    const log = await events(row.id);
    expect(log.filter((e) => e.type === "status.changed").at(-1)?.data).toMatchObject({ from: "in_review", to: "declined", event: "declined" });
    expect(log.find((e) => e.type === "decision.declined")).toMatchObject({
      actor_id: owner.id,
      data: { reason: "debt_burden", channels: ["email", "whatsapp"], reuploads_cancelled: 0, banks_withdrawn: 0 },
    });

    // The email: the adviser's words, to the applicant, replies to the adviser; WhatsApp recorded as due.
    const sent: SendEmailInput[] = [];
    await deliverNotifications(
      {
        db: service,
        send: async (input): Promise<SendEmailResult> => {
          sent.push(input);
          return { status: "ok", id: "test" };
        },
        staffEmail: async () => "adviser@example.com",
      },
      { requestId: row.id },
    );
    const { data: request } = await service.from("mortgage_requests").select("email").eq("id", row.id).single();
    // The same run delivers the submission's own confirmation: find the decline by its words.
    const email = sent.find((s) => s.text?.includes("UAE Central Bank rules cap your total monthly repayments"));
    expect(email).toBeDefined();
    expect(email!.to).toBe((request as { email: string }).email);
    expect(email!.replyTo).toBe("adviser@example.com");
    expect(email!.subject.toLowerCase()).not.toContain("declin");
    const { data: outbox } = await service
      .from("mortgage_notifications")
      .select("channel, status")
      .eq("request_id", row.id)
      .eq("kind", "decision_declined")
      .order("channel");
    expect(outbox).toEqual([
      { channel: "email", status: "sent" },
      { channel: "whatsapp", status: "skipped" },
    ]);
  }, 60_000);

  it("from New, straight away", async () => {
    const row = await create();
    expect((await decline(owner, row, { reason: "income_below_minimum", channels: ["email"] })).error).toBeNull();
    expect(await read(row.id)).toMatchObject({ status: "declined", decline_reason: "income_below_minimum" });
  }, 60_000);

  it("while a re-upload is out: it's cancelled, its link stops, and the clock stops with the time left at the pause", async () => {
    const opened = await move(await create(), "first_document_opened", "system");
    const { data: doc } = await service.from("mortgage_documents").select("id").eq("request_id", opened.id).limit(1).single();
    const token = newToken();
    const { error: askError } = await owner.client.rpc("mortgage_request_reupload", {
      p_document_id: (doc as { id: string }).id,
      p_reason: "unreadable",
      p_message: "Please send a clearer copy.",
      p_channels: ["email"],
      p_token_hash: hashToken(token),
      p_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      p_sla: clockPause(opened, new Date(), policy),
      p_expected_updated_at: opened.updated_at,
    });
    expect(askError).toBeNull();
    const paused = await read(opened.id);
    expect(paused.status).toBe("awaiting_applicant");
    const frozen = paused.sla_remaining_seconds!;

    expect((await decline(head, paused, { reason: "documents_incomplete" })).error).toBeNull();
    const after = await read(opened.id);
    expect(after).toMatchObject({ status: "declined", sla_remaining_seconds: frozen });
    expect(after.sla_stopped_at).not.toBeNull();
    expect(slaStatus(after, new Date(), policy)).toMatchObject({ state: "met", remainingSeconds: frozen });

    const { data: reupload } = await service.from("mortgage_reupload_requests").select("cancelled_at, access_link_id").eq("request_id", opened.id).single();
    expect((reupload as { cancelled_at: string | null }).cancelled_at).not.toBeNull();
    const { data: link } = await service
      .from("mortgage_access_links")
      .select("revoked_at")
      .eq("id", (reupload as { access_link_id: string }).access_link_id)
      .single();
    expect((link as { revoked_at: string | null }).revoked_at).not.toBeNull();
    const { data: docAfter } = await service.from("mortgage_documents").select("state").eq("id", (doc as { id: string }).id).single();
    expect((docAfter as { state: string }).state).toBe("to_review");
    expect((await events(opened.id)).find((e) => e.type === "decision.declined")?.data).toMatchObject({ reuploads_cancelled: 1 });
  }, 60_000);

  it("with the banks: 'no bank made an offer', and the banks still deciding are withdrawn", async () => {
    let row = await move(await create(), "first_document_opened", "system");
    await service.from("mortgage_documents").update({ state: "accepted" }).eq("request_id", row.id);
    await service.from("mortgage_bank_submissions").insert({ request_id: row.id, bank_id: bankId });
    row = await move(row, "sent_to_banks", "staff");
    expect(row.status).toBe("with_banks");

    expect((await decline(owner, row, { reason: "no_bank_offer" })).error).toBeNull();
    const { data: sub } = await service.from("mortgage_bank_submissions").select("status").eq("request_id", row.id).single();
    expect((sub as { status: string }).status).toBe("withdrawn");
    expect((await events(row.id)).find((e) => e.type === "decision.declined")?.data).toMatchObject({ banks_withdrawn: 1 });
  }, 60_000);

  // ── What it refuses ─────────────────────────────────────────

  it("only the owner or the Head, only a Fast Pre-Approval, only once, only on a fresh page", async () => {
    const row = await move(await create(), "first_document_opened", "system");
    expect((await decline(other, row)).error?.code).toBe("MR403");
    expect((await decline(admin, row)).error?.code).toBe("MR403");

    const consultancy = await create("consultancy");
    expect((await decline(owner, consultancy)).error?.code).toBe("MR422");

    await service.from("mortgage_requests").update({ full_name: "Changed Meanwhile" }).eq("id", row.id);
    expect((await decline(owner, row)).error?.code).toBe("MR409");

    const fresh = await read(row.id);
    expect((await decline(owner, fresh)).error).toBeNull();
    expect((await decline(owner, await read(row.id))).error?.code).toBe("MR409");
  }, 60_000);

  it("needs a reason, a message, email, and the banks before 'no bank made an offer'", async () => {
    const row = await move(await create(), "first_document_opened", "system");
    expect((await decline(owner, row, { message: "   " })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { message: "\n\n \t\n" })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { channels: ["whatsapp"] })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { channels: ["email", "sms"] })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { reason: "no_bank_offer" })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { reason: "bad_luck" })).error).not.toBeNull();
    expect((await read(row.id)).status).toBe("in_review");
  }, 60_000);

  it("keeps the reason and the message to the function", async () => {
    const row = await create();
    expect((await decline(owner, row)).error).toBeNull();
    const { error: reasonError } = await service.from("mortgage_requests").update({ decline_reason: "other" }).eq("id", row.id);
    expect(reasonError?.code).toBe("MR403");
    const { error: messageError } = await service.from("mortgage_requests").update({ decision_message: "Edited later." }).eq("id", row.id);
    expect(messageError?.code).toBe("MR403");
  }, 60_000);

  it("offers the reasons decline.ts knows", () => {
    const values = psql("select array_to_string(enum_range(null::public.mortgage_decline_reason), ',')").trim().split(",");
    expect(values).toEqual([...DECLINE_REASONS]);
  });
});

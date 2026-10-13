/**
 * @vitest-environment node
 */

/**
 * The outcome of a Fast Pre-Approval — the team's answer is a stage move
 * (0158), and the decline (decision D19, 0147, redefined in 0156 and 0158) —
 * against the local Supabase stack (`npm run db:local:reset && npm run test:db`):
 *
 *   · moving onto Accepted (a stage that stops the clock) stops the clock and
 *     leaves the file open; onto Pre-Approved it stays open, the clock kept at
 *     the acceptance; neither emails anyone;
 *   · the decline: from any stage of an open file, by the owner or the Head;
 *     never a consultancy, never twice, never on a stale page; "no bank made
 *     an offer" only once the clock has stopped (the team has answered);
 *     declined again after a reopening, it emails again;
 *   · the clock stops (met or breached); stopped while paused, it keeps
 *     the working time left at the pause;
 *   · an open re-upload is cancelled and its link stops working;
 *   · the reason and the message are kept, and only the function writes them;
 *   · the applicant is emailed the adviser's message from the outbox, with
 *     replies going to whoever decided; WhatsApp is recorded as due (D1);
 *   · a withdrawal of consent (0152, 0156) is recorded once, by the owner or
 *     the Head, and leaves the status and the stage alone.
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
  stage_id: string | null;
  updated_at: string;
  decision: string | null;
  decline_reason: string | null;
  decision_message: string | null;
  decided_by: string | null;
  closed_at: string | null;
  sla_paused_seconds: number;
};

const MESSAGE = declineMessage("debt_burden", { applicantFirstName: "Test", adviserFirstName: "Yasmin" });

describe.skipIf(!stack)("answering and declining a Fast Pre-Approval (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let policy: SlaPolicy;
  let head: TestStaff;
  let owner: TestStaff;
  let other: TestStaff;
  let admin: TestStaff;
  /** The seeded stages' ids, by name (0158). */
  const stage: Record<string, string> = {};

  beforeAll(async () => {
    const { data: stages } = await client(local, local.serviceRoleKey).from("mortgage_stages").select("id, name");
    for (const s of (stages ?? []) as { id: string; name: string }[]) stage[s.name] = s.id;
    service = client(local, local.serviceRoleKey);
    policy = (await loadMortgageSettings(service)).policy;
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

  /** Onto a stage, by `as` (the owner unless told otherwise). */
  function moveStage(row: Row, name: string, as: TestStaff = owner, expected: string | null = null) {
    return as.client.rpc("mortgage_move_stage", { p_request_id: row.id, p_stage_id: stage[name], p_expected_updated_at: expected });
  }

  async function onStage(row: Row, name: string): Promise<Row> {
    const { error } = await moveStage(row, name);
    if (error) throw new Error(`move to ${name} failed: ${error.code} ${error.message}`);
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
    const { data } = await service
      .from("mortgage_events")
      .select("type, actor_kind, actor_id, data")
      .eq("request_id", id)
      .order("created_at");
    return (data ?? []) as { type: string; actor_kind: string; actor_id: string | null; data: Record<string, unknown> }[];
  }

  /** In review, with every document accepted. */
  async function inReview(): Promise<Row> {
    const row = await onStage(await create(), "In Review");
    await service.from("mortgage_documents").update({ state: "accepted" }).eq("request_id", row.id);
    return read(row.id);
  }

  /** Accepted by its owner: the team has answered, so the clock has stopped. */
  async function accepted(): Promise<Row> {
    return onStage(await inReview(), "Accepted");
  }

  async function outbox(id: string) {
    const { data } = await service.from("mortgage_notifications").select("kind, channel").eq("request_id", id).order("kind");
    return (data ?? []) as { kind: string; channel: string }[];
  }

  // ── The team's answer: a stage move ─────────────────────────

  it("moving onto Accepted stops the clock, leaves the file open and tells nobody", async () => {
    const row = await inReview();
    const before = await outbox(row.id);
    const after = await onStage(row, "Accepted");
    expect(after).toMatchObject({ status: "open", stage_id: stage["Accepted"], decision: null, decided_by: null, closed_at: null });
    expect(after.sla_stopped_at).not.toBeNull();
    expect(after.sla_due_at).toBe(row.sla_due_at);
    expect(slaStatus(after, new Date(Date.now() + 30 * 86_400_000), policy)).toMatchObject({ state: "met", stopped: true });

    const log = await events(row.id);
    expect(log.filter((e) => e.type === "stage.changed").at(-1)).toMatchObject({
      actor_kind: "staff",
      actor_id: owner.id,
      data: { from: "In Review", to: "Accepted", reopened: false },
    });
    expect(log.map((e) => e.type)).not.toContain("status.changed");
    // The team shares the file with the banks itself.
    expect(await outbox(row.id)).toEqual(before);
  }, 60_000);

  it("Pre-Approved keeps the file open, the clock stopped at the acceptance, and emails nobody", async () => {
    const row = await accepted();
    const before = await outbox(row.id);
    const after = await onStage(row, "Pre-Approved");
    expect(after).toMatchObject({ status: "open", stage_id: stage["Pre-Approved"], decision: null, decision_message: null, closed_at: null });
    expect(after.sla_stopped_at).toBe(row.sla_stopped_at);
    expect(await outbox(row.id)).toEqual(before);
  }, 60_000);

  // ── Consent withdrawn (SECURITY-REVIEW SR-17) ───────────────

  function withdraw(as: TestStaff, row: Row, expected: string | null = row.updated_at) {
    return as.client.rpc("mortgage_withdraw_consent", { p_request_id: row.id, p_expected_updated_at: expected ?? undefined });
  }

  it("records a withdrawal of consent once, by the owner or the Head, and leaves the status alone", async () => {
    const row = await accepted();
    expect((await withdraw(other, row)).error?.code).toBe("MR403");
    expect((await withdraw(admin, row)).error?.code).toBe("MR403");
    expect((await withdraw(owner, row, "2020-01-01T00:00:00Z")).error?.code).toBe("MR409");

    const before = Date.now();
    const { data, error } = await withdraw(owner, row);
    expect(error).toBeNull();
    const after = data as Row;
    expect(after).toMatchObject({ status: "open", stage_id: stage["Accepted"] });
    expect(after.updated_at).not.toBe(row.updated_at);
    const { data: consent } = await service.from("mortgage_consents").select("withdrawn_at").eq("request_id", row.id).single();
    expect(new Date((consent as { withdrawn_at: string }).withdrawn_at).getTime()).toBeGreaterThanOrEqual(before - 5_000);
    expect((await events(row.id)).find((e) => e.type === "consent.withdrawn")).toMatchObject({
      actor_kind: "staff",
      actor_id: owner.id,
      data: {},
    });

    // Once is enough: there's nothing left to withdraw.
    expect((await withdraw(head, after)).error?.code).toBe("MR409");
  }, 60_000);

  // ── The decline ─────────────────────────────────────────────

  it("from In review: the decision is kept, the clock stops, the applicant hears from the outbox", async () => {
    const row = await onStage(await create(), "In Review");
    const { error } = await decline(owner, row);
    expect(error).toBeNull();

    const after = await read(row.id);
    expect(after).toMatchObject({
      status: "declined",
      decision: "declined",
      decline_reason: "debt_burden",
      decision_message: MESSAGE,
      decided_by: owner.id,
      stage_id: stage["In Review"],
    });
    expect(after.sla_stopped_at).not.toBeNull();
    expect(after.closed_at).not.toBeNull();
    expect(slaStatus(after, new Date(), policy)).toMatchObject({ state: "met", stopped: true });

    const log = await events(row.id);
    expect(log.filter((e) => e.type === "status.changed").at(-1)?.data).toMatchObject({ from: "open", to: "declined", event: "declined" });
    expect(log.find((e) => e.type === "decision.declined")).toMatchObject({
      actor_id: owner.id,
      data: { reason: "debt_burden", channels: ["email", "whatsapp"], reuploads_cancelled: 0, stage: "In Review" },
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
    expect(await read(row.id)).toMatchObject({ status: "declined", decline_reason: "income_below_minimum", stage_id: stage["New"] });
  }, 60_000);

  it("from a later stage, and with 'no bank made an offer' there too", async () => {
    const valuation = await onStage(await accepted(), "Valuation");
    expect((await decline(owner, valuation, { reason: "no_bank_offer" })).error).toBeNull();
    expect(await read(valuation.id)).toMatchObject({ status: "declined", decline_reason: "no_bank_offer", stage_id: stage["Valuation"] });
    expect((await events(valuation.id)).find((e) => e.type === "decision.declined")?.data).toMatchObject({ stage: "Valuation" });

    // Even from a closing stage, while the file is open.
    const disbursed = await onStage(await accepted(), "Disbursed");
    expect((await decline(head, disbursed, { reason: "other" })).error).toBeNull();
    expect((await read(disbursed.id)).status).toBe("declined");
  }, 60_000);

  it("declines again after a reopening, and emails again", async () => {
    const row = await inReview();
    expect((await decline(owner, row, { channels: ["email"] })).error).toBeNull();
    const reopened = await onStage(await read(row.id), "In Review");
    expect(reopened).toMatchObject({ status: "open", decision: null, decline_reason: null });
    expect((await decline(owner, reopened, { reason: "other", channels: ["email"] })).error).toBeNull();
    expect(await read(row.id)).toMatchObject({ status: "declined", decline_reason: "other" });
    const { data: emails } = await service
      .from("mortgage_notifications")
      .select("id")
      .eq("request_id", row.id)
      .eq("kind", "decision_declined")
      .eq("channel", "email");
    expect(emails).toHaveLength(2);
  }, 60_000);

  it("while a re-upload is out: it's cancelled, its link stops, and the clock stops with the time left at the pause", async () => {
    const opened = await onStage(await create(), "In Review");
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
    expect(paused).toMatchObject({ status: "open", stage_id: stage["In Review"], sla_due_at: null });
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

  it("once accepted: 'no bank made an offer', and the clock stays stopped at the acceptance", async () => {
    const row = await accepted();
    expect(row).toMatchObject({ status: "open", stage_id: stage["Accepted"] });

    expect((await decline(owner, row, { reason: "no_bank_offer" })).error).toBeNull();
    const after = await read(row.id);
    expect(after).toMatchObject({ status: "declined", decision: "declined", decline_reason: "no_bank_offer", decided_by: owner.id });
    expect(after.sla_stopped_at).toBe(row.sla_stopped_at);
    expect(after.closed_at).not.toBeNull();
    expect((await events(row.id)).find((e) => e.type === "decision.declined")?.data).toEqual({
      reason: "no_bank_offer",
      channels: ["email", "whatsapp"],
      reuploads_cancelled: 0,
      stage: "Accepted",
    });
  }, 60_000);

  // ── What it refuses ─────────────────────────────────────────

  it("only the owner or the Head, only a Fast Pre-Approval, only once, only on a fresh page", async () => {
    const row = await onStage(await create(), "In Review");
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

  it("needs a reason, a message, email, and an answered file before 'no bank made an offer'", async () => {
    const row = await onStage(await create(), "In Review");
    expect((await decline(owner, row, { message: "   " })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { message: "\n\n \t\n" })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { channels: ["whatsapp"] })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { channels: ["email", "sms"] })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { reason: "no_bank_offer" })).error?.code).toBe("MR422");
    expect((await decline(owner, row, { reason: "bad_luck" })).error).not.toBeNull();
    expect(await read(row.id)).toMatchObject({ status: "open", decision: null });

    // A stage that doesn't answer the applicant isn't enough, wherever it sits.
    await service.from("mortgage_documents").update({ state: "accepted" }).eq("request_id", row.id);
    const back = await onStage(await onStage(row, "New"), "In Review");
    expect(back.sla_stopped_at).toBeNull();
    expect((await decline(owner, back, { reason: "no_bank_offer" })).error?.code).toBe("MR422");
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

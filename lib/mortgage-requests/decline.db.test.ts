/**
 * @vitest-environment node
 */

/**
 * The outcome of a Fast Pre-Approval — accepting it, recording a
 * pre-approval (0156) and declining it (decision D19, 0147, redefined in
 * 0156) — against the local Supabase stack
 * (`npm run db:local:reset && npm run test:db`):
 *
 *   · Accept application: only an in-review file with every document accepted
 *     and consent on file, by the owner or the Head; the clock stops, the file
 *     stays open;
 *   · the pre-approval: only from Accepted, by the owner or the Head; it closes
 *     the file, keeps the clock stopped at the acceptance, and emails nobody;
 *   · the decline: from New, In review, Awaiting applicant and Accepted, by the
 *     owner or the Head; never a consultancy, never twice, never on a stale
 *     page; "no bank made an offer" only once accepted;
 *   · the clock stops (met or breached); stopped while paused, it keeps
 *     the working time left at the pause;
 *   · an open re-upload is cancelled and its link stops working;
 *   · the reason and the message are kept, and only the function writes them;
 *   · the applicant is emailed the adviser's message from the outbox, with
 *     replies going to whoever decided; WhatsApp is recorded as due (D1);
 *   · a withdrawal of consent (0152, 0156) is recorded once, by the owner or
 *     the Head, and leaves the status alone.
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
  closed_at: string | null;
  sla_paused_seconds: number;
};

const MESSAGE = declineMessage("debt_burden", { applicantFirstName: "Test", adviserFirstName: "Yasmin" });

describe.skipIf(!stack)("accepting, pre-approving and declining a Fast Pre-Approval (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let policy: SlaPolicy;
  let head: TestStaff;
  let owner: TestStaff;
  let other: TestStaff;
  let admin: TestStaff;

  beforeAll(async () => {
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
    const { data } = await service
      .from("mortgage_events")
      .select("type, actor_kind, actor_id, data")
      .eq("request_id", id)
      .order("created_at");
    return (data ?? []) as { type: string; actor_kind: string; actor_id: string | null; data: Record<string, unknown> }[];
  }

  /** In review, opened by the system, with every document accepted unless told otherwise. */
  async function inReview(opts: { accepted?: boolean } = {}): Promise<Row> {
    const row = await move(await create(), "first_document_opened", "system");
    if (opts.accepted ?? true) await service.from("mortgage_documents").update({ state: "accepted" }).eq("request_id", row.id);
    return read(row.id);
  }

  function accept(as: TestStaff, row: Row, expected: string | null = row.updated_at) {
    return as.client.rpc("mortgage_accept_application", {
      p_request_id: row.id,
      p_expected_updated_at: expected ?? undefined,
    });
  }

  function recordPreApproval(as: TestStaff, row: Row, opts: { note?: string | null; expected?: string | null } = {}) {
    return as.client.rpc("mortgage_record_pre_approval", {
      p_request_id: row.id,
      p_note: opts.note === undefined ? "  FAB pre-approved AED 2,150,000.  " : (opts.note ?? undefined),
      p_expected_updated_at: opts.expected === undefined ? row.updated_at : (opts.expected ?? undefined),
    });
  }

  /** Accepted by its owner. */
  async function accepted(): Promise<Row> {
    const row = await inReview();
    const { error } = await accept(owner, row);
    if (error) throw new Error(`accept failed: ${error.code} ${error.message}`);
    return read(row.id);
  }

  async function outbox(id: string) {
    const { data } = await service.from("mortgage_notifications").select("kind, channel").eq("request_id", id).order("kind");
    return (data ?? []) as { kind: string; channel: string }[];
  }

  // ── Accept application ──────────────────────────────────────

  it("accepts a reviewed file: the clock stops, the file stays open, the log says who", async () => {
    const row = await inReview();
    const before = await outbox(row.id);
    const { data, error } = await accept(owner, row);
    expect(error).toBeNull();
    expect((data as Row).status).toBe("accepted");

    const after = await read(row.id);
    expect(after).toMatchObject({ status: "accepted", decision: null, decided_by: null, closed_at: null });
    expect(after.sla_stopped_at).not.toBeNull();
    expect(after.sla_due_at).toBe(row.sla_due_at);
    expect(slaStatus(after, new Date(Date.now() + 30 * 86_400_000), policy)).toMatchObject({ state: "met", stopped: true });

    const log = await events(row.id);
    expect(log.filter((e) => e.type === "status.changed").at(-1)).toMatchObject({
      actor_kind: "staff",
      actor_id: owner.id,
      data: { from: "in_review", to: "accepted", event: "application_accepted" },
    });
    expect(log.find((e) => e.type === "application.accepted")).toMatchObject({ actor_kind: "staff", actor_id: owner.id });
    // Accepting tells nobody: the team shares the file with the banks itself.
    expect(await outbox(row.id)).toEqual(before);
  }, 60_000);

  it("won't accept before every document is accepted, without consent, for someone else, twice, or on a stale page", async () => {
    const notAccepted = await inReview({ accepted: false });
    expect((await accept(owner, notAccepted)).error?.code).toBe("MR422");

    const noConsent = await inReview();
    await service.from("mortgage_consents").update({ withdrawn_at: new Date().toISOString() }).eq("request_id", noConsent.id);
    expect((await accept(owner, await read(noConsent.id))).error?.code).toBe("MR422");

    // Only a file in review: not a new one, nor a consultancy.
    const fresh = await create();
    await service.from("mortgage_documents").update({ state: "accepted" }).eq("request_id", fresh.id);
    expect((await accept(owner, await read(fresh.id))).error?.code).toBe("MR409");
    expect((await accept(owner, await create("consultancy"))).error?.code).toBe("MR409");

    const row = await inReview();
    expect((await accept(other, row)).error?.code).toBe("MR403");
    expect((await accept(admin, row)).error?.code).toBe("MR403");
    expect((await accept(owner, row, "2020-01-01T00:00:00Z")).error?.code).toBe("MR409");
    for (const r of [notAccepted, noConsent, fresh, row]) expect((await read(r.id)).sla_stopped_at).toBeNull();

    // The Head may accept anyone's file, once.
    expect((await accept(head, row)).error).toBeNull();
    expect((await accept(head, await read(row.id))).error?.code).toBe("MR409");
    expect((await events(row.id)).find((e) => e.type === "application.accepted")?.actor_id).toBe(head.id);
  }, 60_000);

  // ── The pre-approval ────────────────────────────────────────

  it("records a pre-approval on an accepted file: closed, the clock kept at the acceptance, nobody emailed", async () => {
    const row = await accepted();
    const before = await outbox(row.id);
    const { data, error } = await recordPreApproval(owner, row);
    expect(error).toBeNull();
    expect((data as Row).status).toBe("pre_approved");

    const after = await read(row.id);
    expect(after).toMatchObject({
      status: "pre_approved",
      decision: "pre_approved",
      decided_by: owner.id,
      decision_message: "FAB pre-approved AED 2,150,000.",
      decline_reason: null,
    });
    expect(after.sla_stopped_at).toBe(row.sla_stopped_at);
    expect(after.closed_at).not.toBeNull();
    expect(new Date(after.closed_at!).getTime()).toBeGreaterThanOrEqual(new Date(row.sla_stopped_at!).getTime());
    expect(slaStatus(after, new Date(), policy)).toMatchObject({ state: "met", stopped: true });

    const log = await events(row.id);
    expect(log.filter((e) => e.type === "status.changed").at(-1)?.data).toMatchObject({ from: "accepted", to: "pre_approved", event: "pre_approved" });
    expect(log.find((e) => e.type === "decision.pre_approved")).toMatchObject({
      actor_id: owner.id,
      data: { note: "FAB pre-approved AED 2,150,000." },
    });
    // Recorded, not sent: the team tells the applicant itself.
    expect(await outbox(row.id)).toEqual(before);
  }, 60_000);

  it("a pre-approval needs no note", async () => {
    const row = await accepted();
    expect((await recordPreApproval(head, row, { note: null })).error).toBeNull();
    expect(await read(row.id)).toMatchObject({ status: "pre_approved", decided_by: head.id, decision_message: null });
    expect((await events(row.id)).find((e) => e.type === "decision.pre_approved")?.data).toEqual({});
  }, 60_000);

  it("pre-approves only an accepted file, by the owner or the Head, once, on a fresh page", async () => {
    const reviewing = await inReview();
    expect((await recordPreApproval(owner, reviewing)).error?.code).toBe("MR409");
    expect((await recordPreApproval(owner, await create("consultancy"))).error?.code).toBe("MR409");

    const row = await accepted();
    expect((await recordPreApproval(other, row)).error?.code).toBe("MR403");
    expect((await recordPreApproval(admin, row)).error?.code).toBe("MR403");
    expect((await recordPreApproval(owner, row, { note: "x".repeat(1001) })).error?.code).toBe("MR422");
    expect((await recordPreApproval(owner, row, { expected: "2020-01-01T00:00:00Z" })).error?.code).toBe("MR409");
    expect((await read(row.id)).status).toBe("accepted");

    expect((await recordPreApproval(owner, row)).error).toBeNull();
    expect((await recordPreApproval(owner, await read(row.id))).error?.code).toBe("MR409");
    // Closed: it can't be declined either.
    expect((await decline(owner, await read(row.id))).error?.code).toBe("MR409");
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
    expect(after.status).toBe("accepted");
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
      data: { reason: "debt_burden", channels: ["email", "whatsapp"], reuploads_cancelled: 0 },
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

  it("once accepted: 'no bank made an offer', and the clock stays stopped at the acceptance", async () => {
    const row = await accepted();
    expect(row.status).toBe("accepted");

    expect((await decline(owner, row, { reason: "no_bank_offer" })).error).toBeNull();
    const after = await read(row.id);
    expect(after).toMatchObject({ status: "declined", decision: "declined", decline_reason: "no_bank_offer", decided_by: owner.id });
    expect(after.sla_stopped_at).toBe(row.sla_stopped_at);
    expect(after.closed_at).not.toBeNull();
    expect((await events(row.id)).find((e) => e.type === "decision.declined")?.data).toEqual({
      reason: "no_bank_offer",
      channels: ["email", "whatsapp"],
      reuploads_cancelled: 0,
    });
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

  it("needs a reason, a message, email, and an accepted file before 'no bank made an offer'", async () => {
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

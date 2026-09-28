/**
 * @vitest-environment node
 */

/**
 * The team's CMS (PLAN Phase 4), against the local Supabase stack
 * (`npm run db:local:reset && npm run test:db`):
 *
 *   · permissions: an adviser acts only on requests they own, the Head of
 *     mortgages on any, an admin without a mortgage role on none (D10);
 *     claiming and reassigning follow SPEC §2.7;
 *   · a consultancy moves New → Contacted → Consultation booked → Completed
 *     through the actions, each writing its event, and a slot can't be
 *     booked twice;
 *   · one live pre-approval invite per request;
 *   · a stale page gets 409;
 *   · the SLA tick raises "at risk" and "missed" once each, on a fake clock;
 *   · the outbox rings the bell, emails the team and sends the booking with
 *     its calendar invite.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendEmailInput } from "@/lib/email";
import { clockDueFrom, subtractWorkingSeconds, type SlaPolicy } from "./sla";
import { hashToken, newToken } from "./server/tokens";
import { deliverNotifications } from "./server/notify";
import { loadMortgageSettings } from "./server/settings";
import { slaTick } from "./server/sla-tick";
import { client, createTestStaff, localStack, type LocalStack, type TestStaff } from "./testing/local-stack";

const stack = localStack();
if (!stack) console.warn("mortgage CMS tests skipped: start the local stack with `npm run db:local:reset`");

type Row = {
  id: string;
  reference: string;
  status: string;
  owner_staff_id: string | null;
  updated_at: string;
  first_contact_at: string | null;
  closed_at: string | null;
  sla_due_at: string | null;
  sla_risk_notified_at: string | null;
  sla_breach_notified_at: string | null;
  employment_type: string;
};

describe.skipIf(!stack)("mortgage CMS (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let policy: SlaPolicy;
  let head: TestStaff;
  let adviserA: TestStaff;
  let adviserB: TestStaff;
  let admin: TestStaff;
  let assignmentBefore: string;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    policy = (await loadMortgageSettings(service)).policy;
    [head, adviserA, adviserB, admin] = await Promise.all([
      createTestStaff(local, service, "support", "head"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "support", "adviser"),
      createTestStaff(local, service, "admin", null),
    ]);
    const { data } = await service.from("mortgage_settings").select("assignment_mode").eq("id", 1).single();
    assignmentBefore = (data as { assignment_mode: string }).assignment_mode;
  }, 60_000);

  afterAll(async () => {
    await service.from("mortgage_settings").update({ assignment_mode: assignmentBefore }).eq("id", 1);
  });

  // ── Helpers ─────────────────────────────────────────────────

  async function create(kind: "consultancy" | "pre_approval", opts: { owner?: TestStaff | null; at?: Date } = {}): Promise<Row> {
    const at = opts.at ?? new Date();
    const { data, error } = await service.rpc("mortgage_create_request", {
      p_service: kind,
      p_full_name: "Test Applicant",
      p_date_of_birth: "1990-01-01",
      p_mobile_e164: `+97150${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
      p_email: `applicant-${randomUUID().slice(0, 8)}@example.com`,
      p_residency: "uae_national",
      p_employment_type: "salaried",
      p_entry_point: "calculator_advisor",
      p_at: at.toISOString(),
      ...(kind === "pre_approval"
        ? { p_consent_version: "v0.1", p_consent_text: "Consent.", p_sla_due_at: clockDueFrom(at, policy) }
        : {}),
    });
    if (error) throw new Error(`create failed: ${error.code} ${error.message}`);
    const row = data as Row;
    if (opts.owner !== undefined) {
      const { error: ownerError } = await service
        .from("mortgage_requests")
        .update({ owner_staff_id: opts.owner?.id ?? null })
        .eq("id", row.id);
      if (ownerError) throw new Error(ownerError.message);
    }
    return read(row.id);
  }

  async function read(id: string): Promise<Row> {
    const { data, error } = await service.from("mortgage_requests").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data as Row;
  }

  async function events(id: string): Promise<{ type: string; actor_id: string | null; data: Record<string, unknown> }[]> {
    const { data } = await service
      .from("mortgage_events")
      .select("type, actor_id, data, created_at")
      .eq("request_id", id)
      .order("created_at");
    return (data ?? []) as { type: string; actor_id: string | null; data: Record<string, unknown> }[];
  }

  const logCall = (who: TestStaff, row: Pick<Row, "id">, outcome = "no_answer", expected: string | null = null) =>
    who.client.rpc("mortgage_log_contact", {
      p_request_id: row.id,
      p_channel: "call",
      p_outcome: outcome,
      p_expected_updated_at: expected,
    });

  /** Tomorrow-or-later at a round time, far enough ahead to be bookable. */
  function slot(daysAhead: number, minute = 0): string {
    const at = new Date(Date.now() + daysAhead * 86_400_000);
    at.setUTCHours(6, minute, 0, 0);
    return at.toISOString();
  }

  const book = (who: TestStaff, row: Pick<Row, "id">, startsAt: string, adviser: TestStaff = who, invite = true) =>
    who.client.rpc("mortgage_book_consultation", {
      p_request_id: row.id,
      p_adviser: adviser.id,
      p_format: "phone",
      p_starts_at: startsAt,
      p_send_invite: invite,
    });

  // ── A new request ───────────────────────────────────────────

  it("tells the owner and every Head of mortgages about a new request, in the bell and by email", async () => {
    const row = await create("pre_approval");
    const { data: heads } = await service.from("staff").select("user_id").eq("mortgage_role", "head").eq("status", "active");
    const expected = new Set([...(heads ?? []).map((h: { user_id: string }) => h.user_id), ...(row.owner_staff_id ? [row.owner_staff_id] : [])]);
    const { data: queued } = await service
      .from("mortgage_notifications")
      .select("kind, channel, recipient_staff_id, status")
      .eq("request_id", row.id)
      .eq("kind", "team_new_request");
    const rows = (queued ?? []) as { channel: string; recipient_staff_id: string }[];
    expect(new Set(rows.map((r) => r.recipient_staff_id))).toEqual(expected);
    expect(rows).toHaveLength(expected.size * 2);
    expect(rows.filter((r) => r.recipient_staff_id === head.id).map((r) => r.channel).sort()).toEqual(["email", "in_app"]);
  });

  // ── Owner ───────────────────────────────────────────────────

  it("lets an adviser claim an unassigned request, and only once", async () => {
    const row = await create("consultancy", { owner: null });
    expect((await adviserA.client.rpc("mortgage_claim", { p_request_id: row.id })).error).toBeNull();
    expect((await read(row.id)).owner_staff_id).toBe(adviserA.id);
    // Claiming what you already own is a no-op; someone else's claim is a conflict.
    expect((await adviserA.client.rpc("mortgage_claim", { p_request_id: row.id })).error).toBeNull();
    expect((await adviserB.client.rpc("mortgage_claim", { p_request_id: row.id })).error?.code).toBe("MR409");
    const claims = (await events(row.id)).filter((e) => e.type === "owner.assigned" && e.data.via === "claim");
    expect(claims).toHaveLength(1);
    expect(claims[0]!.actor_id).toBe(adviserA.id);
  });

  it("lets only the Head of mortgages reassign, and only to the team", async () => {
    const row = await create("consultancy", { owner: adviserA });
    const reassign = (who: TestStaff, to: TestStaff) =>
      who.client.rpc("mortgage_reassign", { p_request_id: row.id, p_owner: to.id });
    expect((await reassign(adviserA, adviserB)).error?.code).toBe("MR403");
    expect((await reassign(head, admin)).error?.code).toBe("MR422");
    expect((await reassign(head, adviserB)).error).toBeNull();
    expect((await read(row.id)).owner_staff_id).toBe(adviserB.id);
    const moved = (await events(row.id)).find((e) => e.type === "owner.assigned" && e.data.via === "reassign");
    expect(moved?.data).toMatchObject({ owner_staff_id: adviserB.id, from: adviserA.id });
  });

  it("keeps an admin without a mortgage role out of every action (D10)", async () => {
    const row = await create("consultancy", { owner: adviserA });
    const calls = [
      admin.client.rpc("mortgage_claim", { p_request_id: row.id }),
      admin.client.rpc("mortgage_reassign", { p_request_id: row.id, p_owner: admin.id }),
      logCall(admin, row),
      book(admin, row, slot(3)),
      admin.client.rpc("mortgage_consultation_held", { p_request_id: row.id }),
      admin.client.rpc("mortgage_create_invite", {
        p_request_id: row.id,
        p_token_hash: hashToken(newToken()),
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      admin.client.rpc("mortgage_edit_applicant", {
        p_request_id: row.id,
        p_full_name: "Changed Name",
        p_date_of_birth: "1990-01-01",
        p_mobile_e164: "+971500000000",
        p_email: "changed@example.com",
        p_residency: "uae_national",
      }),
      admin.client.rpc("mortgage_update_settings", {
        p_flag: "public",
        p_assignment_mode: "claim",
        p_ltv_national: 85,
        p_ltv_expat: 80,
      }),
    ];
    for (const { error } of await Promise.all(calls)) expect(error?.code).toBe("MR403");
    expect(await read(row.id)).toMatchObject({ status: "new", owner_staff_id: adviserA.id });
  });

  it("lets an adviser act on the requests they own, and the Head on any", async () => {
    const row = await create("consultancy", { owner: adviserA });
    expect((await logCall(adviserB, row)).error?.code).toBe("MR403");
    expect((await logCall(adviserA, row)).error).toBeNull();
    expect((await logCall(head, row)).error).toBeNull();
    const { data: attempts } = await service.from("mortgage_contact_attempts").select("staff_id").eq("request_id", row.id);
    expect((attempts ?? []).map((a: { staff_id: string }) => a.staff_id).sort()).toEqual([adviserA.id, head.id].sort());
  });

  // ── Consultancy: New → Contacted → Booked → Completed ───────

  it("takes a consultancy from New to Completed, one event per step", async () => {
    const row = await create("consultancy", { owner: adviserA });

    // Booking needs a contact first: New can't jump to Booked.
    expect((await book(adviserA, row, slot(4))).error).not.toBeNull();
    expect((await read(row.id)).status).toBe("new");

    expect((await logCall(adviserA, row)).error).toBeNull();
    const contacted = await read(row.id);
    expect(contacted.status).toBe("contacted");
    expect(contacted.first_contact_at).not.toBeNull();
    // A second attempt keeps it Contacted and the first-contact time.
    expect((await logCall(adviserA, row, "reached")).error).toBeNull();
    expect(await read(row.id)).toMatchObject({ status: "contacted", first_contact_at: contacted.first_contact_at });
    // Inbound replies belong to the WhatsApp webhook.
    expect((await logCall(adviserA, row, "received")).error?.code).toBe("MR422");

    const startsAt = slot(4);
    const { data: consultation, error } = await book(adviserA, row, startsAt);
    expect(error).toBeNull();
    expect((await read(row.id)).status).toBe("consultation_booked");
    const { data: outbox } = await service
      .from("mortgage_notifications")
      .select("channel, dedupe, status")
      .eq("request_id", row.id)
      .eq("kind", "consultation_booked");
    expect((outbox ?? []).map((n: { channel: string }) => n.channel).sort()).toEqual(["email", "whatsapp"]);
    expect((outbox ?? []).every((n: { dedupe: string }) => n.dedupe === (consultation as { id: string }).id)).toBe(true);

    expect((await adviserA.client.rpc("mortgage_consultation_held", { p_request_id: row.id })).error).toBeNull();
    const done = await read(row.id);
    expect(done.status).toBe("completed");
    expect(done.closed_at).not.toBeNull();
    const { data: held } = await service.from("mortgage_consultations").select("status").eq("request_id", row.id);
    expect(held).toEqual([{ status: "held" }]);

    const types = (await events(row.id)).map((e) => e.type);
    for (const type of ["request.submitted", "contact.logged", "consultation.booked", "consultation.held"]) {
      expect(types, type).toContain(type);
    }
    expect((await events(row.id)).filter((e) => e.type === "status.changed").map((e) => e.data.to)).toEqual([
      "contacted",
      "consultation_booked",
      "completed",
    ]);
  });

  it("refuses a slot the adviser already has, and one in the past", async () => {
    const first = await create("consultancy", { owner: adviserB });
    const second = await create("consultancy", { owner: adviserB });
    for (const r of [first, second]) expect((await logCall(adviserB, r)).error).toBeNull();
    const startsAt = slot(5, 30);
    expect((await book(adviserB, first, startsAt)).error).toBeNull();
    // Ten minutes later overlaps a 20-minute consultation.
    const overlap = new Date(new Date(startsAt).getTime() + 10 * 60_000).toISOString();
    const clash = await book(adviserB, second, overlap);
    expect(clash.error?.code).toBe("MR409");
    expect(clash.error?.message).toContain("slot_taken");
    expect((await read(second.id)).status).toBe("contacted");
    expect((await book(adviserB, second, new Date(Date.now() - 60_000).toISOString())).error?.code).toBe("MR422");
  });

  it("answers a stale page with 409", async () => {
    const row = await create("consultancy", { owner: adviserA });
    const stale = row.updated_at;
    expect((await logCall(adviserA, row, "no_answer", stale)).error).toBeNull();
    expect((await logCall(adviserA, row, "no_answer", stale)).error?.code).toBe("MR409");
  });

  // ── Invite and applicant ────────────────────────────────────

  it("keeps one live pre-approval invite per consultancy request", async () => {
    const row = await create("consultancy", { owner: adviserA });
    const invite = (hash = hashToken(newToken())) =>
      adviserA.client.rpc("mortgage_create_invite", {
        p_request_id: row.id,
        p_token_hash: hash,
        p_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });
    const first = await invite();
    const second = await invite();
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    const { data: links } = await service
      .from("mortgage_access_links")
      .select("id, revoked_at, purpose")
      .eq("request_id", row.id);
    const live = (links ?? []).filter((l: { revoked_at: string | null }) => !l.revoked_at);
    expect(live).toEqual([{ id: (second.data as { id: string }).id, revoked_at: null, purpose: "preapproval_invite" }]);
    expect((await invite("not-a-hash")).error?.code).toBe("MR422");
    const pre = await create("pre_approval", { owner: adviserA });
    expect(
      (
        await adviserA.client.rpc("mortgage_create_invite", {
          p_request_id: pre.id,
          p_token_hash: hashToken(newToken()),
          p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        })
      ).error?.code,
    ).toBe("MR422");
  });

  it("corrects the applicant's details, never the employment type", async () => {
    const row = await create("pre_approval", { owner: adviserA });
    const { error } = await adviserA.client.rpc("mortgage_edit_applicant", {
      p_request_id: row.id,
      p_full_name: "Corrected Name",
      p_date_of_birth: "1990-01-01",
      p_mobile_e164: "+971501112233",
      p_email: "Corrected@Example.com",
      p_residency: "uae_resident_expat",
    });
    expect(error).toBeNull();
    const after = (await service.from("mortgage_requests").select("full_name, email, residency, employment_type").eq("id", row.id).single())
      .data;
    expect(after).toEqual({
      full_name: "Corrected Name",
      email: "corrected@example.com",
      residency: "uae_resident_expat",
      employment_type: "salaried",
    });
    const edited = (await events(row.id)).find((e) => e.type === "applicant.edited");
    // The fields, never the values.
    expect(edited?.data).toEqual({ fields: ["full_name", "mobile", "email", "residency"] });
    expect(
      (await service.from("mortgage_requests").update({ employment_type: "business_owner" }).eq("id", row.id)).error,
    ).not.toBeNull();
  });

  // ── The outbox ──────────────────────────────────────────────

  it("rings the bell and emails the team, naming the request by reference only", async () => {
    const row = await create("pre_approval", { owner: adviserA });
    const sent: SendEmailInput[] = [];
    const report = await deliverNotifications(
      {
        db: service,
        send: async (input) => {
          sent.push(input);
          return { status: "ok", id: `test-${sent.length}` };
        },
        staffEmail: async (id) => `${id.slice(0, 8)}@staff.example.com`,
      },
      { requestId: row.id, limit: 50 },
    );
    expect(report.failed).toBe(0);
    const { data: bells } = await service
      .from("notifications")
      .select("user_id, kind, title, link")
      .eq("kind", "mortgage_request")
      .eq("link", `/admin/mortgages/${row.reference}`);
    expect((bells ?? []).map((b: { user_id: string }) => b.user_id)).toContain(head.id);
    for (const b of bells ?? []) expect((b as { title: string }).title).not.toContain("Test Applicant");
    const teamEmails = sent.filter((m) => m.to.endsWith("@staff.example.com"));
    expect(teamEmails.map((m) => m.to)).toContain(`${head.id.slice(0, 8)}@staff.example.com`);
    for (const m of teamEmails) expect(`${m.subject}\n${m.text}`).not.toContain("Test Applicant");
  });

  it("sends the booking confirmation with a calendar invite, and records WhatsApp as not connected", async () => {
    const row = await create("consultancy", { owner: adviserA });
    await logCall(adviserA, row);
    // Set aside the confirmation and the team's alerts, so only the booking's messages are claimed below.
    await service.from("mortgage_notifications").update({ status: "skipped" }).eq("request_id", row.id).eq("status", "queued");
    expect((await book(adviserA, row, slot(6))).error).toBeNull();
    const sent: SendEmailInput[] = [];
    await deliverNotifications(
      {
        db: service,
        send: async (input) => {
          sent.push(input);
          return { status: "ok", id: "test" };
        },
        staffEmail: async () => "adviser@staff.example.com",
      },
      { requestId: row.id },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]!.replyTo).toBe("adviser@staff.example.com");
    const ics = sent[0]!.attachments?.[0];
    expect(ics?.filename).toMatch(/\.ics$/);
    expect(ics?.content).toContain("BEGIN:VEVENT");
    const { data: rows } = await service
      .from("mortgage_notifications")
      .select("channel, status")
      .eq("request_id", row.id)
      .eq("kind", "consultation_booked");
    expect(Object.fromEntries((rows ?? []).map((r: { channel: string; status: string }) => [r.channel, r.status]))).toEqual({
      email: "sent",
      whatsapp: "skipped",
    });
  });

  // ── The 24-hour promise's alarms ────────────────────────────

  describe("the SLA tick, on a fake clock", () => {
    it("raises 'at risk' once, then 'missed' once", async () => {
      const at = new Date();
      const row = await create("pre_approval", { owner: adviserA, at });
      const due = new Date(row.sla_due_at!);
      const tick = (now: Date) => slaTick({ db: service, now: () => now, requestIds: [row.id] });

      expect(await tick(new Date(at.getTime() + 60_000))).toEqual({ checked: 1, atRisk: 0, breached: 0 });

      const threeHoursLeft = subtractWorkingSeconds(due, 3 * 3600, policy.calendar);
      expect(await tick(threeHoursLeft)).toMatchObject({ atRisk: 1, breached: 0 });
      expect(await tick(threeHoursLeft)).toMatchObject({ atRisk: 0, breached: 0 });
      expect((await read(row.id)).sla_risk_notified_at).not.toBeNull();

      const late = new Date(due.getTime() + 60_000);
      expect(await tick(late)).toMatchObject({ atRisk: 0, breached: 1 });
      // Reported missed: the promise leaves the tick's list until it resumes.
      expect(await tick(late)).toEqual({ checked: 0, atRisk: 0, breached: 0 });

      const { data: alerts } = await service
        .from("mortgage_notifications")
        .select("kind, channel, recipient_staff_id")
        .eq("request_id", row.id)
        .in("kind", ["team_at_risk", "team_breached"]);
      const rows = (alerts ?? []) as { kind: string; channel: string; recipient_staff_id: string }[];
      for (const kind of ["team_at_risk", "team_breached"]) {
        const recipients = rows.filter((r) => r.kind === kind).map((r) => `${r.recipient_staff_id}:${r.channel}`);
        expect(recipients, kind).toContain(`${adviserA.id}:in_app`);
        expect(recipients, kind).toContain(`${head.id}:email`);
        expect(recipients).not.toContain(`${adviserB.id}:email`);
      }
      const types = (await events(row.id)).map((e) => e.type);
      expect(types.filter((x) => x === "sla.at_risk")).toHaveLength(1);
      expect(types.filter((x) => x === "sla.breached")).toHaveLength(1);
    });

    it("reports a promise missed between two runs as missed, not at risk", async () => {
      const at = new Date();
      const row = await create("pre_approval", { owner: adviserA, at });
      const report = await slaTick({ db: service, now: () => new Date(new Date(row.sla_due_at!).getTime() + 3_600_000), requestIds: [row.id] });
      expect(report).toMatchObject({ atRisk: 0, breached: 1 });
      expect((await read(row.id)).sla_risk_notified_at).toBeNull();
    });

    it("can't be called by the team, only by the service", async () => {
      const row = await create("pre_approval", { owner: adviserA });
      const { error } = await head.client.rpc("mortgage_flag_sla", { p_request_id: row.id, p_state: "breached" });
      expect(error).not.toBeNull();
      expect((await read(row.id)).sla_breach_notified_at).toBeNull();
    });

  });
});

/**
 * @vitest-environment node
 */

/**
 * The mortgage module's database — migrations 0138 and 0139 — tested against
 * the local Supabase stack:
 *
 *   npm run db:local:reset && npm run test:db
 *
 * Skipped with a warning when the stack isn't running, and left out of
 * `npm run test:run`, which has no database of its own.
 *
 * What it proves (PLAN Phase 1):
 *   · mortgage_transition() agrees with state.ts on every status × event × actor;
 *   · status and clock columns can't be written any other way, even by the service role;
 *   · mortgage_events is append-only, even for the database superuser;
 *   · references stay unique and gap-free under concurrent submits, and a
 *     retried submit makes one request;
 *   · the clock columns follow sla.ts through start, pause, resume and stop;
 *   · who sees and does what (SPEC §7): admins without a mortgage role see nothing.
 */

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DOCUMENT_SETS } from "./documents";
import { dubaiInstant } from "./dubai-time";
import { parseReference } from "./reference";
import {
  clockDueFrom,
  clockPause,
  clockResume,
  slaPolicy,
  slaStatus,
  type SlaPolicy,
} from "./sla";
import {
  ACTOR_KINDS,
  STATUSES_BY_SERVICE,
  TRANSITION_EVENTS,
  canTransition,
  nextStatus,
  type ActorKind,
  type MortgageService,
  type MortgageStatus,
  type TransitionContext,
  type TransitionEvent,
} from "./state";
import { client, createTestStaff, localStack, psql, type LocalStack, type TestStaff } from "./testing/local-stack";

type Row = {
  id: string;
  reference: string;
  service: MortgageService;
  status: MortgageStatus;
  owner_staff_id: string | null;
  first_contact_at: string | null;
  closed_at: string | null;
  updated_at: string;
  sla_started_at: string | null;
  sla_due_at: string | null;
  sla_paused_at: string | null;
  sla_paused_seconds: number;
  sla_remaining_seconds: number | null;
  sla_stopped_at: string | null;
  decision: string | null;
  property_id: string | null;
  property_ref: string | null;
};

const stack = localStack();
if (!stack) {
  console.warn("mortgage database tests skipped: start the local stack with `npm run db:local:reset`");
}

describe.skipIf(!stack)("mortgage database (local Supabase)", () => {
  const local = stack as LocalStack;
  let service: SupabaseClient;
  let policy: SlaPolicy;
  let bankId: string;
  let seq = 0;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    const { data: settings, error } = await service.from("mortgage_settings").select("*").single();
    if (error) throw new Error(`no mortgage_settings — has 0138 been applied? ${error.message}`);
    policy = slaPolicy(settings);
    const code = `T${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const { data: bank, error: bankError } = await service
      .from("mortgage_partner_banks")
      .insert({ code, name: "Test Bank" })
      .select("id")
      .single();
    if (bankError) throw new Error(bankError.message);
    bankId = bank.id;
  });

  // ── Helpers ─────────────────────────────────────────────────

  function applicantArgs(kind: MortgageService, employment: "salaried" | "business_owner" = "salaried") {
    seq++;
    return {
      p_service: kind,
      p_full_name: `Test Applicant ${seq}`,
      p_date_of_birth: "1990-01-01",
      p_mobile_e164: `+97150${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
      p_email: `applicant-${randomUUID().slice(0, 8)}@example.com`,
      p_residency: "uae_resident_expat",
      p_employment_type: employment,
      p_entry_point: "direct",
    };
  }

  function createArgs(
    kind: MortgageService,
    opts: { employment?: "salaried" | "business_owner"; at?: Date; submissionKey?: string } = {},
  ) {
    const at = opts.at ?? new Date();
    return {
      ...applicantArgs(kind, opts.employment),
      p_submission_key: opts.submissionKey ?? null,
      p_at: at.toISOString(),
      ...(kind === "pre_approval"
        ? {
            p_consent_version: "v0.1",
            p_consent_text: "I authorise Bazar Real Estate to share these documents with its partner banks.",
            p_sla_due_at: clockDueFrom(at, policy),
          }
        : {}),
    };
  }

  async function create(
    kind: MortgageService,
    opts: { employment?: "salaried" | "business_owner"; at?: Date; submissionKey?: string } = {},
  ): Promise<Row> {
    const { data, error } = await service.rpc("mortgage_create_request", createArgs(kind, opts));
    if (error) throw new Error(`create failed: ${error.code} ${error.message}`);
    return data as Row;
  }

  function transition(
    row: Pick<Row, "id">,
    event: TransitionEvent,
    actor: ActorKind,
    extra: { sla?: Record<string, unknown>; data?: Record<string, unknown>; at?: Date; expected?: string } = {},
    as: SupabaseClient = service,
  ) {
    return as.rpc("mortgage_transition", {
      p_request_id: row.id,
      p_event: event,
      p_actor_kind: actor,
      p_sla: extra.sla ?? {},
      p_data: extra.data ?? {},
      p_expected_updated_at: extra.expected ?? null,
      p_at: (extra.at ?? new Date()).toISOString(),
    });
  }

  async function mustTransition(
    row: Pick<Row, "id">,
    event: TransitionEvent,
    actor: ActorKind,
    extra: Parameters<typeof transition>[3] = {},
  ): Promise<Row> {
    const { data, error } = await transition(row, event, actor, extra);
    if (error) throw new Error(`${event} failed: ${error.code} ${error.message}`);
    return data as Row;
  }

  /** The clock payload sla.ts would send for this row, whichever the move needs. */
  function slaFor(row: Row, at = new Date()) {
    return {
      ...(row.sla_due_at ? clockPause(row, at, policy) : {}),
      ...(row.sla_remaining_seconds !== null ? clockResume(row, at, policy) : {}),
    };
  }

  async function openReupload(row: Row) {
    const { data: doc } = await service
      .from("mortgage_documents")
      .select("id")
      .eq("request_id", row.id)
      .limit(1)
      .single();
    const { error } = await service.from("mortgage_reupload_requests").insert({
      request_id: row.id,
      document_id: doc!.id,
      reason: "unreadable",
      message: "Please upload a clearer copy.",
      channels: ["email"],
    });
    if (error) throw new Error(error.message);
  }

  async function readyForBanks(row: Row) {
    await service.from("mortgage_documents").update({ state: "accepted" }).eq("request_id", row.id);
    await service.from("mortgage_bank_submissions").insert({ request_id: row.id, bank_id: bankId });
  }

  /** A fresh request walked through legal moves to `status`. */
  async function inState(kind: MortgageService, status: MortgageStatus): Promise<Row> {
    if (kind === "consultancy") {
      let row = await create("consultancy");
      if (status === "new") return row;
      row = await mustTransition(row, "contact_logged", "staff");
      if (status === "contacted") return row;
      row = await mustTransition(row, "consultation_booked", "staff");
      if (status === "consultation_booked") return row;
      return mustTransition(row, "consultation_held", "staff");
    }
    let row = await create("pre_approval");
    if (status === "new") return row;
    row = await mustTransition(row, "first_document_opened", "system");
    if (status === "in_review") return row;
    if (status === "awaiting_applicant") {
      await openReupload(row);
      return mustTransition(row, "reupload_requested", "staff", { sla: slaFor(row) });
    }
    await readyForBanks(row);
    row = await mustTransition(row, "sent_to_banks", "staff");
    if (status === "with_banks") return row;
    return mustTransition(row, status === "pre_approved" ? "pre_approved" : "declined", "staff");
  }

  /** The facts mortgage_transition() reads, for state.ts to judge by. */
  async function contextOf(row: Row): Promise<TransitionContext> {
    const [docs, consents, subs, open] = await Promise.all([
      service.from("mortgage_documents").select("state").eq("request_id", row.id),
      service.from("mortgage_consents").select("id").eq("request_id", row.id).is("withdrawn_at", null),
      service.from("mortgage_bank_submissions").select("id").eq("request_id", row.id),
      service
        .from("mortgage_reupload_requests")
        .select("id")
        .eq("request_id", row.id)
        .is("fulfilled_at", null)
        .is("cancelled_at", null),
    ]);
    return {
      requiredDocuments: docs.data?.length ?? 0,
      acceptedDocuments: docs.data?.filter((d) => d.state === "accepted").length ?? 0,
      consentOnFile: (consents.data?.length ?? 0) > 0,
      bankSubmissions: subs.data?.length ?? 0,
      outstandingReuploads: open.data?.length ?? 0,
    };
  }

  // ── The transition table ────────────────────────────────────

  it("agrees with state.ts on every status × event × actor", async () => {
    const mismatches: string[] = [];
    let allowed = 0;
    for (const kind of ["pre_approval", "consultancy"] as const) {
      for (const status of STATUSES_BY_SERVICE[kind]) {
        const shared = await inState(kind, status); // absorbs every refused attempt unchanged
        const ctx = await contextOf(shared);
        for (const event of TRANSITION_EVENTS) {
          for (const actor of ACTOR_KINDS) {
            const expected = canTransition(kind, status, event, actor, ctx);
            const target = expected ? await inState(kind, status) : shared;
            const { data, error } = await transition(target, event, actor, { sla: slaFor(target) });
            const label = `${kind}: ${status} --${event} (${actor})-->`;
            if (!error !== expected) {
              mismatches.push(`${label} database ${error ? `refused (${error.code} ${error.message})` : "allowed"}, state.ts ${expected ? "allows" : "refuses"}`);
            } else if (expected) {
              allowed++;
              const want = nextStatus(kind, status, event, actor, ctx).to;
              if ((data as Row).status !== want) mismatches.push(`${label} database went to ${(data as Row).status}, state.ts to ${want}`);
            } else if (error?.code !== "MR422") {
              mismatches.push(`${label} refused with ${error?.code}, expected MR422`);
            }
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(allowed).toBeGreaterThanOrEqual(12);
  }, 240_000);

  it("creates each employment type's document set, matching documents.ts", async () => {
    for (const employment of ["salaried", "business_owner"] as const) {
      const row = await create("pre_approval", { employment });
      const { data } = await service.from("mortgage_documents").select("kind").eq("request_id", row.id);
      expect(data!.map((d) => d.kind).sort(), employment).toEqual([...DOCUMENT_SETS[employment]].sort());
    }
    const consult = await create("consultancy");
    const { data } = await service.from("mortgage_documents").select("kind").eq("request_id", consult.id);
    expect(data).toEqual([]);
  });

  it("stores consent with a pre-approval and refuses one without it, or without a due time", async () => {
    const row = await create("pre_approval");
    const { data: consent } = await service.from("mortgage_consents").select("wording_version").eq("request_id", row.id);
    expect(consent).toEqual([{ wording_version: "v0.1" }]);

    const noConsent = { ...createArgs("pre_approval"), p_consent_version: null };
    expect((await service.rpc("mortgage_create_request", noConsent)).error?.code).toBe("MR422");
    const noDue = { ...createArgs("pre_approval"), p_sla_due_at: null };
    expect((await service.rpc("mortgage_create_request", noDue)).error?.code).toBe("MR422");
    const consultWithClock = { ...createArgs("consultancy"), p_sla_due_at: new Date(Date.now() + 86_400_000).toISOString() };
    expect((await service.rpc("mortgage_create_request", consultWithClock)).error?.code).toBe("MR422");
  });

  it("keeps an unknown property reference as text, with no property", async () => {
    const { data, error } = await service.rpc("mortgage_create_request", {
      ...createArgs("consultancy"),
      p_property_ref: "BAZ-NOT-A-LISTING",
    });
    expect(error).toBeNull();
    expect((data as Row).property_ref).toBe("BAZ-NOT-A-LISTING");
    expect((data as Row).property_id).toBeNull();
  });

  it("refuses a change based on a stale read (409)", async () => {
    const row = await create("consultancy");
    await service.from("mortgage_requests").update({ full_name: "Changed Meanwhile" }).eq("id", row.id);
    const { error } = await transition(row, "contact_logged", "staff", { expected: row.updated_at });
    expect(error?.code).toBe("MR409");
  });

  // ── The 24-hour promise ─────────────────────────────────────

  it("keeps the clock through start, pause, resume and stop, with sla.ts's numbers", async () => {
    const submitted = dubaiInstant(2026, 9, 22, 10, 14); // Tue
    let row = await create("pre_approval", { at: submitted });
    expect(new Date(row.sla_started_at!)).toEqual(submitted);
    expect(new Date(row.sla_due_at!)).toEqual(dubaiInstant(2026, 9, 24, 14, 14)); // Thu, working hours

    row = await mustTransition(row, "first_document_opened", "system", { at: dubaiInstant(2026, 9, 22, 10, 33) });
    await openReupload(row);

    // Pause Wed 11:00 with 13h 14m of working time left.
    const pausedAt = dubaiInstant(2026, 9, 23, 11, 0);
    row = await mustTransition(row, "reupload_requested", "staff", { at: pausedAt, sla: clockPause(row, pausedAt, policy) });
    expect(row.status).toBe("awaiting_applicant");
    expect(row.sla_due_at).toBeNull();
    expect(row.sla_remaining_seconds).toBe(13 * 3600 + 14 * 60);
    expect(slaStatus(row, dubaiInstant(2026, 9, 27, 12, 0), policy).state).toBe("paused");

    // A pause without the frozen remainder is refused.
    const bare = await inState("pre_approval", "in_review");
    await openReupload(bare);
    expect((await transition(bare, "reupload_requested", "staff")).error?.code).toBe("MR422");

    // The applicant sends it the next Monday afternoon: the same 13h 14m remain.
    await service
      .from("mortgage_reupload_requests")
      .update({ fulfilled_at: new Date().toISOString() })
      .eq("request_id", row.id);
    const resumedAt = dubaiInstant(2026, 9, 28, 16, 0);
    row = await mustTransition(row, "reupload_fulfilled", "applicant", { at: resumedAt, sla: clockResume(row, resumedAt, policy) });
    expect(row.status).toBe("in_review");
    expect(new Date(row.sla_due_at!)).toEqual(dubaiInstant(2026, 9, 30, 9, 14));
    expect(row.sla_paused_seconds).toBe((resumedAt.getTime() - pausedAt.getTime()) / 1000);
    expect(slaStatus(row, resumedAt, policy).remainingSeconds).toBe(13 * 3600 + 14 * 60);

    // Accepted, sent to a bank, and pre-approved Tuesday morning: met.
    await readyForBanks(row);
    row = await mustTransition(row, "sent_to_banks", "staff", { at: dubaiInstant(2026, 9, 29, 10, 0) });
    const decidedAt = dubaiInstant(2026, 9, 29, 11, 0);
    row = await mustTransition(row, "pre_approved", "staff", { at: decidedAt, data: { message: "Good news." } });
    expect(row).toMatchObject({ status: "pre_approved", decision: "pre_approved" });
    expect(new Date(row.sla_stopped_at!)).toEqual(decidedAt);
    expect(new Date(row.closed_at!)).toEqual(decidedAt);
    expect(slaStatus(row, dubaiInstant(2026, 10, 5, 12, 0), policy).state).toBe("met");
  });

  it("sets first contact on consultancy and closes it when the consultation is held", async () => {
    const contactedAt = new Date("2026-09-28T07:52:00Z");
    let row = await create("consultancy");
    row = await mustTransition(row, "contact_logged", "staff", { at: contactedAt });
    expect(new Date(row.first_contact_at!)).toEqual(contactedAt);
    row = await mustTransition(row, "contact_logged", "staff", { at: new Date("2026-09-28T09:00:00Z") });
    expect(new Date(row.first_contact_at!)).toEqual(contactedAt);
    row = await mustTransition(row, "consultation_booked", "staff");
    row = await mustTransition(row, "consultation_held", "staff");
    expect(row.status).toBe("completed");
    expect(row.closed_at).not.toBeNull();
  });

  // ── Invariants ──────────────────────────────────────────────

  it("refuses any other write to status or the clock, even from the service role", async () => {
    const row = await create("pre_approval");
    const status = await service.from("mortgage_requests").update({ status: "with_banks" }).eq("id", row.id);
    expect(status.error?.code).toBe("MR403");
    const clock = await service.from("mortgage_requests").update({ sla_due_at: new Date().toISOString() }).eq("id", row.id);
    expect(clock.error?.code).toBe("MR403");
    const employment = await service.from("mortgage_requests").update({ employment_type: "business_owner" }).eq("id", row.id);
    expect(employment.error?.code).toBe("MR403");
    const insert = await service.from("mortgage_requests").insert({
      reference: "BZM-99-0001",
      service: "consultancy",
      full_name: "Direct Insert",
      date_of_birth: "1990-01-01",
      mobile_e164: "+971501234567",
      email: "direct@example.com",
      residency: "uae_national",
      employment_type: "salaried",
    });
    expect(insert.error?.code).toBe("MR403");

    // Ownership and applicant details are ordinary columns.
    const ordinary = await service
      .from("mortgage_requests")
      .update({ owner_staff_id: null, full_name: "Renamed Applicant" })
      .eq("id", row.id);
    expect(ordinary.error).toBeNull();
  });

  it("keeps mortgage_events append-only, for the service role and the database superuser alike", async () => {
    const row = await create("consultancy");
    expect((await service.from("mortgage_events").update({ type: "tampered.event" }).eq("request_id", row.id)).error).not.toBeNull();
    expect((await service.from("mortgage_events").delete().eq("request_id", row.id)).error).not.toBeNull();
    expect(() => psql(`update public.mortgage_events set data = '{}' where request_id = '${row.id}'`)).toThrow(/append-only/);
    expect(() => psql(`delete from public.mortgage_events where request_id = '${row.id}'`)).toThrow(/append-only/);
    expect(() => psql("truncate public.mortgage_events")).toThrow(/append-only/);
    // Deleting the request would cascade into its log, so that's refused too.
    expect(() => psql(`delete from public.mortgage_requests where id = '${row.id}'`)).toThrow(/append-only/);

    const { count } = await service
      .from("mortgage_events")
      .select("*", { count: "exact", head: true })
      .eq("request_id", row.id);
    expect(count).toBeGreaterThan(0);
  });

  it("allocates references under concurrent submits: unique and consecutive", async () => {
    const at = new Date(Date.UTC(2031, 5, 1)).toISOString(); // BZM-31-…, a year no other test uses
    const results = await Promise.all(
      Array.from({ length: 40 }, () => service.rpc("mortgage_allocate_reference", { p_at: at })),
    );
    for (const r of results) expect(r.error).toBeNull();
    const refs = results.map((r) => r.data as string);
    expect(new Set(refs).size).toBe(40);
    expect(refs.every((ref) => ref.startsWith("BZM-31-"))).toBe(true);
    const numbers = refs.map((ref) => parseReference(ref)!.n).sort((a, b) => a - b);
    expect(numbers.at(-1)! - numbers[0]).toBe(39);
  });

  it("gives concurrent submits distinct references", async () => {
    const rows = await Promise.all(Array.from({ length: 20 }, () => create("consultancy")));
    expect(new Set(rows.map((r) => r.reference)).size).toBe(20);
  });

  it("makes one request per submission key, however many retries race", async () => {
    const args = createArgs("pre_approval", { submissionKey: randomUUID() });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.rpc("mortgage_create_request", args)),
    );
    for (const r of results) expect(r.error).toBeNull();
    expect(new Set(results.map((r) => (r.data as Row).id)).size).toBe(1);
    const { count } = await service
      .from("mortgage_requests")
      .select("*", { count: "exact", head: true })
      .eq("submission_key", args.p_submission_key!);
    expect(count).toBe(1);
  });

  it("assigns round-robin across active advisers, and leaves requests for claiming in claim mode", async () => {
    const { data: advisers } = await service
      .from("staff")
      .select("user_id")
      .eq("mortgage_role", "adviser")
      .eq("status", "active");
    const ids = advisers!.map((a) => a.user_id);
    if (ids.length < 2) return; // the seed or the role tests provide two or more

    const owners: (string | null)[] = [];
    for (let i = 0; i < ids.length; i++) owners.push((await create("consultancy")).owner_staff_id);
    expect(new Set(owners).size).toBe(ids.length);
    expect(owners.every((o) => o !== null && ids.includes(o))).toBe(true);

    await service.from("mortgage_settings").update({ assignment_mode: "claim" }).eq("id", 1);
    try {
      expect((await create("consultancy")).owner_staff_id).toBeNull();
    } finally {
      await service.from("mortgage_settings").update({ assignment_mode: "round_robin" }).eq("id", 1);
    }
  });

  // ── Who sees and does what (SPEC §7) ────────────────────────

  describe("who sees and does what", () => {
    type Person = TestStaff;
    const people: Record<"head" | "adviserA" | "adviserB" | "admin" | "agent", Person> = {} as never;
    let anon: SupabaseClient;
    const person = (role: "support" | "admin" | "agent", mortgageRole: "head" | "adviser" | null) =>
      createTestStaff(local, service, role, mortgageRole);

    beforeAll(async () => {
      people.head = await person("support", "head");
      people.adviserA = await person("support", "adviser");
      people.adviserB = await person("support", "adviser");
      people.admin = await person("admin", null);
      people.agent = await person("agent", null);
      anon = client(local, local.anonKey);
    }, 60_000);

    async function ownedBy(owner: Person, kind: MortgageService = "consultancy") {
      const row = await create(kind);
      await service.from("mortgage_requests").update({ owner_staff_id: owner.id }).eq("id", row.id);
      return row;
    }

    it("shows admins and other staff without a mortgage role nothing", async () => {
      const row = await ownedBy(people.adviserA);
      for (const who of [people.admin, people.agent]) {
        for (const table of ["mortgage_requests", "mortgage_events", "mortgage_documents", "mortgage_consents", "mortgage_files"]) {
          const { data } = await who.client.from(table).select("*").limit(5);
          expect(data ?? [], table).toEqual([]);
        }
        const direct = await who.client.from("mortgage_requests").select("id").eq("id", row.id);
        expect(direct.data ?? []).toEqual([]);
      }
    });

    it("lets admins read the settings and banks they manage, and nobody outside the team or admins", async () => {
      expect((await people.admin.client.from("mortgage_settings").select("flag")).data).toHaveLength(1);
      expect((await people.agent.client.from("mortgage_settings").select("flag")).data ?? []).toEqual([]);
    });

    it("gives anonymous visitors nothing", async () => {
      for (const table of ["mortgage_requests", "mortgage_settings", "mortgage_upload_drafts", "mortgage_access_links"]) {
        const { data } = await anon.from(table).select("*").limit(1);
        expect(data ?? [], table).toEqual([]);
      }
      expect((await anon.rpc("mortgage_create_request", createArgs("consultancy"))).error).not.toBeNull();
    });

    it("shows the whole team every request (a team inbox)", async () => {
      const row = await ownedBy(people.adviserA);
      for (const who of [people.adviserB, people.head]) {
        const { data } = await who.client.from("mortgage_requests").select("id").eq("id", row.id);
        expect(data).toHaveLength(1);
      }
    });

    it("lets advisers act on their own requests and the Head of mortgages on any", async () => {
      const row = await ownedBy(people.adviserA);
      const other = await transition(row, "contact_logged", "staff", {}, people.adviserB.client);
      expect(other.error?.code).toBe("MR403");
      const own = await transition(row, "contact_logged", "staff", {}, people.adviserA.client);
      expect(own.error).toBeNull();
      const head = await transition(row, "consultation_booked", "staff", {}, people.head.client);
      expect(head.error).toBeNull();
      expect((head.data as Row).status).toBe("consultation_booked");
    });

    it("keeps applicant and system events away from signed-in staff", async () => {
      const row = await ownedBy(people.adviserA, "pre_approval");
      const system = await transition(row, "first_document_opened", "system", {}, people.adviserA.client);
      expect(system.error?.code).toBe("MR403");
      const applicant = await transition(row, "reupload_fulfilled", "applicant", {}, people.head.client);
      expect(applicant.error?.code).toBe("MR403");
    });

    it("records the signed-in caller and the database's time, whatever the call claims", async () => {
      const row = await ownedBy(people.adviserA);
      const before = Date.now();
      const { data: eventId, error } = await people.adviserA.client.rpc("mortgage_log_event", {
        p_request_id: row.id,
        p_type: "document.viewed",
        p_data: { kind: "passport" },
        p_actor_kind: "staff",
        p_actor_id: people.head.id,
        p_at: "2020-01-01T00:00:00Z",
      });
      expect(error).toBeNull();
      const { data: logged } = await service.from("mortgage_events").select("actor_id, created_at").eq("id", eventId).single();
      expect(logged!.actor_id).toBe(people.adviserA.id);
      expect(new Date(logged!.created_at).getTime()).toBeGreaterThanOrEqual(before - 5_000);

      const moved = await transition(row, "contact_logged", "staff", { at: new Date("2020-01-01T00:00:00Z") }, people.adviserA.client);
      expect(new Date((moved.data as Row).first_contact_at!).getTime()).toBeGreaterThanOrEqual(before - 5_000);
    });

    it("gives signed-in staff no direct writes and no way to create requests", async () => {
      const row = await ownedBy(people.adviserA);
      const who = people.head.client;
      expect((await who.from("mortgage_requests").update({ full_name: "Edited Directly" }).eq("id", row.id)).error).not.toBeNull();
      expect((await who.from("mortgage_events").insert({ request_id: row.id, actor_kind: "staff", type: "fake.event" })).error).not.toBeNull();
      expect((await who.rpc("mortgage_create_request", createArgs("consultancy"))).error).not.toBeNull();
      expect((await who.rpc("mortgage_allocate_reference", {})).error).not.toBeNull();
    });
  });
});

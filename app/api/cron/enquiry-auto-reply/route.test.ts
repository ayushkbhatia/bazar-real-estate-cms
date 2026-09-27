/**
 * @vitest-environment node
 *
 * One lead, one acknowledgement.
 *
 * Every public intake sends its lead the acknowledgement inline, and this
 * route sweeps every minute for leads that still have no `ack_sent_at`. Until
 * the intakes stamped that column, the sweep saw every lead as unacknowledged
 * and every visitor with an email address got the email twice — in production,
 * 29 to 54 seconds apart. Valuation leads got the generic one on top of their
 * own confirmation.
 *
 * So these run the real intake actions, the real valuation route and the real
 * sweep against one fake `enquiries` table, on a clock the test controls, and
 * count the emails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { SendEmailInput, SendEmailResult } from "@/lib/email";

type Row = Record<string, unknown>;

const { db, sendEmailMock } = vi.hoisted(() => ({
  db: { tables: {} as Record<string, Row[]> },
  sendEmailMock: vi.fn<(input: SendEmailInput) => Promise<SendEmailResult>>(),
}));

function rows(table: string): Row[] {
  return (db.tables[table] ??= []);
}

type Result = { data: Row[]; error: null };
interface Builder extends PromiseLike<Result> {
  select(columns?: string): Builder;
  insert(payload: Row): Builder;
  update(payload: Row): Builder;
  eq(column: string, value: unknown): Builder;
  neq(column: string, value: unknown): Builder;
  is(column: string, value: unknown): Builder;
  gte(column: string, value: string): Builder;
  lte(column: string, value: string): Builder;
  maybeSingle(): Promise<{ data: Row | null; error: null }>;
}

/**
 * Just enough PostgREST: select / insert / update, the five filters the code
 * under test uses, `maybeSingle`, and awaiting the builder itself. Filters
 * follow SQL's null rules — `neq` and the range filters never match a null.
 */
function query(table: string): Builder {
  let op: "select" | "insert" | "update" = "select";
  let payload: Row = {};
  const where: ((row: Row) => boolean)[] = [];

  function run(): Row[] {
    if (op === "insert") {
      const row: Row =
        table === "enquiries"
          ? {
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
              ack_sent_at: null,
              archived_at: null,
              ...payload,
            }
          : { ...payload };
      rows(table).push(row);
      return [row];
    }
    const hits = rows(table).filter((row) => where.every((w) => w(row)));
    if (op === "update") hits.forEach((row) => Object.assign(row, payload));
    return hits;
  }

  function filter(test: (row: Row) => boolean): Builder {
    where.push(test);
    return builder;
  }

  const builder: Builder = {
    select: () => builder,
    insert(p) {
      op = "insert";
      payload = p;
      return builder;
    },
    update(p) {
      op = "update";
      payload = p;
      return builder;
    },
    eq: (c, v) => filter((r) => r[c] === v),
    neq: (c, v) => filter((r) => r[c] != null && r[c] !== v),
    is: (c, v) => filter((r) => (r[c] ?? null) === v),
    gte: (c, v) => filter((r) => r[c] != null && String(r[c]) >= v),
    lte: (c, v) => filter((r) => r[c] != null && String(r[c]) <= v),
    async maybeSingle() {
      const [first] = run();
      return { data: first ? { ...first } : null, error: null };
    },
    then(resolve, reject) {
      const result: Result = { data: run().map((r) => ({ ...r })), error: null };
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return builder;
}

const fakeSupabase = { from: query };

vi.mock("@supabase/supabase-js", () => ({ createClient: () => fakeSupabase }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));
vi.mock("@/lib/supabase/server", () => ({
  // An anonymous visitor, which is every real lead.
  createSupabaseServerClient: async () => ({
    ...fakeSupabase,
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));
vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: true,
  env: {
    CRON_SECRET: "cron-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/lib/content-assets/system-emails", () => ({
  enquiryAcknowledgementEmail: async (opts: { name: string }) => ({
    subject: "We have your enquiry",
    text: `Thank you, ${opts.name}.`,
    html: `<p>Thank you, ${opts.name}.</p>`,
  }),
  valuationCodeEmail: async () => ({ subject: "Your code", text: "", html: "" }),
  valuationReportRequestedEmail: async () => ({
    subject: "Your valuation report is being prepared",
    text: "An advisor is preparing your report.",
    html: "<p>An advisor is preparing your report.</p>",
  }),
}));
vi.mock("@/lib/otp", () => ({
  issueOtp: vi.fn(),
  verifyOtp: async () => ({ ok: true }),
}));
vi.mock("@/lib/observability", () => ({
  reportError: vi.fn(async () => {}),
  recordHeartbeat: vi.fn(async () => {}),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true }),
  extractClientIp: () => "203.0.113.7",
  rateLimitMessage: (s: number) => `Try again in ${s}s.`,
}));
vi.mock("@/lib/queries/lead-routing", () => ({ matchAdvisor: async () => null }));
vi.mock("@/lib/forms/record", () => ({
  captureFormSubmission: vi.fn(async () => {}),
  withLabels: (data: unknown) => data,
}));

import { GET } from "./route";
import { POST as valuationLead } from "../../valuation-lead/route";
import { createEnquiry } from "../../../[locale]/(public)/_actions";
import { submitServiceLead } from "../../../[locale]/(public)/services/_actions";
import { submitListingLead } from "../../../[locale]/(public)/services/sell/_actions";

const T0 = new Date("2026-09-27T10:00:00.000Z").getTime();
const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Move the clock to `ms` after T0. */
function at(ms: number) {
  vi.setSystemTime(T0 + ms);
}

/** One scheduled tick of the cron, as Vercel sends it. */
async function sweep(): Promise<{ ok: boolean; scanned: number; sent: number }> {
  const res = await GET(
    new NextRequest("https://www.bazarrealestate.ae/api/cron/enquiry-auto-reply", {
      headers: { authorization: "Bearer cron-secret" },
    }),
  );
  return res.json();
}

/** Every tick a lead created at T0 is inside the sweep's window for, and one past it. */
async function everyTickForSixMinutes() {
  for (let minute = 1; minute <= 6; minute++) {
    at(minute * MINUTE);
    await sweep();
  }
}

function recipients(): string[] {
  return sendEmailMock.mock.calls.map(([email]) => email.to);
}

function subjects(): string[] {
  return sendEmailMock.mock.calls.map(([email]) => email.subject);
}

/** The /tools/valuation report gate's second step: the code checks out. */
async function verifyValuationLead() {
  const res = await valuationLead(
    new NextRequest("https://www.bazarrealestate.ae/api/valuation-lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        email: "hamad@example.com",
        code: "123456",
        phone: "+971 50 222 3344",
        name: "Hamad Al Mansoori",
        intent: "sell",
        valuation_aed: 4_250_000,
        property_summary: "4-bed villa, Yas Island",
        locale: "en",
      }),
    }),
  );
  return res.json() as Promise<{ ok?: boolean }>;
}

const INTAKES: [label: string, submit: () => Promise<{ status: string }>][] = [
  [
    "createEnquiry (every shared-renderer form)",
    () =>
      createEnquiry({
        name: "Layla Haddad",
        email: "layla@example.com",
        phone: "+971 50 123 4567",
        message: "Is the Saadiyat villa still available?",
        source: "property_page",
        form_key: "property_enquiry",
        locale: "en",
      }),
  ],
  [
    "submitServiceLead (the service landings)",
    () =>
      submitServiceLead({
        kind: "consultation",
        name: "Omar Said",
        phone: "+971 50 765 4321",
        email: "omar@example.com",
        interest: "Buying",
        intent: "buy",
        form_key: "services_consultation_lead",
        locale: "en",
      }),
  ],
  [
    "submitListingLead (the /services/sell owner wizard)",
    () =>
      submitListingLead({
        intent: "sell",
        location: "Saadiyat Island",
        category: "residential",
        property_type: "Villa",
        bedrooms: "4",
        name: "Noura Al Ali",
        mobile: "050 123 4567",
        email: "noura@example.com",
        call_window: "morning",
        consent: true,
        locale: "en",
      }),
  ],
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  at(0);
  db.tables = {};
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ status: "ok", id: "re_test" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("one lead, one acknowledgement", () => {
  it.each(INTAKES)(
    "%s: the sweep leaves a lead it acknowledged alone",
    async (_label, submit) => {
      await expect(submit()).resolves.toMatchObject({ status: "ok" });
      expect(sendEmailMock).toHaveBeenCalledTimes(1);

      const [lead] = rows("enquiries");
      expect(lead.ack_sent_at).toEqual(expect.any(String));

      await everyTickForSixMinutes();

      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      expect(rows("audit_log")).toEqual([]);
    },
  );

  it.each(INTAKES)(
    "%s: a send that failed is left for the sweep, which sends it once",
    async (_label, submit) => {
      sendEmailMock.mockResolvedValueOnce({
        status: "error",
        message: "Resend is down",
      });
      await expect(submit()).resolves.toMatchObject({ status: "ok" });

      const [lead] = rows("enquiries");
      expect(lead.ack_sent_at).toBeNull();

      await everyTickForSixMinutes();

      // The failed attempt, then exactly one retry — not one per tick.
      expect(recipients()).toEqual([lead.email, lead.email]);
      expect(lead.ack_sent_at).toEqual(expect.any(String));
      expect(rows("audit_log")).toEqual([
        expect.objectContaining({
          action: "enquiry.auto_reply_sent",
          target_kind: "enquiry",
          target_id: lead.id,
        }),
      ]);
    },
  );

  it("a tick landing while the inline send is in flight does not send it again", async () => {
    // The window between the insert and the stamp is the length of one
    // Resend call. A minute tick falls inside it every so often; it must not
    // take the not-yet-stamped lead for an unacknowledged one.
    let midSend: Awaited<ReturnType<typeof sweep>> | undefined;
    sendEmailMock.mockImplementationOnce(async () => {
      at(2 * SECOND);
      midSend = await sweep();
      return { status: "ok", id: "re_inline" };
    });

    await createEnquiry({
      name: "Layla Haddad",
      email: "layla@example.com",
      phone: "+971 50 123 4567",
      message: "Is the Saadiyat villa still available?",
      source: "property_page",
      form_key: "property_enquiry",
      locale: "en",
    });

    expect(midSend).toMatchObject({ ok: true, sent: 0 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});

describe("a valuation lead", () => {
  it("is acknowledged by its own confirmation, stamped, and by nothing else", async () => {
    await expect(verifyValuationLead()).resolves.toEqual({ ok: true });

    const [lead] = rows("enquiries");
    expect(lead.source).toBe("valuation");
    expect(lead.ack_sent_at).toEqual(expect.any(String));

    await everyTickForSixMinutes();

    expect(subjects()).toEqual(["Your valuation report is being prepared"]);
  });

  it("is not sent the generic acknowledgement when its confirmation fails", async () => {
    // The generic email is not what this visitor asked for, so it is no
    // stand-in for the one that failed.
    sendEmailMock.mockResolvedValueOnce({
      status: "error",
      message: "Resend is down",
    });
    await verifyValuationLead();

    const [lead] = rows("enquiries");
    expect(lead.ack_sent_at).toBeNull();

    await everyTickForSixMinutes();

    expect(subjects()).toEqual(["Your valuation report is being prepared"]);
  });
});

describe("the sweep", () => {
  /** A lead as the intake would have left it, created `ageMs` before now. */
  function seed(id: string, ageMs: number, overrides: Row = {}) {
    rows("enquiries").push({
      id,
      name: `Lead ${id}`,
      email: `${id}@example.com`,
      brief_raw: "Interested in a villa.",
      source: "property_page",
      form_key: "property_enquiry",
      locale: "en",
      property_id: null,
      created_at: new Date(Date.now() - ageMs).toISOString(),
      ack_sent_at: null,
      archived_at: null,
      ...overrides,
    });
  }

  beforeEach(() => {
    at(10 * MINUTE);
  });

  it("acknowledges only an unstamped lead between one and five minutes old", async () => {
    seed("due", 2 * MINUTE);
    seed("fresh", 10 * SECOND); // its inline send has not had its minute yet
    seed("stale", 6 * MINUTE); // past the window
    seed("stamped", 2 * MINUTE, { ack_sent_at: new Date().toISOString() });
    seed("archived", 2 * MINUTE, { archived_at: new Date().toISOString() });
    seed("valuation", 2 * MINUTE, { source: "valuation", form_key: null });

    await expect(sweep()).resolves.toEqual({ ok: true, scanned: 1, sent: 1 });
    expect(recipients()).toEqual(["due@example.com"]);
  });

  it("stamps and audits what it sends, so the next tick does not send it again", async () => {
    seed("due", 2 * MINUTE);

    await sweep();
    at(11 * MINUTE);
    await sweep();

    expect(recipients()).toEqual(["due@example.com"]);
    expect(rows("enquiries")[0].ack_sent_at).toEqual(expect.any(String));
    expect(rows("audit_log")).toEqual([
      expect.objectContaining({
        actor_kind: "system",
        action: "enquiry.auto_reply_sent",
        target_id: "due",
      }),
    ]);
  });

  it("leaves a lead unstamped when its send fails, and tries again next tick", async () => {
    seed("due", 2 * MINUTE);
    sendEmailMock.mockResolvedValueOnce({ status: "error", message: "Resend is down" });

    await expect(sweep()).resolves.toMatchObject({ sent: 0 });
    expect(rows("enquiries")[0].ack_sent_at).toBeNull();

    at(11 * MINUTE);
    await expect(sweep()).resolves.toMatchObject({ sent: 1 });
    expect(rows("enquiries")[0].ack_sent_at).toEqual(expect.any(String));
  });

  it("skips a lead with no email address", async () => {
    seed("phone-only", 2 * MINUTE, { email: null });

    await expect(sweep()).resolves.toEqual({ ok: true, scanned: 1, sent: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

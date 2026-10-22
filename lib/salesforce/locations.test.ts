import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./listings/fake-supabase";

const salesforceApexRequest = vi.fn();
const reportIssue = vi.fn();

class FakeSalesforceError extends Error {
  status: number;
  errorCode: string | null;
  retryable: boolean;
  constructor(
    message: string,
    o: { status: number; errorCode?: string | null; retryable: boolean },
  ) {
    super(message);
    this.status = o.status;
    this.errorCode = o.errorCode ?? null;
    this.retryable = o.retryable;
  }
}

vi.mock("./client", () => ({
  salesforceApexRequest,
  SalesforceError: FakeSalesforceError,
}));
vi.mock("@/lib/env", () => ({ env: {}, isSalesforceConfigured: true }));
vi.mock("@/lib/observability", () => ({ reportIssue }));

const { buildLocationRequest, drainLocationEvents, pushLocation, LOCATIONS_PATH } =
  await import("./locations");

const NOW = Date.parse("2026-10-22T10:00:00Z");
const now = () => NOW;
const PAST = "2026-10-22T09:00:00Z";
const FUTURE = "2026-10-22T11:00:00Z";

function event(id: string, payload: Record<string, unknown>, over: Record<string, unknown> = {}) {
  return { id, payload, state: "pending", attempts: 0, next_attempt_at: PAST, last_error: null, ...over };
}

let db: FakeDb;
// The fake covers exactly the query shapes the drain uses.
const admin = () => db.client() as unknown as Parameters<typeof drainLocationEvents>[0];

beforeEach(() => {
  db = new FakeDb();
  salesforceApexRequest.mockReset();
  reportIssue.mockReset();
});

describe("buildLocationRequest", () => {
  it("sends an added area as the API's UPSERT, with our event id", () => {
    const out = buildLocationRequest("e1", { action: "UPSERT", emirate: "Abu Dhabi", area: "Al Samha" });
    expect(out).toEqual({
      ok: true,
      body: { action: "UPSERT", eventId: "WEB-AREA-e1", emirate: "Abu Dhabi", area: "Al Samha" },
    });
  });

  it("sends a sub-area under its area", () => {
    const out = buildLocationRequest("e2", {
      action: "UPSERT",
      emirate: "Abu Dhabi",
      area: "Yas Island",
      subAreas: [" Yas Acres "],
    });
    expect(out.ok && out.body).toEqual({
      action: "UPSERT",
      eventId: "WEB-AREA-e2",
      emirate: "Abu Dhabi",
      area: "Yas Island",
      subAreas: ["Yas Acres"],
    });
  });

  it("sends a rename as REPLACE with the old name as `area`", () => {
    const out = buildLocationRequest("e3", {
      action: "REPLACE",
      emirate: "Abu Dhabi",
      area: "Al Samha",
      newArea: "Al Samha Updated",
    });
    expect(out.ok && out.body).toMatchObject({ action: "REPLACE", area: "Al Samha", newArea: "Al Samha Updated" });
  });

  it("refuses, with a reason, what the API would reject", () => {
    expect(buildLocationRequest("x", { action: "UPSERT", emirate: null, area: "Yas Island" }).ok).toBe(false);
    expect(buildLocationRequest("x", { action: "UPSERT", emirate: "Abu Dhabi", area: null, subAreas: ["A"] }).ok).toBe(false);
    expect(buildLocationRequest("x", { action: "REPLACE", emirate: "Abu Dhabi", area: "A", newArea: " " }).ok).toBe(false);
    // A delete has no verb in the API; it is never sent, even if re-queued.
    expect(buildLocationRequest("x", { action: "DELETE", emirate: "Abu Dhabi", area: "A" }).ok).toBe(false);
  });
});

describe("pushLocation", () => {
  const body = { action: "UPSERT" as const, eventId: "WEB-AREA-e1", emirate: "Abu Dhabi", area: "Al Samha" };

  it("posts the body to the Website Locations endpoint", async () => {
    salesforceApexRequest.mockResolvedValue({ status: "ok" });
    expect(await pushLocation(body)).toEqual({ ok: true, response: { status: "ok" } });
    expect(salesforceApexRequest).toHaveBeenCalledWith(LOCATIONS_PATH, { method: "POST", body });
  });

  it("reads a 200 that says it failed as a refusal", async () => {
    salesforceApexRequest.mockResolvedValue({ status: "error", message: "Emirate not found" });
    expect(await pushLocation(body)).toEqual({ ok: false, retryable: false, message: "Emirate not found" });
  });

  it("carries the client's retry verdict through", async () => {
    salesforceApexRequest.mockRejectedValue(new FakeSalesforceError("down", { status: 503, retryable: true }));
    expect(await pushLocation(body)).toMatchObject({ ok: false, retryable: true });
  });
});

describe("drainLocationEvents", () => {
  it("sends pending events oldest first and marks them sent", async () => {
    db.seed(
      "salesforce_location_events",
      event("e1", { action: "UPSERT", emirate: "Abu Dhabi", area: "Al Samha" }),
      event("e2", { action: "REPLACE", emirate: "Abu Dhabi", area: "Al Samha", newArea: "Al Samha Updated" }),
    );
    salesforceApexRequest.mockResolvedValue({ status: "ok" });

    const out = await drainLocationEvents(admin(), { now });

    expect(out).toMatchObject({ sent: 2, failed: 0, waiting: 0 });
    expect(salesforceApexRequest.mock.calls.map((c) => c[1].body.action)).toEqual(["UPSERT", "REPLACE"]);
    const rows = db.rows("salesforce_location_events");
    expect(rows.map((r) => r.state)).toEqual(["sent", "sent"]);
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].response).toEqual({ status: "ok" });
  });

  it("stops behind an event that must retry, so a rename never overtakes its add", async () => {
    db.seed(
      "salesforce_location_events",
      event("e1", { action: "UPSERT", emirate: "Abu Dhabi", area: "Al Samha" }),
      event("e2", { action: "REPLACE", emirate: "Abu Dhabi", area: "Al Samha", newArea: "Al Samha Updated" }),
    );
    salesforceApexRequest.mockRejectedValue(new FakeSalesforceError("down", { status: 503, retryable: true }));

    const out = await drainLocationEvents(admin(), { now });

    expect(out).toMatchObject({ sent: 0, waiting: 1 });
    expect(salesforceApexRequest).toHaveBeenCalledTimes(1);
    const [first, second] = db.rows("salesforce_location_events");
    expect(first).toMatchObject({ state: "pending", attempts: 1, last_error: "down" });
    expect(Date.parse(first.next_attempt_at as string)).toBeGreaterThan(NOW);
    expect(second).toMatchObject({ state: "pending", attempts: 0 });
  });

  it("waits while the oldest event is backing off", async () => {
    db.seed(
      "salesforce_location_events",
      event("e1", { action: "UPSERT", emirate: "Abu Dhabi", area: "A" }, { attempts: 1, next_attempt_at: FUTURE }),
      event("e2", { action: "UPSERT", emirate: "Abu Dhabi", area: "B" }),
    );
    const out = await drainLocationEvents(admin(), { now });
    expect(out.waiting).toBe(1);
    expect(salesforceApexRequest).not.toHaveBeenCalled();
  });

  it("fails and reports an event that cannot succeed, then carries on", async () => {
    db.seed(
      "salesforce_location_events",
      event("e1", { action: "UPSERT", emirate: null, area: "Orphan" }),
      event("e2", { action: "UPSERT", emirate: "Abu Dhabi", area: "Al Reem Island" }),
    );
    salesforceApexRequest.mockResolvedValue({ status: "ok" });

    const out = await drainLocationEvents(admin(), { now });

    expect(out).toMatchObject({ sent: 1, failed: 1 });
    const [orphan, reem] = db.rows("salesforce_location_events");
    expect(orphan.state).toBe("failed");
    expect(orphan.last_error).toMatch(/emirate/);
    expect(reem.state).toBe("sent");
    expect(salesforceApexRequest).toHaveBeenCalledTimes(1);
    expect(reportIssue).toHaveBeenCalledWith("Salesforce area sync gave up", expect.anything());
  });

  it("gives up after the fifth attempt", async () => {
    db.seed(
      "salesforce_location_events",
      event("e1", { action: "UPSERT", emirate: "Abu Dhabi", area: "A" }, { attempts: 4 }),
    );
    salesforceApexRequest.mockRejectedValue(new FakeSalesforceError("down", { status: 503, retryable: true }));
    const out = await drainLocationEvents(admin(), { now });
    expect(out.failed).toBe(1);
    expect(db.rows("salesforce_location_events")[0]).toMatchObject({ state: "failed", attempts: 5 });
  });

  it("leaves an event another sender has already claimed", async () => {
    // The other drain read the row at attempts 0 and claimed it (attempts 1)
    // before this one's claim lands.
    db.seed(
      "salesforce_location_events",
      event("e1", { action: "UPSERT", emirate: "Abu Dhabi", area: "A" }, { attempts: 1 }),
    );
    const staleRead = [event("e1", { action: "UPSERT", emirate: "Abu Dhabi", area: "A" })];
    const client = db.client();
    const racing = {
      ...client,
      from: (table: string) =>
        Object.assign(client.from(table), {
          limit: () => Promise.resolve({ data: staleRead, error: null }),
        }),
    } as unknown as Parameters<typeof drainLocationEvents>[0];

    const out = await drainLocationEvents(racing, { now });

    expect(out.sent).toBe(0);
    expect(salesforceApexRequest).not.toHaveBeenCalled();
    expect(db.rows("salesforce_location_events")[0].attempts).toBe(1);
  });
});

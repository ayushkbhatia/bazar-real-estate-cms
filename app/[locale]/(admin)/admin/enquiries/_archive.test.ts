/**
 * @vitest-environment node
 *
 * The enquiry archive, against a fake `enquiries` table. What is worth
 * pinning: only an admin may reach the action, archiving is reversible and
 * never touches the pipeline stage, every transition writes an audit row,
 * and an archived lead is frozen against the ordinary advisor actions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Enquiry = {
  id: string;
  name: string;
  status: string;
  temperature: string;
  assigned_agent_id: string | null;
  internal_notes: string | null;
  archived_at: string | null;
  archived_by: string | null;
};

const db: { enquiries: Enquiry[] } = { enquiries: [] };
type AuditEntry = { action: string; target_kind: string; target_id: string };
const { roleSpy, auditSpy } = vi.hoisted(() => ({
  roleSpy: vi.fn(),
  auditSpy: vi.fn(async (_entry: AuditEntry) => {}),
}));

/** Minimal PostgREST-shaped builder: eq / is / select / maybeSingle. */
function makeQuery(kind: "select" | "update", payload?: object) {
  const filters: [op: "eq" | "is", col: string, val: unknown][] = [];
  const matches = (row: Record<string, unknown>) =>
    filters.every(([op, col, val]) =>
      op === "eq" ? row[col] === val : row[col] === val,
    );

  function run() {
    const rows = db.enquiries.filter(
      matches as unknown as (e: Enquiry) => boolean,
    );
    if (kind === "update") rows.forEach((r) => Object.assign(r, payload));
    return { data: (rows.map((r) => ({ ...r }))[0] ?? null), error: null };
  }

  const q = {
    eq(col: string, val: unknown) {
      filters.push(["eq", col, val]);
      return q;
    },
    is(col: string, val: unknown) {
      filters.push(["is", col, val]);
      return q;
    },
    select() {
      return q;
    },
    maybeSingle() {
      return Promise.resolve(run());
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/audit", () => ({ logAudit: auditSpy }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email-templates", () => ({ staffReplyTemplate: vi.fn() }));
vi.mock("@/lib/whatsapp", () => ({ buildWhatsAppLink: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireRole: (...args: unknown[]) => roleSpy(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
    from: () => ({
      select: () => makeQuery("select"),
      update: (payload: object) => makeQuery("update", payload),
    }),
  }),
}));

import {
  assignEnquiryToMe,
  setEnquiryArchived,
  setEnquiryStatus,
  setEnquiryTemperature,
} from "./_actions";

const LEAD: Enquiry = {
  id: "e-1",
  name: "Layla Haddad",
  status: "offer",
  temperature: "hot",
  assigned_agent_id: null,
  internal_notes: null,
  archived_at: null,
  archived_by: null,
};

beforeEach(() => {
  db.enquiries = [{ ...LEAD }];
  roleSpy.mockReset().mockResolvedValue({});
  auditSpy.mockClear();
});

describe("archive", () => {
  it("is gated to admins, not to the wider write roles", async () => {
    await setEnquiryArchived("e-1", true);
    expect(roleSpy).toHaveBeenCalledWith(["admin"]);
  });

  it("files the lead, stamps who did it, and leaves the stage alone", async () => {
    const res = await setEnquiryArchived("e-1", true);
    expect(res.status).toBe("ok");
    expect(db.enquiries[0].archived_at).not.toBeNull();
    expect(db.enquiries[0].archived_by).toBe("admin-1");
    // The whole point of a timestamp over a seventh status: an archived
    // lead comes back at the stage it left.
    expect(db.enquiries[0].status).toBe("offer");
  });

  it("restores, clearing both columns together", async () => {
    await setEnquiryArchived("e-1", true);
    const back = await setEnquiryArchived("e-1", false);
    expect(back.status).toBe("ok");
    expect(db.enquiries[0].archived_at).toBeNull();
    expect(db.enquiries[0].archived_by).toBeNull();
  });

  it("audits both directions with distinct actions", async () => {
    await setEnquiryArchived("e-1", true);
    await setEnquiryArchived("e-1", false);
    const entries = auditSpy.mock.calls.map(([entry]) => entry);
    expect(entries.map((e) => e.action)).toEqual([
      "enquiry.archived",
      "enquiry.restored",
    ]);
    expect(entries[0].target_kind).toBe("enquiry");
    expect(entries[0].target_id).toBe("e-1");
  });

  it("refuses a second archive rather than moving the filing date", async () => {
    await setEnquiryArchived("e-1", true);
    const filedAt = db.enquiries[0].archived_at;
    auditSpy.mockClear();

    const again = await setEnquiryArchived("e-1", true);
    expect(again.status).toBe("error");
    expect(db.enquiries[0].archived_at).toBe(filedAt);
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it("refuses to restore something that was never archived", async () => {
    const res = await setEnquiryArchived("e-1", false);
    expect(res.status).toBe("error");
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it("reports a missing enquiry instead of silently succeeding", async () => {
    const res = await setEnquiryArchived("nope", true);
    expect(res.status).toBe("error");
  });
});

describe("an archived lead is frozen", () => {
  beforeEach(async () => {
    await setEnquiryArchived("e-1", true);
  });

  it("refuses a status change", async () => {
    const res = await setEnquiryStatus("e-1", "closed_won");
    expect(res.status).toBe("error");
    expect(db.enquiries[0].status).toBe("offer");
  });

  it("refuses a temperature change", async () => {
    const res = await setEnquiryTemperature("e-1", "cold");
    expect(res.status).toBe("error");
    expect(db.enquiries[0].temperature).toBe("hot");
  });

  it("refuses assignment", async () => {
    const res = await assignEnquiryToMe("e-1");
    expect(res.status).toBe("error");
    expect(db.enquiries[0].assigned_agent_id).toBeNull();
  });

  it("accepts all three again once restored", async () => {
    await setEnquiryArchived("e-1", false);
    expect((await setEnquiryStatus("e-1", "closed_won")).status).toBe("ok");
    expect((await setEnquiryTemperature("e-1", "cold")).status).toBe("ok");
    expect((await assignEnquiryToMe("e-1")).status).toBe("ok");
  });
});

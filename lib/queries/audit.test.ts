import { describe, it, expect } from "vitest";
import {
  parseAuditFilters,
  rowsToCsv,
  EMPTY_AUDIT_FILTERS,
  type AuditLogRow,
} from "./audit";

describe("parseAuditFilters", () => {
  it("returns nulls when input is empty", () => {
    expect(parseAuditFilters({})).toEqual(EMPTY_AUDIT_FILTERS);
  });

  it("trims string values", () => {
    const r = parseAuditFilters({
      q: "  property.publish  ",
      action: "  staff.invite  ",
    });
    expect(r.q).toBe("property.publish");
    expect(r.action).toBe("staff.invite");
  });

  it("coerces blank strings to null", () => {
    const r = parseAuditFilters({
      q: "",
      target_kind: "  ",
      actor_email: "",
    });
    expect(r.q).toBeNull();
    expect(r.target_kind).toBeNull();
    expect(r.actor_email).toBeNull();
  });

  it("picks the first element when an array slips through", () => {
    const r = parseAuditFilters({ q: ["first", "second"] });
    expect(r.q).toBe("first");
  });
});

describe("rowsToCsv", () => {
  function row(over: Partial<AuditLogRow>): AuditLogRow {
    return {
      id: "1",
      actor_id: null,
      actor_kind: "user",
      actor_email: "mariam@bazar.ae",
      actor_display_name: "Mariam Al-Hashimi",
      action: "property.publish",
      target_kind: "property",
      target_id: "abc",
      before: null,
      after: { status: "published" },
      at: "2026-05-21T10:00:00.000Z",
      ...over,
    };
  }

  it("emits a header row + one line per audit row", () => {
    const csv = rowsToCsv([row({}), row({ id: "2" })]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^at,actor_email/);
  });

  it("quotes cells containing commas or quotes", () => {
    const csv = rowsToCsv([
      row({ actor_display_name: "Doe, Jane", actor_email: 'he said "hi"' }),
    ]);
    expect(csv).toMatch(/"Doe, Jane"/);
    expect(csv).toMatch(/"he said ""hi"""/);
  });

  it("serialises object before/after cells as JSON", () => {
    const csv = rowsToCsv([
      row({
        before: { foo: 1 },
        after: { bar: 2 },
      }),
    ]);
    // The JSON has a `:` so it'll be present; check both serialisations land.
    expect(csv).toMatch(/"\{""foo"":1\}"/);
    expect(csv).toMatch(/"\{""bar"":2\}"/);
  });

  it("handles null cells as empty strings", () => {
    const csv = rowsToCsv([
      row({
        actor_id: null,
        actor_email: null,
        actor_display_name: null,
        before: null,
        after: null,
        target_kind: null,
        target_id: null,
      }),
    ]);
    const rowLine = csv.split("\n")[1];
    // 9 cells in the header → 8 commas separating them.
    const commaCount = (rowLine.match(/,/g) ?? []).length;
    expect(commaCount).toBe(8);
  });

  it("returns just the header for an empty input", () => {
    const csv = rowsToCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
    expect(csv).toMatch(/^at,/);
  });
});

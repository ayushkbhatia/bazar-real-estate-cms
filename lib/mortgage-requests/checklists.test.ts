import { describe, expect, it } from "vitest";
import { CHECKLISTS, checksComplete, missingChecks } from "./checklists";
import { DOC_KINDS } from "./documents";

describe("review checklists (SPEC §2.3)", () => {
  it("has a checklist for every document kind, with unique keys", () => {
    for (const kind of DOC_KINDS) {
      const list = CHECKLISTS[kind];
      expect(list.checks.length, kind).toBeGreaterThan(0);
      const keys = [...list.checks.map((c) => c.key), ...list.recorded.map((f) => f.key)];
      expect(new Set(keys).size, `${kind} repeats a key`).toBe(keys.length);
    }
  });

  it("marks the two designed checklists as designed and the rest as proposals", () => {
    const designed = DOC_KINDS.filter((k) => CHECKLISTS[k].status === "designed");
    expect(designed.sort()).toEqual(["bank_statements_12m", "salary_certificate"]);
  });

  it("carries C3's five salary-certificate checks and three pricing fields, verbatim", () => {
    expect(CHECKLISTS.salary_certificate.checks.map((c) => c.label)).toEqual([
      "Name matches the application",
      "Addressed to a bank",
      "Issued within the last 30 days",
      "Signed and stamped by the employer",
      "Monthly salary stated",
    ]);
    expect(CHECKLISTS.salary_certificate.recorded.map((f) => [f.label, f.type])).toEqual([
      ["Monthly gross salary", "aed"],
      ["Employed since", "month"],
      ["Employer", "text"],
    ]);
  });

  it("enables Accept only when every check is ticked", () => {
    const allButOne = {
      name_matches: true,
      addressed_to_bank: true,
      issued_recently: true,
      signed_and_stamped: true,
      salary_stated: false,
    };
    expect(checksComplete("salary_certificate", allButOne)).toBe(false);
    expect(missingChecks("salary_certificate", allButOne)).toEqual(["salary_stated"]);
    expect(checksComplete("salary_certificate", { ...allButOne, salary_stated: true })).toBe(true);
  });

  it("treats a missing or unknown value as not ticked", () => {
    expect(missingChecks("bank_statements_12m", null)).toEqual([
      "holder_matches",
      "issued_by_bank",
      "covers_period",
    ]);
    expect(checksComplete("passport", { name_matches: true, extra: true })).toBe(false);
  });
});

/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  contiguous,
  coverage,
  coveredMonths,
  formatMonthAbbrev,
  formatMonthProse,
  formatMonthShort,
  formatMonthSpan,
  formatPeriodChip,
  monthBounds,
  periodChoices,
} from "./coverage";
import { requiredStatementMonths } from "./documents";
import {
  codeHash,
  linkState,
  maskEmail,
  MAX_CODE_ATTEMPTS,
  newCode,
  replacesFiles,
  sessionCookieName,
  type LinkRow,
} from "./server/links";
import { hashToken } from "./server/tokens";

// Karim's twelve months (W8, C4): statements to the end of August 2026.
const TWELVE = requiredStatementMonths("bank_statements_12m", "2026-09-22T08:00:00Z");

describe("statement coverage (W8, C4)", () => {
  it("is the year before the submission, oldest first", () => {
    expect(TWELVE).toHaveLength(12);
    expect([TWELVE[0], TWELVE.at(-1)]).toEqual(["2025-09", "2026-08"]);
  });

  it("counts the months the periods cover, and names the ones missing", () => {
    const periods = [
      { from: "2025-09", to: "2025-11" },
      { from: "2025-12", to: "2026-02" },
      { from: "2026-03", to: "2026-05" },
    ];
    const cov = coverage(TWELVE, periods);
    expect(cov).toMatchObject({ have: 9, total: 12, complete: false, missing: ["2026-06", "2026-07", "2026-08"] });
    expect(cov.months.filter((m) => m.received)).toHaveLength(9);
    expect(coverage(TWELVE, [...periods, { from: "2026-06", to: "2026-08" }]).complete).toBe(true);
  });

  it("ignores a period without both ends, and months outside the year", () => {
    expect(coveredMonths([{ from: "2026-06", to: null }])).toEqual(new Set());
    expect(coverage(TWELVE, [{ from: "2024-01", to: "2025-08" }]).have).toBe(0);
    // Overlaps count once.
    expect(coverage(TWELVE, [{ from: "2025-09", to: "2026-01" }, { from: "2025-11", to: "2026-02" }]).have).toBe(6);
  });

  it("knows an unbroken run from a broken one", () => {
    expect(contiguous(["2025-11", "2025-12", "2026-01"])).toBe(true);
    expect(contiguous(["2025-11", "2026-01"])).toBe(false);
    expect(contiguous([])).toBe(true);
  });

  it("writes months the way the designs do", () => {
    expect(formatMonthSpan("2026-06", "2026-08")).toBe("Jun – Aug 2026");
    expect(formatMonthSpan("2025-09", "2026-05")).toBe("Sep 2025 – May 2026");
    expect(formatMonthSpan("2026-03", "2026-03")).toBe("Mar 2026");
    expect(formatPeriodChip("2025-09-01", "2025-11-30")).toBe("Sep–Nov 2025");
    expect(formatPeriodChip("2025-12-01", "2026-02-28")).toBe("Dec–Feb 2026");
    expect(formatMonthProse("2025-09", "2026-05")).toBe("September 2025 to May 2026");
    expect(formatMonthShort("2025-09")).toBe("Sep 2025");
    expect(formatMonthAbbrev("2025-09")).toBe("Sep");
  });

  it("gives a month's first and last day, leap years included", () => {
    expect(monthBounds("2026-02")).toEqual({ first: "2026-02-01", last: "2026-02-28" });
    expect(monthBounds("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(monthBounds("2026-12")).toEqual({ first: "2026-12-01", last: "2026-12-31" });
  });

  it("offers the required months and a year either side for a file's period", () => {
    const choices = periodChoices(TWELVE);
    expect(choices).toHaveLength(25);
    expect([choices[0], choices.at(-1)]).toEqual(["2024-09", "2026-09"]);
    expect(periodChoices([])).toEqual([]);
  });
});

describe("secure links (SPEC §8)", () => {
  const now = new Date("2026-09-28T10:00:00Z");
  const session = "a-session-token-for-this-browser";
  const base: LinkRow = {
    id: "1f0c8f2e-5a4b-4c3d-9e8f-7a6b5c4d3e2f",
    request_id: "2f0c8f2e-5a4b-4c3d-9e8f-7a6b5c4d3e2f",
    purpose: "reupload",
    document_id: "3f0c8f2e-5a4b-4c3d-9e8f-7a6b5c4d3e2f",
    expires_at: "2026-10-05T10:00:00Z",
    otp_attempts: 0,
    otp_sent_at: null,
    otp_channel: null,
    verified_at: null,
    used_at: null,
    revoked_at: null,
    created_by: null,
    created_at: "2026-09-28T09:00:00Z",
    draft_id: null,
    session_hash: null,
    session_expires_at: null,
  };
  const verified: LinkRow = {
    ...base,
    verified_at: "2026-09-28T09:30:00Z",
    session_hash: hashToken(session),
    session_expires_at: "2026-09-28T11:30:00Z",
  };

  it("never says which of unknown and cancelled a link is", () => {
    expect(linkState(null, now, null)).toBe("unavailable");
    expect(linkState({ ...base, revoked_at: "2026-09-28T09:40:00Z" }, now, null)).toBe("unavailable");
  });

  it("puts used before locked before expired", () => {
    const worn = { ...base, used_at: "2026-09-28T09:50:00Z", otp_attempts: MAX_CODE_ATTEMPTS, expires_at: "2026-09-01T00:00:00Z" };
    expect(linkState(worn, now, null)).toBe("used");
    expect(linkState({ ...worn, used_at: null }, now, null)).toBe("locked");
    expect(linkState({ ...worn, used_at: null, otp_attempts: MAX_CODE_ATTEMPTS - 1 }, now, null)).toBe("expired");
  });

  it("asks for a code until this browser's session matches, and again once it lapses", () => {
    expect(linkState(base, now, null)).toBe("code");
    expect(linkState(verified, now, session)).toBe("verified");
    expect(linkState(verified, now, "another-browsers-session-token")).toBe("code");
    expect(linkState(verified, now, null)).toBe("code");
    expect(linkState(verified, new Date("2026-09-28T11:31:00Z"), session)).toBe("code");
  });

  it("replaces a single-file document, or one that was wrong; adds to one short of pages or months", () => {
    expect(replacesFiles("salary_certificate", "pages_missing")).toBe(true);
    expect(replacesFiles("bank_statements_12m", "period_incomplete")).toBe(false);
    expect(replacesFiles("bank_statements_12m", "pages_missing")).toBe(false);
    expect(replacesFiles("bank_statements_3m", "unreadable")).toBe(true);
    expect(replacesFiles("emirates_id", "wrong_document")).toBe(true);
    expect(replacesFiles("emirates_id", "other")).toBe(false);
    expect(replacesFiles("trade_license", "expired")).toBe(true);
  });

  it("shows only enough of an address to know which inbox", () => {
    expect(maskEmail("karim.haddad@example.com")).toBe("k•••@example.com");
    expect(maskEmail("not-an-address")).toBe("•••");
  });

  it("salts each code with its link, so one leaked hash opens nothing else", () => {
    expect(codeHash(base.id, "246810")).toBe(codeHash(base.id, "246810"));
    expect(codeHash(base.id, "246810")).not.toBe(codeHash(base.request_id, "246810"));
    expect(codeHash(base.id, "246810")).toMatch(/^[0-9a-f]{64}$/);
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });

  it("names one cookie per link, so two links in one browser don't collide", () => {
    expect(sessionCookieName(base.id)).toBe("bz_mlink_1f0c8f2e5a4b");
    expect(sessionCookieName(base.id)).not.toBe(sessionCookieName(base.request_id));
  });
});

import { describe, expect, it } from "vitest";
import {
  neverRunIsMeaningful,
  isStale,
  parseDigestRecipients,
  staleAfterMinutes,
} from "./health";

const NOW = new Date("2026-09-24T07:00:00Z");
const ago = (mins: number) =>
  new Date(NOW.getTime() - mins * 60_000).toISOString();

describe("neverRunIsMeaningful", () => {
  it("says nothing when the scheduler has never run at all", () => {
    expect(neverRunIsMeaningful("post-valuation-nurture", null, NOW)).toBe(
      false,
    );
  });

  it("holds its tongue about a daily job on the first morning", () => {
    // The case this exists for. Deploy at 14:00, digest at 07:00 the next
    // day, post-valuation-nurture runs at 08:00 — it is not late, it is not
    // due. Reporting it mails three admins about a healthy job.
    expect(
      neverRunIsMeaningful("post-valuation-nurture", ago(17 * 60), NOW),
    ).toBe(false);
  });

  it("reports a daily job once a full day has passed without it", () => {
    expect(
      neverRunIsMeaningful("post-valuation-nurture", ago(25 * 60), NOW),
    ).toBe(true);
  });

  it("is quicker to complain about a frequent job", () => {
    // A five-minute job that has not stamped in twenty is a real problem,
    // where a daily one at the same age is simply not due.
    expect(neverRunIsMeaningful("enquiry-escalation", ago(20), NOW)).toBe(true);
    expect(
      neverRunIsMeaningful("post-valuation-nurture", ago(20), NOW),
    ).toBe(false);
  });
});

describe("isStale", () => {
  it("allows three missed runs before calling a frequent job late", () => {
    const hb = (mins: number) => ({
      job: "enquiry-escalation",
      last_run_at: ago(mins),
      last_ok: true,
      last_detail: null,
      consecutive_failures: 0,
    });
    expect(isStale(hb(10), NOW)).toBe(false);
    expect(isStale(hb(20), NOW)).toBe(true);
    expect(staleAfterMinutes("enquiry-escalation")).toBe(15);
  });

  it("gives a daily job six hours of slack", () => {
    expect(staleAfterMinutes("meilisearch-sync")).toBe(1800);
  });
});

describe("parseDigestRecipients", () => {
  it("is no override when unset or blank", () => {
    expect(parseDigestRecipients(undefined)).toEqual([]);
    expect(parseDigestRecipients("")).toEqual([]);
    expect(parseDigestRecipients(" , ")).toEqual([]);
  });

  it("splits, trims, lower-cases and de-duplicates", () => {
    expect(
      parseDigestRecipients(" A@example.com, b@example.com ;a@example.com\nc@example.org"),
    ).toEqual(["a@example.com", "b@example.com", "c@example.org"]);
  });

  it("drops anything not shaped like an address", () => {
    expect(parseDigestRecipients("nobody, a@example.com, x@y")).toEqual([
      "a@example.com",
    ]);
  });
});

import { describe, it, expect } from "vitest";
import {
  INVITE_EXPIRY_DAYS,
  linkState,
  linkStateMessage,
  type InvitationRow,
} from "./staff-invitations";

const NOW = Date.parse("2026-07-30T12:00:00Z");
const day = 86_400_000;

function row(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    email: "invitee@example.com",
    display_name: "Omar Hasan",
    role: "admin",
    expires_at: new Date(NOW + 7 * day).toISOString(),
    accepted_at: null,
    activated_at: null,
    ...overrides,
  };
}

describe("linkState", () => {
  it("accepts a fresh, unused invitation", () => {
    expect(linkState(row(), NOW)).toEqual({ usable: true });
  });

  it("rejects a token that matched nothing", () => {
    expect(linkState(null, NOW)).toEqual({
      usable: false,
      reason: "unknown",
    });
  });

  it("rejects an expired invitation", () => {
    const expired = row({ expires_at: new Date(NOW - day).toISOString() });
    expect(linkState(expired, NOW)).toEqual({
      usable: false,
      reason: "expired",
    });
  });

  it("treats the exact expiry instant as expired", () => {
    const boundary = row({ expires_at: new Date(NOW).toISOString() });
    expect(linkState(boundary, NOW).usable).toBe(false);
  });

  it("rejects a link that has already been used", () => {
    const used = row({ activated_at: new Date(NOW - day).toISOString() });
    expect(linkState(used, NOW)).toEqual({ usable: false, reason: "used" });
  });

  it("STILL accepts an invitation the trigger marked accepted", () => {
    // This is the bug the activated_at column exists for. The accept trigger
    // stamps accepted_at as soon as an auth user exists for the address, which
    // the old Supabase invite did at invite time — so an invitee who never got
    // a working link looked "done" and could never activate.
    const stranded = row({ accepted_at: new Date(NOW - day).toISOString() });
    expect(linkState(stranded, NOW)).toEqual({ usable: true });
  });

  it("prefers 'used' over 'expired' when both apply", () => {
    // Someone who activated and comes back weeks later should be told to sign
    // in, not to ask for a new link.
    const both = row({
      activated_at: new Date(NOW - 30 * day).toISOString(),
      expires_at: new Date(NOW - 10 * day).toISOString(),
    });
    expect(linkState(both, NOW)).toEqual({ usable: false, reason: "used" });
  });
});

describe("linkStateMessage", () => {
  it("tells a returning invitee to sign in", () => {
    expect(linkStateMessage("used")).toMatch(/sign in/i);
  });

  it("quotes the real expiry window", () => {
    expect(linkStateMessage("expired")).toContain(String(INVITE_EXPIRY_DAYS));
  });

  it("never leaves someone without a next step", () => {
    for (const reason of ["unknown", "expired", "used"] as const) {
      expect(linkStateMessage(reason)).toMatch(/administrator|sign in/i);
    }
  });
});

describe("INVITE_EXPIRY_DAYS", () => {
  it("matches the database default on staff_invitations", () => {
    // 0010 sets `expires_at default now() + interval '14 days'`. The email copy
    // used to claim 7 — this constant is what keeps the two honest.
    expect(INVITE_EXPIRY_DAYS).toBe(14);
  });
});

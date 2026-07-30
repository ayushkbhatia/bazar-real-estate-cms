import { describe, it, expect } from "vitest";
import {
  INVITE_EXPIRY_DAYS,
  accessLinkItem,
  activationCopy,
  linkState,
  linkStateMessage,
  purposeOf,
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

describe("purposeOf", () => {
  it("reads a reset row", () => {
    expect(purposeOf(row({ purpose: "reset" }))).toBe("reset");
  });

  it("defaults to invite for rows that predate the column", () => {
    expect(purposeOf(row({ purpose: null }))).toBe("invite");
    expect(purposeOf(row({ purpose: undefined }))).toBe("invite");
    expect(purposeOf(row())).toBe("invite");
  });

  it("refuses to invent a third purpose", () => {
    // A hand-edited or future value must not change the page's claims.
    expect(purposeOf(row({ purpose: "something-else" }))).toBe("invite");
  });

  it("handles a missing row", () => {
    expect(purposeOf(null)).toBe("invite");
  });
});

describe("activationCopy", () => {
  const opts = { firstName: "Omar", roleLabel: "Administrator" };

  it("welcomes a new invitee and explains the role", () => {
    const copy = activationCopy({ ...opts, purpose: "invite" });
    expect(copy.heading).toBe("Welcome, Omar.");
    expect(copy.lead).toContain("Administrator");
    expect(copy.lead).toMatch(/invited/i);
  });

  it("does not welcome an existing colleague back as a new hire", () => {
    const copy = activationCopy({ ...opts, purpose: "reset" });
    expect(copy.heading).toBe("Set a new password, Omar.");
    expect(copy.lead).not.toMatch(/invited/i);
    expect(copy.lead).toMatch(/unchanged/i);
  });

  it("labels the button for what it does in each case", () => {
    expect(activationCopy({ ...opts, purpose: "invite" }).submitLabel).toMatch(
      /^Set password/,
    );
    expect(activationCopy({ ...opts, purpose: "reset" }).submitLabel).toMatch(
      /^Save password/,
    );
  });
});

describe("linkStateMessage by purpose", () => {
  it("calls it an invitation for invites", () => {
    expect(linkStateMessage("expired", "invite")).toContain("invitation");
  });

  it("calls it a password link for resets", () => {
    const msg = linkStateMessage("expired", "reset");
    expect(msg).toContain("password link");
    expect(msg).not.toContain("invitation");
  });

  it("still quotes the real expiry window", () => {
    expect(linkStateMessage("expired", "reset")).toContain(
      String(INVITE_EXPIRY_DAYS),
    );
  });
});

describe("accessLinkItem", () => {
  it("offers to resend the invite to someone who has never signed in", () => {
    const item = accessLinkItem({
      hasSignedIn: false,
      email: "a@b.com",
      suspended: false,
    });
    expect(item).toEqual({ label: "Resend invite", suffix: "", disabled: false });
  });

  it("offers a password reset to someone who has", () => {
    const item = accessLinkItem({
      hasSignedIn: true,
      email: "a@b.com",
      suspended: false,
    });
    expect(item.label).toBe("Send password reset");
    expect(item.disabled).toBe(false);
  });

  it("disables it with a reason when there's no email", () => {
    const item = accessLinkItem({
      hasSignedIn: true,
      email: null,
      suspended: false,
    });
    expect(item.disabled).toBe(true);
    expect(item.suffix).toMatch(/no email/i);
  });

  it("disables it for a suspended account", () => {
    // A password link would hand back the access the suspension removed.
    const item = accessLinkItem({
      hasSignedIn: true,
      email: "a@b.com",
      suspended: true,
    });
    expect(item.disabled).toBe(true);
    expect(item.suffix).toMatch(/restore first/i);
  });

  it("reports the missing email first when both apply", () => {
    const item = accessLinkItem({
      hasSignedIn: false,
      email: null,
      suspended: true,
    });
    expect(item.suffix).toMatch(/no email/i);
  });

  it("never disables without explaining why", () => {
    for (const email of [null, "a@b.com"]) {
      for (const suspended of [true, false]) {
        for (const hasSignedIn of [true, false]) {
          const item = accessLinkItem({ hasSignedIn, email, suspended });
          if (item.disabled) expect(item.suffix.trim()).not.toBe("");
          else expect(item.suffix).toBe("");
        }
      }
    }
  });

  it("keeps the same wording the advisor profile panel uses", () => {
    // The two surfaces must not drift — an admin seeing "Resend invite" in one
    // place and something else in the other would assume they differ.
    expect(
      accessLinkItem({ hasSignedIn: false, email: "a@b.com", suspended: false })
        .label,
    ).toBe("Resend invite");
    expect(
      accessLinkItem({ hasSignedIn: true, email: "a@b.com", suspended: false })
        .label,
    ).toBe("Send password reset");
  });
});

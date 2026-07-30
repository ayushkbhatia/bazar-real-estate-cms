/**
 * Staff invitation link rules.
 *
 * Pure and dependency-free so the accept page, the server action behind it and
 * the tests all judge a token the same way. Getting this wrong in one place
 * means either a dead link or a reusable one.
 */

/** Matches the `expires_at` default on staff_invitations (0010). */
export const INVITE_EXPIRY_DAYS = 14;

/**
 * Why a token was issued (0065). Both let the holder set a password; they
 * differ in what the page says and whether the row counts as outstanding work
 * on Users & roles.
 */
export type InvitationPurpose = "invite" | "reset";

export type InvitationRow = {
  email: string;
  display_name: string;
  role: string;
  expires_at: string;
  /** Set by the accept trigger when the staff row is created (0010). */
  accepted_at: string | null;
  /** Set when the invitee sets a password via the link (0064). */
  activated_at: string | null;
  purpose?: string | null;
};

/** Narrow the stored text column, defaulting to the historical meaning. */
export function purposeOf(row: InvitationRow | null): InvitationPurpose {
  return row?.purpose === "reset" ? "reset" : "invite";
}

export type LinkState =
  | { usable: true }
  | { usable: false; reason: "unknown" | "expired" | "used" };

/**
 * Whether an accept link can still be used.
 *
 * Deliberately ignores `accepted_at`. That column is stamped as soon as an
 * auth.users row exists for the address, which the old Supabase-mailer flow did
 * at invite time — so treating it as "done" is what stranded invitations with a
 * staff row and no password. `activated_at` is the single-use marker.
 */
export function linkState(
  row: InvitationRow | null,
  nowMs: number,
): LinkState {
  if (!row) return { usable: false, reason: "unknown" };
  if (row.activated_at) return { usable: false, reason: "used" };
  if (new Date(row.expires_at).getTime() <= nowMs)
    return { usable: false, reason: "expired" };
  return { usable: true };
}

/** What to tell someone holding a link that doesn't work. */
export function linkStateMessage(
  reason: "unknown" | "expired" | "used",
  purpose: InvitationPurpose = "invite",
): string {
  const noun = purpose === "reset" ? "password link" : "invitation";
  switch (reason) {
    case "used":
      return `This ${noun} has already been used. Sign in with the password you set, or ask an administrator to send a new link.`;
    case "expired":
      return `This ${noun} has expired — links are valid for ${INVITE_EXPIRY_DAYS} days. Ask an administrator to send a new one.`;
    default:
      return `This ${noun} isn't valid. Check you opened the most recent email, or ask an administrator to send a new one.`;
  }
}

/** Headline + lead copy for the set-password page. */
export function activationCopy(opts: {
  purpose: InvitationPurpose;
  firstName: string;
  roleLabel: string;
}): { heading: string; lead: string; submitLabel: string } {
  if (opts.purpose === "reset") {
    return {
      heading: `Set a new password, ${opts.firstName}.`,
      lead: `Choose a new password for your Bazar admin account. Your ${opts.roleLabel} access is unchanged.`,
      submitLabel: "Save password and continue",
    };
  }
  return {
    heading: `Welcome, ${opts.firstName}.`,
    lead: `You've been invited to the Bazar admin console as ${opts.roleLabel}. Set a password to finish setting up your account.`,
    submitLabel: "Set password and continue",
  };
}

/**
 * The "send a password link" menu item, for one staff row.
 *
 * Extracted so the Users & roles dropdown and the Account access panel on the
 * advisor profile agree on the wording and on when the action is unavailable —
 * and so the reasons are testable rather than buried in JSX.
 *
 * A disabled item always states why. An option that is simply greyed out with
 * no explanation reads as a bug.
 */
export function accessLinkItem(opts: {
  hasSignedIn: boolean;
  email: string | null;
  suspended: boolean;
}): { label: string; suffix: string; disabled: boolean } {
  // Someone who has never signed in is still finishing their invitation;
  // someone who has is resetting a password they already had.
  const label = opts.hasSignedIn ? "Send password reset" : "Resend invite";
  if (!opts.email)
    return { label, suffix: " (no email on file)", disabled: true };
  // A password link for a suspended account would hand back the access the
  // suspension removed.
  if (opts.suspended)
    return { label, suffix: " (restore first)", disabled: true };
  return { label, suffix: "", disabled: false };
}

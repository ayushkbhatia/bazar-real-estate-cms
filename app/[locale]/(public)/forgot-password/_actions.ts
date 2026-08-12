"use server";

import { headers } from "next/headers";
import { issueStaffPasswordLink } from "@/lib/staff-password-link";
import { checkRateLimit, extractClientIp, rateLimitMessage } from "@/lib/rate-limit";

/**
 * Self-service password recovery for staff.
 *
 * This replaces the Supabase magic link, which used to be the only way back
 * into an account (/admin/login → /forgot-password → /magic-link). Retiring it
 * (plan decision D10) means Supabase Auth sends no email at all: everything now
 * goes through Resend, with no dependence on Supabase redirect config or its
 * auth-email rate limit.
 */

export type ForgotPasswordState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

/**
 * Always reports the same thing on success or on "no such account".
 *
 * The page is public and unauthenticated, so a truthful "that address isn't
 * staff" would turn it into a staff-directory oracle — anyone could enumerate
 * who works here. The email either arrives or it doesn't.
 */
const NEUTRAL =
  "If that address belongs to a Bazar staff account, a sign-in link is on its way. It expires in 14 days and can be used once.";

export async function requestStaffPasswordLink(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@"))
    return { status: "error", message: "Enter your work email address." };

  // Tight cap: this endpoint sends mail to an address chosen by the caller, so
  // it is the obvious lever for both mailbombing someone and probing which
  // addresses are staff.
  const rl = await checkRateLimit({
    name: "staff-password-link",
    ip: extractClientIp(await headers()),
    requests: 5,
    windowSeconds: 900,
  });
  if (!rl.ok)
    return { status: "error", message: rateLimitMessage(rl.retryAfterSeconds) };

  const result = await issueStaffPasswordLink({
    email,
    // Nobody else asked on their behalf.
    senderName: "You",
  });

  switch (result.status) {
    case "sent":
    case "no_such_staff":
      return { status: "sent", message: NEUTRAL };
    case "suspended":
      // Deliberately also neutral: revealing a suspension tells an outsider
      // that the address is staff.
      return { status: "sent", message: NEUTRAL };
    default:
      // A configuration failure is ours, not the visitor's, and saying
      // "check your inbox" when nothing was sent would strand them.
      console.error("[requestStaffPasswordLink]", result.message);
      return {
        status: "error",
        message:
          "Something went wrong sending that link. Ask an administrator to send you one instead.",
      };
  }
}

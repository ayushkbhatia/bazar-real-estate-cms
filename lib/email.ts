import "server-only";
import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";

const DEFAULT_FROM = "Bazar Real Estate <onboarding@resend.dev>";
const DEFAULT_REPLY_TO = "hello@bazar.ae";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Override the from address (defaults to RESEND_FROM_ADDRESS or onboarding@resend.dev). */
  from?: string;
  /** Override the reply-to (defaults to RESEND_REPLY_TO or hello@bazar.ae). */
  replyTo?: string;
};

export type SendEmailResult =
  | { status: "ok"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!isResendConfigured || !env.RESEND_API_KEY) return null;
  if (client) return client;
  client = new Resend(env.RESEND_API_KEY);
  return client;
}

/**
 * Turn Resend's two configuration failures into something an admin can act on.
 *
 * Both are silent traps rather than crashes: the call returns an error, the UI
 * says "email failed", and nothing explains that the account simply isn't set
 * up to mail strangers yet.
 *
 *  · With no verified sending domain, Resend accepts mail only to the address
 *    that owns the account. Every invitation, password link and reply to a real
 *    client is refused. `RESEND_FROM_ADDRESS` being unset is the tell — sends
 *    then go out as onboarding@resend.dev, which is Resend's sandbox sender.
 *  · A `from` on an unverified domain is rejected outright.
 */
export function explainResendError(message: string): string {
  const m = message.toLowerCase();
  const usingSandbox = !env.RESEND_FROM_ADDRESS;
  if (
    m.includes("testing email") ||
    m.includes("own email address") ||
    m.includes("only send")
  ) {
    return `${message} — Resend has no verified sending domain on this account, so it only accepts mail to the account owner's own address. Verify a domain and set RESEND_FROM_ADDRESS to send to anyone else.`;
  }
  if (m.includes("domain") && (m.includes("verif") || m.includes("not found"))) {
    return `${message} — verify the sending domain in Resend, then set RESEND_FROM_ADDRESS to an address on it.`;
  }
  if (usingSandbox) {
    return `${message} — note RESEND_FROM_ADDRESS is unset, so this went out from Resend's sandbox sender (onboarding@resend.dev), which can only deliver to the account owner.`;
  }
  return message;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping",
      input.subject,
      "to",
      input.to,
    );
    return { status: "skipped", reason: "RESEND_API_KEY not set" };
  }

  try {
    const result = await resend.emails.send({
      from: input.from ?? env.RESEND_FROM_ADDRESS ?? DEFAULT_FROM,
      to: [input.to],
      replyTo: input.replyTo ?? env.RESEND_REPLY_TO ?? DEFAULT_REPLY_TO,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (result.error) {
      console.warn("[email] Resend error", result.error.message);
      return { status: "error", message: explainResendError(result.error.message) };
    }
    if (!result.data?.id) {
      return { status: "error", message: "Resend returned no message id." };
    }
    return { status: "ok", id: result.data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[email] Resend threw", message);
    return { status: "error", message };
  }
}

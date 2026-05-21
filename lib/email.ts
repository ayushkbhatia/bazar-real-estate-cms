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
      return { status: "error", message: result.error.message };
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

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseEmailEvent,
  verifyResendSignature,
} from "@/lib/newsletter/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend's delivery events (docs/NEWSLETTER.md, "Delivery events"): delivered,
 * bounced and complained, for every email the site sends. Each one is handed
 * to `newsletter_record_email_event()` (0164), which stamps the newsletter
 * delivery it belongs to, marks a hard-bounced address `bounced` and
 * unsubscribes someone who reported a newsletter as spam.
 *
 * The signature is the only authorisation: without `RESEND_WEBHOOK_SECRET`
 * nothing is trusted. Answers are 2xx for anything that should not be retried
 * (including events this ignores) and 5xx only when the write failed, which
 * Resend then retries — the function is safe to run twice.
 */
export async function POST(req: NextRequest) {
  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "not configured" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const signed = verifyResendSignature(
    body,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    env.RESEND_WEBHOOK_SECRET,
  );
  if (!signed) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad json" },
      { status: 400 },
    );
  }
  const event = parseEmailEvent(payload);
  if (!event) return NextResponse.json({ ok: true, matched: "ignored" });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, reason: "no service role" },
      { status: 503 },
    );
  }

  const { data, error } = await admin.rpc("newsletter_record_email_event", {
    p_email_id: event.emailId,
    p_type: event.type,
    p_recipients: event.recipients,
    p_permanent: event.permanent,
    p_at: event.at,
  });
  if (error) {
    // The message id only — never the recipients.
    await reportError(error, {
      source: "webhooks.resend",
      context: { type: event.type, emailId: event.emailId },
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, matched: data });
}

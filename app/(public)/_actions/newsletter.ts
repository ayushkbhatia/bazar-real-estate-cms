"use server";

import { headers } from "next/headers";
import {
  generateConfirmationToken,
  newsletterSignupSchema,
  normaliseEmail,
} from "@/lib/schemas/newsletter";
import {
  adminSupabase,
  getSubscriberByEmail,
} from "@/lib/queries/newsletter";
import { isSupabaseConfigured, env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import {
  newsletterConfirmTemplate,
  newsletterWelcomeTemplate,
} from "@/lib/newsletter-templates";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import {
  subscribeToNewsletter as syncToMailchimp,
  unsubscribeFromNewsletter as removeFromMailchimp,
} from "@/lib/mailchimp";

function siteUrl(): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae"
  ).replace(/\/+$/, "");
}

export type SubscribeResult =
  | { status: "ok"; message: string }
  | { status: "already_confirmed"; message: string }
  | { status: "error"; message: string };

export async function subscribeToNewsletter(
  raw: Record<string, unknown>,
): Promise<SubscribeResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Subscriptions are offline." };

  const rl = await checkRateLimit({
    name: "newsletter",
    ip: extractClientIp(await headers()),
    requests: 10,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    return { status: "error", message: rateLimitMessage(rl.retryAfterSeconds) };
  }

  const parsed = newsletterSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const email = normaliseEmail(parsed.data.email);
  const source = parsed.data.source;

  // If they're already confirmed, short-circuit politely.
  const existing = await getSubscriberByEmail(email);
  if (existing?.status === "confirmed") {
    return {
      status: "already_confirmed",
      message: "You're already subscribed. Thank you.",
    };
  }

  const admin = await adminSupabase();
  if (!admin)
    return {
      status: "error",
      message: "Subscriptions are offline.",
    };

  const token = generateConfirmationToken();
  const confirmUrl = `${siteUrl()}/newsletter/confirm/${token}`;

  // Upsert a pending row. If they were unsubscribed, we re-issue a token.
  const { data: row, error } = await admin
    .from("newsletter_subscribers")
    .upsert(
      {
        email,
        status: "pending",
        source,
        confirmation_token: token,
        subscribed_at: new Date().toISOString(),
        confirmed_at: null,
        unsubscribed_at: null,
      },
      { onConflict: "email" },
    )
    .select("id")
    .maybeSingle();

  if (error || !row) {
    return {
      status: "error",
      message: error?.message ?? "Could not save your address.",
    };
  }

  const template = newsletterConfirmTemplate({ email, confirmUrl });
  const send = await sendEmail({
    to: email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });

  if (send.status === "error") {
    // Don't reveal the error directly; the row exists and they can retry.
    console.warn("[newsletter] confirm send failed", send.message);
  }

  return {
    status: "ok",
    message: "Check your inbox to confirm — link valid for 14 days.",
  };
}

export type ConfirmResult =
  | { status: "ok"; email: string }
  | { status: "expired" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function confirmNewsletterToken(
  token: string,
): Promise<ConfirmResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Subscriptions are offline." };
  if (!/^[0-9a-f]{48}$/.test(token)) return { status: "not_found" };

  const admin = await adminSupabase();
  if (!admin) return { status: "error", message: "Subscriptions are offline." };

  const { data: row } = await admin
    .from("newsletter_subscribers")
    .select(
      "id, email, status, subscribed_at, confirmation_token",
    )
    .eq("confirmation_token", token)
    .maybeSingle();
  if (!row) return { status: "not_found" };

  // 14-day token TTL.
  const subscribedAt = new Date(row.subscribed_at).getTime();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  if (Date.now() - subscribedAt > fourteenDaysMs && row.status !== "confirmed") {
    return { status: "expired" };
  }

  if (row.status !== "confirmed") {
    const { error } = await admin
      .from("newsletter_subscribers")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmation_token: null,
      })
      .eq("id", row.id);
    if (error) return { status: "error", message: error.message };

    const unsubscribeUrl = `${siteUrl()}/newsletter/unsubscribe/${token}`;
    const template = newsletterWelcomeTemplate({ unsubscribeUrl });
    await sendEmail({
      to: row.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    // BF-6: sync confirmed subscriber to Mailchimp. Fire-and-forget so
    // a failed Mailchimp call doesn't block the welcome email. With
    // doubleOptIn=false because Bazar's own confirm step is the
    // double-opt-in checkpoint.
    void syncToMailchimp({
      email: row.email,
      doubleOptIn: false,
      tags: ["bazar-confirmed"],
    });
  }

  return { status: "ok", email: row.email };
}

export type UnsubscribeResult =
  | { status: "ok"; email: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function unsubscribeNewsletterToken(
  token: string,
): Promise<UnsubscribeResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Subscriptions are offline." };
  if (!/^[0-9a-f]{48}$/.test(token)) return { status: "not_found" };

  const admin = await adminSupabase();
  if (!admin) return { status: "error", message: "Subscriptions are offline." };

  const { data: row } = await admin
    .from("newsletter_subscribers")
    .select("id, email, status")
    .eq("confirmation_token", token)
    .maybeSingle();
  if (!row) return { status: "not_found" };

  if (row.status !== "unsubscribed") {
    const { error } = await admin
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return { status: "error", message: error.message };

    // BF-6: mirror the opt-out to Mailchimp. Fire-and-forget.
    void removeFromMailchimp(row.email);
  }

  return { status: "ok", email: row.email };
}

/** Used by the signed-in /account/newsletter page to toggle subscription
 *  without needing the email token (the account_id link or row email match
 *  the auth.uid()). */
export type AccountUnsubscribeResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };


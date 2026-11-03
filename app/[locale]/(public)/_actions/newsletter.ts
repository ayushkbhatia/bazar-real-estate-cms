"use server";

import { headers } from "next/headers";
import { captureFormSubmission, withLabels } from "@/lib/forms/record";
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
  newsletterConfirmationEmail,
  newsletterWelcomeEmail,
} from "@/lib/content-assets/system-emails";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import { classifyRawSubmission, isDotPaddedGmail } from "@/lib/forms/spam";

/** What every signup is told, a bot's included — it learns nothing from the answer. */
const CHECK_INBOX = "Check your inbox to confirm — link valid for 14 days.";

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

  // The minute stops a burst; the hour and the day stop a script that paces
  // itself. Nobody subscribes to one newsletter more than a few times a day.
  const ip = extractClientIp(await headers());
  for (const [name, requests, windowSeconds] of [
    ["newsletter", 10, 60],
    ["newsletter_hour", 4, 3600],
    ["newsletter_day", 8, 86_400],
  ] as const) {
    const rl = await checkRateLimit({ name, ip, requests, windowSeconds });
    if (!rl.ok) {
      return { status: "error", message: rateLimitMessage(rl.retryAfterSeconds) };
    }
  }

  const parsed = newsletterSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const email = normaliseEmail(parsed.data.email);

  // A bot's signup is answered like anyone's and goes no further: no row, and
  // above all no confirmation email, because the address is usually a
  // stranger's. Unlike a held lead there is nothing to restore — a person
  // the check gets wrong can sign up again from another box or address.
  // The honeypot and timing ride in from the signup box; a missing value is
  // no evidence (see classifySubmission).
  if (classifyRawSubmission(raw).spam || isDotPaddedGmail(email)) {
    console.info("[newsletter.spam] dropped a signup");
    return { status: "ok", message: CHECK_INBOX };
  }
  const source = parsed.data.source;
  const locale = parsed.data.locale;

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
        locale,
        confirmation_token: token,
        subscribed_at: new Date().toISOString(),
        confirmation_sent_at: new Date().toISOString(),
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

  const template = await newsletterConfirmationEmail({ email, confirmUrl }, locale);
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

  // Logged for /admin/forms → Responses so the signup box shows a response
  // count alongside every other form. `newsletter_subscribers` stays the list
  // of record — this is the record of the *submission*, not of consent.
  await captureFormSubmission({
    formKey: "insights_newsletter",
    sourcePath: `newsletter:${source}`,
    data: withLabels({ email }, { email: "Email" }),
  });

  return { status: "ok", message: CHECK_INBOX };
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
      "id, email, status, subscribed_at, confirmation_token, locale, unsubscribe_token",
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

    // The subscriber's permanent token, not the confirmation one: confirming
    // clears that, which left every welcome email's unsubscribe link dead.
    const unsubscribeUrl = `${siteUrl()}${row.locale === "ar" ? "/ar" : ""}/newsletter/unsubscribe/${row.unsubscribe_token}`;
    // The subscriber signed up in one language and clicked a link minutes
    // later; the welcome follows the signup, not the click.
    const template = await newsletterWelcomeEmail(
      { unsubscribeUrl },
      row.locale === "ar" ? "ar" : "en",
    );
    await sendEmail({
      to: row.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
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

  // The permanent unsubscribe token first (every newsletter and welcome email
  // since 0162); then the confirmation token, for a link sent before it.
  const { data: byUnsubscribe } = await admin
    .from("newsletter_subscribers")
    .select("id, email, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  const row =
    byUnsubscribe ??
    (
      await admin
        .from("newsletter_subscribers")
        .select("id, email, status")
        .eq("confirmation_token", token)
        .maybeSingle()
    ).data;
  if (!row) return unsubscribeListContact(admin, token);

  if (row.status !== "unsubscribed") {
    const { error } = await admin
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return { status: "error", message: error.message };
  }

  return { status: "ok", email: row.email };
}

/**
 * A custom list's contact unsubscribing (0176). Marking the row unsubscribed
 * is enough: a trigger suppresses the address everywhere — every other list
 * it is on, and the subscription if it has one.
 */
async function unsubscribeListContact(
  admin: NonNullable<Awaited<ReturnType<typeof adminSupabase>>>,
  token: string,
): Promise<UnsubscribeResult> {
  const { data: contact } = await admin
    .from("newsletter_list_contacts")
    .select("id, email, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (!contact) return { status: "not_found" };
  if (contact.status === "active") {
    const { error } = await admin
      .from("newsletter_list_contacts")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("id", contact.id);
    if (error) return { status: "error", message: error.message };
  }
  return { status: "ok", email: contact.email };
}

/** Used by the signed-in /account/newsletter page to toggle subscription
 *  without needing the email token (the account_id link or row email match
 *  the auth.uid()). */
export type AccountUnsubscribeResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };


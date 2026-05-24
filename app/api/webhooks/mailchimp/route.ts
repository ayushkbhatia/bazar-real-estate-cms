/**
 * Sprint 13 — Mailchimp webhook receiver.
 *
 * Handles unsubscribe + cleaned + profile-update events. Verified via
 * the shared secret in the URL path (`?secret=<env>`). Updates the
 * Bazar `newsletter_subscribers` row so the in-app list matches
 * Mailchimp's truth.
 *
 * Mailchimp pings this with a GET when configuring the webhook to
 * validate reachability; we respond 200 OK without side effects.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { verifyMailchimpWebhook } from "@/lib/mailchimp";
import type { Database } from "@/db/types";

function adminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Service-role Supabase not configured");
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Mailchimp pings GET to validate the URL before enabling the webhook.
export async function GET() {
  return NextResponse.json({ ok: true, hint: "mailchimp webhook ready" });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!verifyMailchimpWebhook(secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: { type?: string; data?: Record<string, string> };
  // Mailchimp sends application/x-www-form-urlencoded with bracketed
  // keys (`type`, `data[email]`, etc.). Parse manually.
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    payload = {
      type: params.get("type") ?? undefined,
      data: Object.fromEntries(
        Array.from(params.entries())
          .filter(([k]) => k.startsWith("data["))
          .map(([k, v]) => [k.slice(5, -1), v]),
      ),
    };
  } catch {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }

  const email = payload.data?.email?.toLowerCase();
  const type = payload.type;
  if (!email || !type) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, skipped: "no supabase" });
  }

  try {
    const supabase = adminClient();
    if (type === "unsubscribe" || type === "cleaned") {
      await supabase
        .from("newsletter_subscribers")
        .update({ status: "unsubscribed" })
        .eq("email", email);
    } else if (type === "subscribe") {
      await supabase
        .from("newsletter_subscribers")
        .update({ status: "confirmed" })
        .eq("email", email);
    }
    return NextResponse.json({ ok: true, type });
  } catch (err) {
    console.error("[webhooks/mailchimp]", err);
    return NextResponse.json(
      { ok: false, reason: (err as Error).message },
      { status: 500 },
    );
  }
}

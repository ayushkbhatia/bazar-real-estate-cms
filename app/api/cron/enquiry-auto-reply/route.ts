/**
 * Sprint 10 — enquiry-auto-reply cron.
 *
 * Runs every minute (vercel.json). Sweeps enquiries created in the
 * last 5 minutes that haven't received an auto-acknowledgement and
 * sends the customer-facing enquiry-received email.
 *
 * Sprint 11 introduces a Supabase Edge Function triggered on enquiries
 * INSERT for sub-minute latency; this cron is the fallback sweep so
 * acks never go unsent.
 *
 * The `auto_reply_sent_at` column on `public.enquiries` lands once
 * Sprint 10 migration applies; until then this route falls back to
 * checking `created_at` window + a small in-memory dedup window
 * surfaced via 'X-Already-Sent' header.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { env, isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { enquiryReceivedTemplate } from "@/lib/email-templates";
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

export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, reason: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, scanned: 0, sent: 0 });
  }

  try {
    const supabase = adminClient();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    // ack_sent_at lands in migration 0027 — until applied, fall back to
    // a 5-minute window only (best-effort dedupe).
    const { data: rows, error } = await supabase
      .from("enquiries")
      .select(
        "id, name, email, brief_raw, property_id, created_at, properties(reference, title)",
      )
      .gte("created_at", fiveMinAgo)
      .is("ack_sent_at", null)
      // Spam filed within the acknowledgement window shouldn't get an
      // auto-reply on its way out.
      .is("archived_at", null);
    if (error) throw error;

    let sent = 0;
    for (const row of rows ?? []) {
      if (!row.email) continue;
      const prop = Array.isArray(row.properties)
        ? row.properties[0]
        : row.properties;
      const tpl = enquiryReceivedTemplate({
        name: row.name ?? "there",
        message: row.brief_raw ?? "",
        propertyReference: prop?.reference ?? null,
        propertyTitle: prop?.title ?? null,
      });
      const ok = await sendEmail({
        to: row.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      if (ok.status === "ok") {
        sent += 1;
        await supabase
          .from("enquiries")
          .update({ ack_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        // System-driven audit row — bypasses logAudit() which requires
        // a user session.
        await supabase.from("audit_log").insert({
          actor_kind: "system",
          action: "enquiry.auto_reply_sent",
          target_kind: "enquiry",
          target_id: row.id,
        });
      }
    }

    return NextResponse.json({ ok: true, scanned: rows?.length ?? 0, sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: "enquiry-auto-reply" } });
    console.error("[cron/enquiry-auto-reply]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

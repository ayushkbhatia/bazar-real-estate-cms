/**
 * enquiry-auto-reply — the fallback acknowledgement sweep.
 *
 * Runs every minute (vercel.json). A lead is acknowledged by the intake action
 * that wrote it — `createEnquiry`, `submitServiceLead`, `submitListingLead` —
 * which sends the email inline and stamps `ack_sent_at` when it goes out
 * (lib/enquiry-acknowledgement.ts). This route sends the same email to any
 * lead still without that stamp: the ones whose inline send failed or was
 * skipped. It is the fallback, not a second sender, so it:
 *
 *   · leaves a new lead alone for GRACE_MS, so the inline send has finished
 *     and stamped before the sweep looks. A tick landing between the insert
 *     and the stamp would otherwise send it again;
 *   · looks back WINDOW_MS, so a lead nobody could mail is retried for a few
 *     minutes and then left to the desk;
 *   · never acknowledges a valuation lead. /api/valuation-lead confirms those
 *     with an email of its own, stamped the same way; this one on top would be
 *     a second email and the wrong one, and is no stand-in if that one fails.
 *
 * The pg_net → Edge Function path from 0030 would be a third sender, which is
 * why it stays undeployed.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordHeartbeat, reportError } from "@/lib/observability";
import { env, isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { enquiryAcknowledgementEmail } from "@/lib/content-assets/system-emails";
import type { Database } from "@/db/types";

/** How far back the sweep looks for an unacknowledged lead. */
const WINDOW_MS = 5 * 60 * 1000;
/** How long a new lead is left to its intake's own send. That takes seconds. */
const GRACE_MS = 60 * 1000;

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
    const now = Date.now();
    const { data: rows, error } = await supabase
      .from("enquiries")
      .select(
        "id, name, email, brief_raw, source, form_key, locale, property_id, created_at, properties(reference, title)",
      )
      .gte("created_at", new Date(now - WINDOW_MS).toISOString())
      .lte("created_at", new Date(now - GRACE_MS).toISOString())
      .is("ack_sent_at", null)
      .neq("source", "valuation")
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
      const tpl = await enquiryAcknowledgementEmail({
        name: row.name ?? "there",
        message: row.brief_raw ?? "",
        propertyReference: prop?.reference ?? null,
        propertyTitle: prop?.title ?? null,
        source: row.source,
        // The lead carries the form it came from (0128), so a swept lead gets
        // the reply the inline send would have chosen rather than the general
        // acknowledgement.
        formKey: row.form_key,
        locale: row.locale,
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

    await recordHeartbeat("enquiry-auto-reply", {
      ok: true,
      detail: `sent ${sent}`,
    });
    return NextResponse.json({ ok: true, scanned: rows?.length ?? 0, sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await reportError(err, { source: "cron/enquiry-auto-reply" });
    await recordHeartbeat("enquiry-auto-reply", { ok: false, detail: message });
    console.error("[cron/enquiry-auto-reply]", message);
    return NextResponse.json({ ok: false, reason: message }, { status: 500 });
  }
}

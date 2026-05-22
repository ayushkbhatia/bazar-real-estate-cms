/**
 * Sprint 10 — permit-expiry cron.
 *
 * Runs daily at 06:00. Two responsibilities:
 *  1) Email admins about published listings whose
 *     `listing_permit_expires_at` falls within the next 30 days.
 *  2) Auto-archive listings whose permit has already expired (status
 *     → 'archived', plus an audit row).
 *
 * One mailing per listing per window — dedup via the audit log:
 * we skip a listing if an audit row with
 * action='property.permit_warning' fired in the last 7 days.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { permitExpiryWarningTemplate } from "@/lib/email-templates";
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
    return NextResponse.json({ ok: true, warned: 0, archived: 0 });
  }

  try {
    const supabase = adminClient();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const in30 = new Date(now.getTime() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    // Resolve admin emails up-front.
    const { data: admins } = await supabase
      .from("staff")
      .select("user_id, display_name")
      .eq("status", "active")
      .eq("role", "admin");
    const adminEmails: string[] = [];
    for (const a of admins ?? []) {
      const { data: u } = await supabase.auth.admin.getUserById(a.user_id);
      if (u?.user?.email) adminEmails.push(u.user.email);
    }

    // 1) Listings expiring in next 30d.
    const { data: expiring } = await supabase
      .from("properties")
      .select("id, reference, listing_permit_no, listing_permit_expires_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("listing_permit_expires_at", today)
      .lte("listing_permit_expires_at", in30);

    // Skip listings we've already warned about this week.
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const ids = (expiring ?? []).map((e) => e.id);
    const { data: recent } = await supabase
      .from("audit_log")
      .select("target_id")
      .eq("action", "property.permit_warning")
      .gte("at", weekAgo)
      .in("target_id", ids);
    const skip = new Set((recent ?? []).map((r) => r.target_id));

    let warned = 0;
    for (const row of expiring ?? []) {
      if (skip.has(row.id)) continue;
      if (!row.listing_permit_no || !row.listing_permit_expires_at) continue;
      const days = Math.max(
        0,
        Math.ceil(
          (new Date(row.listing_permit_expires_at).getTime() -
            now.getTime()) /
            86_400_000,
        ),
      );
      const tpl = permitExpiryWarningTemplate({
        propertyReference: row.reference,
        permitNumber: row.listing_permit_no,
        expiresAt: row.listing_permit_expires_at,
        daysToExpiry: days,
      });
      for (const email of adminEmails) {
        await sendEmail({
          to: email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
      }
      await supabase.from("audit_log").insert({
        actor_kind: "system",
        action: "property.permit_warning",
        target_kind: "property",
        target_id: row.id,
      });
      warned += 1;
    }

    // 2) Auto-archive already-expired permits.
    const { data: expired } = await supabase
      .from("properties")
      .select("id, reference")
      .eq("status", "published")
      .is("deleted_at", null)
      .lt("listing_permit_expires_at", today);

    let archived = 0;
    for (const row of expired ?? []) {
      const { error: updErr } = await supabase
        .from("properties")
        .update({ status: "archived" })
        .eq("id", row.id);
      if (!updErr) {
        archived += 1;
        await supabase.from("audit_log").insert({
          actor_kind: "system",
          action: "property.auto_archived_permit_expired",
          target_kind: "property",
          target_id: row.id,
        });
      }
    }

    return NextResponse.json({ ok: true, warned, archived });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/permit-expiry]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

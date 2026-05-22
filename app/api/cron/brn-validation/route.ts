/**
 * Sprint 10 — BRN validation cron.
 *
 * Runs daily at 06:00. Two responsibilities:
 *  1) Roll license statuses forward (active → expiring_soon → expired)
 *     via lib/queries/licenses.refreshLicenseStatuses().
 *  2) For BRN licenses now in 'expiring_soon' (< 30 days), send the
 *     agent + admins the brnExpiryWarning email.
 *
 * Publish-time gating against expired BRNs lives in the property edit
 * action; this cron is the proactive warning path.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { brnExpiryWarningTemplate } from "@/lib/email-templates";
import { s8 } from "@/lib/supabase/sprint-8";
import type { LicenseRow } from "@/lib/types/sprint-8";
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
    return NextResponse.json({ ok: true, refreshed: 0, warned: 0 });
  }

  try {
    const supabase = adminClient();
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);

    // 1) Roll status forward.
    await s8(supabase)
      .from("licenses")
      .update({ status: "expired" })
      .lt("expires_at", now.toISOString())
      .in("status", ["active", "expiring_soon"]);
    await s8(supabase)
      .from("licenses")
      .update({ status: "expiring_soon" })
      .gte("expires_at", now.toISOString())
      .lt("expires_at", in30.toISOString())
      .eq("status", "active");

    // 2) Notify BRN holders newly in expiring_soon.
    const { data: licenses } = await s8(supabase)
      .from("licenses")
      .select("*")
      .eq("kind", "brn")
      .eq("holder_kind", "staff")
      .eq("status", "expiring_soon");
    const rows = (licenses as LicenseRow[] | null) ?? [];

    let warned = 0;
    for (const lic of rows) {
      if (!lic.holder_id) continue;
      const { data: staff } = await supabase
        .from("staff")
        .select("display_name")
        .eq("user_id", lic.holder_id)
        .maybeSingle();
      if (!staff) continue;
      const { data: u } = await supabase.auth.admin.getUserById(
        lic.holder_id,
      );
      const email = u?.user?.email;
      if (!email) continue;
      const daysToExpiry = Math.max(
        0,
        Math.ceil(
          (new Date(lic.expires_at).getTime() - now.getTime()) / 86_400_000,
        ),
      );
      const tpl = brnExpiryWarningTemplate({
        agentName: staff.display_name,
        brn: lic.number,
        expiresAt: lic.expires_at,
        daysToExpiry,
      });
      const ok = await sendEmail({
        to: email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      if (ok.status === "ok") warned += 1;
    }

    return NextResponse.json({ ok: true, scanned: rows.length, warned });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/brn-validation]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

/**
 * Sprint 10 — post-valuation nurture cron.
 *
 * Runs daily at 08:00. For each valuation_request that was sent at
 * T-7 days (and hasn't received a day-7 nurture), email the
 * valuationNurtureDay7Template. Same for T-30 with day30 template.
 *
 * Idempotency: nurture_day7_at / nurture_day30_at fields on
 * valuation_requests (added in migration 0027). Until the migration
 * applies, the s8() escape-hatch lets the update typecheck and the
 * column-not-yet-present case fails gracefully (single-day re-sends
 * possible during the gap).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import {
  valuationNurtureDay7Template,
  valuationNurtureDay30Template,
} from "@/lib/email-templates";
import { s8 } from "@/lib/supabase/sprint-8";
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

function dayWindow(daysAgo: number): { start: string; end: string } {
  const now = Date.now();
  const start = new Date(now - (daysAgo + 1) * 86_400_000).toISOString();
  const end = new Date(now - daysAgo * 86_400_000).toISOString();
  return { start, end };
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
    return NextResponse.json({ ok: true, day7: 0, day30: 0 });
  }

  try {
    const supabase = adminClient();
    let day7 = 0;
    let day30 = 0;

    // Day 7
    {
      const w = dayWindow(7);
      const { data } = await s8(supabase)
        .from("valuation_requests")
        .select(
          "id, owner_name, owner_email, estimate_mid_aed, sent_at, nurture_day7_at",
        )
        .gte("sent_at", w.start)
        .lt("sent_at", w.end)
        .is("nurture_day7_at", null);
      for (const r of data ?? []) {
        if (!r.owner_email) continue;
        const tpl = valuationNurtureDay7Template({
          name: r.owner_name ?? "there",
          valuationId: r.id,
          estimateMid: r.estimate_mid_aed,
        });
        const sent = await sendEmail({
          to: r.owner_email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
        if (sent.status === "ok") {
          day7 += 1;
          await s8(supabase)
            .from("valuation_requests")
            .update({ nurture_day7_at: new Date().toISOString() })
            .eq("id", r.id);
        }
      }
    }

    // Day 30
    {
      const w = dayWindow(30);
      const { data } = await s8(supabase)
        .from("valuation_requests")
        .select("id, owner_name, owner_email, sent_at, nurture_day30_at")
        .gte("sent_at", w.start)
        .lt("sent_at", w.end)
        .is("nurture_day30_at", null);
      for (const r of data ?? []) {
        if (!r.owner_email) continue;
        const tpl = valuationNurtureDay30Template({
          name: r.owner_name ?? "there",
          valuationId: r.id,
        });
        const sent = await sendEmail({
          to: r.owner_email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
        if (sent.status === "ok") {
          day30 += 1;
          await s8(supabase)
            .from("valuation_requests")
            .update({ nurture_day30_at: new Date().toISOString() })
            .eq("id", r.id);
        }
      }
    }

    return NextResponse.json({ ok: true, day7, day30 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/post-valuation-nurture]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

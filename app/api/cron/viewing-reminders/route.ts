import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAgentOfUpcomingViewing } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/viewing-reminders
 *
 * Fires hourly. For every viewing scheduled in [now+90min, now+150min]
 * that hasn't already received a 2-hour reminder, emit a notification to
 * the agent linked to its enquiry. The 60-minute window absorbs the
 * scheduling tolerance — we only ever notify once per viewing because we
 * key off `notifications.payload.viewing_id`.
 */
export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return new Response(
      JSON.stringify({ ok: false, reason: "CRON_SECRET not configured" }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      },
    );
  }
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return new Response(
      JSON.stringify({
        skipped: true,
        reason: "service role missing",
      }),
      { headers: { "content-type": "application/json" } },
    );
  }

  const now = Date.now();
  const windowStart = new Date(now + 90 * 60_000).toISOString();
  const windowEnd = new Date(now + 150 * 60_000).toISOString();

  const { data: viewings, error } = await admin
    .from("viewings")
    .select(
      "id, enquiry_id, scheduled_for, status, enquiries:enquiry_id(assigned_agent_id, properties:property_id(title))",
    )
    .in("status", ["tentative", "confirmed"])
    .gte("scheduled_for", windowStart)
    .lt("scheduled_for", windowEnd);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  let emitted = 0;
  let skipped = 0;
  for (const v of viewings ?? []) {
    const raw = v as unknown as {
      id: string;
      enquiry_id: string | null;
      scheduled_for: string;
      enquiries: {
        assigned_agent_id: string | null;
        properties: { title: string | null } | null;
      } | null;
    };
    const agentId = raw.enquiries?.assigned_agent_id ?? null;
    if (!agentId) {
      skipped++;
      continue;
    }

    // Skip if we've already emitted a reminder for this viewing.
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("kind", "viewing_reminder")
      .contains("payload", { viewing_id: raw.id })
      .limit(1);
    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    await notifyAgentOfUpcomingViewing({
      agent_user_id: agentId,
      viewing_id: raw.id,
      enquiry_id: raw.enquiry_id,
      scheduled_for: raw.scheduled_for,
      property_title: raw.enquiries?.properties?.title ?? null,
    });
    emitted++;
  }

  return new Response(
    JSON.stringify({
      window_start: windowStart,
      window_end: windowEnd,
      considered: viewings?.length ?? 0,
      emitted,
      skipped,
    }),
    { headers: { "content-type": "application/json" } },
  );
}

function isAuthorized(req: NextRequest): boolean {
  // Bearer CRON_SECRET only. The `x-vercel-cron` header is set by
  // Vercel's cron runner but is forwarded as-is from the caller, so
  // it's trivially spoofable from outside Vercel — never trust it.
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${env.CRON_SECRET}`;
}

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { recordHeartbeat, reportError } from "@/lib/observability";
import { purgeExpiredDrafts } from "@/lib/mortgage-requests/server/drafts";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { deliverNotifications } from "@/lib/mortgage-requests/server/notify";
import { slaTick } from "@/lib/mortgage-requests/server/sla-tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The mortgage module's background work (docs/mortgage/IMPLEMENTATION.md §1.8):
 *   · purge upload drafts nobody submitted within 24 hours, objects and all —
 *     Supabase Storage has no lifecycle rules to do it;
 *   · check every running 24-hour promise and raise the at-risk and missed
 *     alarms, once each (sla-tick.ts, 0143) — here rather than in a cron of
 *     its own, so the alerts it queues go out below in the same run and the
 *     module costs one invocation every five minutes, not two;
 *   · send what the notification outbox still holds: a confirmation whose
 *     send right after the submit failed or never ran (0141), and the team's
 *     alerts (0143).
 * Every five minutes.
 */
export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ ok: false, reason: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, reason: "Unauthorized" }, { status: 401 });
  }

  try {
    const deps = mortgageDeps();
    const purged = await purgeExpiredDrafts(deps, { limit: 100 });
    const sla = await slaTick({ db: deps.db });
    const notified = await deliverNotifications({ db: deps.db }, { limit: 40 });
    await recordHeartbeat("mortgage-worker", {
      ok: true,
      detail: `purged ${purged.drafts} drafts; promises ${sla.checked} checked, ${sla.atRisk} at risk, ${sla.breached} missed; notified ${notified.sent} sent, ${notified.skipped} skipped, ${notified.failed} failed`,
    });
    return NextResponse.json({ ok: true, purged, sla, notified });
  } catch (error) {
    await reportError(error, { source: "cron.mortgage-worker" });
    await recordHeartbeat("mortgage-worker", { ok: false, detail: "failed" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

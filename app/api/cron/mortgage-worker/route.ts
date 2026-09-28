import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { recordHeartbeat, reportError } from "@/lib/observability";
import { purgeExpiredDrafts, scanPending } from "@/lib/mortgage-requests/server/drafts";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The mortgage module's background work (docs/mortgage/IMPLEMENTATION.md §1.8):
 *   · scan files whose inline scan couldn't run (scanner down, or none yet);
 *   · purge upload drafts nobody submitted within 24 hours, objects and all —
 *     Supabase Storage has no lifecycle rules to do it.
 * Every five minutes for now; the notification outbox joins it in Phase 3.
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
    const scans = await scanPending(deps, { limit: 20 });
    const purged = await purgeExpiredDrafts(deps, { limit: 100 });
    await recordHeartbeat("mortgage-worker", {
      ok: true,
      detail: `scanned ${scans.clean} clean, ${scans.rejected} rejected, ${scans.waiting} waiting; purged ${purged.drafts} drafts`,
    });
    return NextResponse.json({ ok: true, scans, purged });
  } catch (error) {
    await reportError(error, { source: "cron.mortgage-worker" });
    await recordHeartbeat("mortgage-worker", { ok: false, detail: "failed" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

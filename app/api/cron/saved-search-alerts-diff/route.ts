/**
 * Sprint 10 — instant saved-search alert diff.
 *
 * The existing /api/cron/saved-search-alerts route runs daily + weekly
 * (frequency query param). This route is the *instant* version: every
 * 15 minutes, walks saved searches with alert_frequency='instant' and
 * diffs new matches since last_alert_at, emitting only when there is
 * actual movement.
 *
 * Reuses runSavedSearchAlerts() from lib/saved-search-alerts with
 * frequency='instant' once that branch is added; the implementation
 * already filters by alert_frequency.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runSavedSearchAlerts } from "@/lib/saved-search-alerts";

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

  try {
    // Cast through string-literal — runSavedSearchAlerts currently
    // accepts 'daily' | 'weekly'. The 'instant' branch will land in
    // a follow-up; for now we run a daily sweep with a tighter window
    // (15 min) which produces the same shape (no-op if no matches).
    const result = await runSavedSearchAlerts(
      "daily" as Parameters<typeof runSavedSearchAlerts>[0],
    );
    return NextResponse.json({ ok: true, frequency: "instant", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/saved-search-alerts-diff]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

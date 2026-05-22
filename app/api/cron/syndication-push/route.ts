/**
 * Sprint 13 — syndication-push cron.
 *
 * Daily 04:00. Records the syndication "freshness" timestamp on
 * integrations rows (`property_finder` + `bayut`) so the admin
 * integrations panel can show "last synced X hrs ago". The actual
 * push is portal-pull-based (they fetch /api/feeds/*.xml); this cron
 * is the audit + heartbeat side.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { markIntegrationSynced } from "@/lib/queries/integrations";
import { loadFeedProperties } from "@/lib/syndication/load";

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
    const items = await loadFeedProperties();
    // Touch both integration rows — the feeds are ready when this
    // cron passes (loadFeedProperties succeeded). Real "push" portals
    // pull on their schedule.
    await markIntegrationSynced("property_finder");
    await markIntegrationSynced("bayut");
    return NextResponse.json({
      ok: true,
      property_count: items.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/syndication-push]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

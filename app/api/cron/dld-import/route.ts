/**
 * Sprint 13 — DLD comparables import cron.
 *
 * Weekly (Monday 05:00). Pulls the CSV configured on the
 * `dld_open_data` integration row + replaces the last-12-months
 * snapshot in `dld_comparables`.
 */

import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { importDldComparables } from "@/lib/dld-comparables";

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
    const result = await importDldComparables();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: "dld-import" } });
    console.error("[cron/dld-import]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

/**
 * Sprint 13 — DLD comparables import cron.
 *
 * Weekly (Monday 05:00). Pulls the CSV configured on the
 * `dld_open_data` integration row + replaces the last-12-months
 * snapshot in `dld_comparables`.
 */

import { NextResponse, type NextRequest } from "next/server";
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
  const result = await importDldComparables();
  return NextResponse.json(result);
}

/**
 * Quarterly market-reports refresh cron.
 *
 * v1: the `/market-reports/[area]/[type]/[quarter]` route is fully derived
 * from `dld_comparables` at request time, so this cron is a no-op stub that
 * exists to:
 *   1. Reserve the route name for when we materialise snapshots later.
 *   2. Invalidate the ISR cache on the 1st of each quarter so the index
 *      surfaces the new reportable quarter the moment the lag rolls over.
 *
 * Scheduled in `vercel.json`. Guarded by Bearer secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    // In dev with no secret, allow run.  In prod a missing secret means the
    // cron is misconfigured — refuse so we don't leak unintended writes.
    if (env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 },
      );
    }
  } else if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bust the ISR cache for the index and a representative detail path so
  // the next visitor sees the new quarter pinned.
  try {
    revalidatePath("/market-reports");
  } catch (err) {
    Sentry.captureException(err, {
      tags: { cron: "market-reports-refresh" },
    });
    console.error("[cron/market-reports-refresh]", err);
  }

  return NextResponse.json({
    ok: true,
    refreshed_at: new Date().toISOString(),
    note: "v1 derives reports live from dld_comparables; materialisation deferred.",
  });
}

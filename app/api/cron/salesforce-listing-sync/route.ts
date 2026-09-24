/**
 * Salesforce listing sync — every listing the CRM publishes to the website.
 *
 * Reads `Property_Listing__c` where `Website_Status__c = 'Published'`, joined
 * to its property details on `Listing__c`, and keeps `properties` in step:
 * creates what is new, corrects what drifted, copies photos, and takes down
 * what Salesforce says is no longer published. All of it lives in
 * lib/salesforce/listings/sync.ts; this route is the door.
 *
 * Every fifteen minutes. Listings are not leads — nobody is waiting on a
 * confirmation screen — and an admin who needs one sooner has "Sync now".
 * The same credentials as the lead push: one Connected App, one integration
 * user, read access to the two listing objects.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { runListingSync } from "@/lib/salesforce/listings/sync";

/** A run budgets its photo copying to ~35s; the rest is headroom. */
export const maxDuration = 60;

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
    return NextResponse.json({ ok: true, skipped: "no supabase" });
  }

  const summary = await runListingSync({ trigger: "cron" });
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}

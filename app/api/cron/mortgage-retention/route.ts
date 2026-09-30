import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { recordHeartbeat, reportError } from "@/lib/observability";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { purgeRetainedFiles } from "@/lib/mortgage-requests/server/retention";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The mortgage module's retention purge (SPEC §5 `retention.purge`,
 * docs/mortgage/IMPLEMENTATION.md §1.15): closed requests' files, once
 * `retention_months` have passed since they closed. Does nothing while the
 * months are unset (D7), and says so on the health page. Daily.
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
    const { settings } = await loadMortgageSettings(deps.db);
    const report = await purgeRetainedFiles(deps, { months: settings.retention_months ?? null });
    await recordHeartbeat("mortgage-retention", {
      ok: true,
      detail:
        report.months === null
          ? "retention not set (D7): nothing deleted"
          : `deleted ${report.files} files of requests closed over ${report.months} months ago${report.remaining ? "; more remain for the next run" : ""}`,
    });
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    await reportError(error, { source: "cron.mortgage-retention" });
    await recordHeartbeat("mortgage-retention", { ok: false, detail: "failed" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

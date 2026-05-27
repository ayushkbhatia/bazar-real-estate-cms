import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { runSavedSearchAlerts } from "@/lib/saved-search-alerts";

// Vercel Cron Jobs send an Authorization: Bearer <CRON_SECRET> header.
// Reject anything else. Fail closed when the secret isn't configured —
// anonymous callers see 401, not 503, so we don't leak server-side
// configuration state. Ops sees the misconfig via the console.error.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    if (!env.CRON_SECRET) {
      console.error(
        "[cron/saved-search-alerts] CRON_SECRET not configured — rejecting all requests",
      );
    }
    return NextResponse.json(
      { ok: false, reason: "Unauthorized" },
      { status: 401 },
    );
  }

  const frequency =
    req.nextUrl.searchParams.get("frequency") === "weekly"
      ? "weekly"
      : "daily";

  try {
    const result = await runSavedSearchAlerts(frequency);
    return NextResponse.json({ ok: true, frequency, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, {
      tags: { cron: "saved-search-alerts", frequency },
    });
    console.error("[cron/saved-search-alerts]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

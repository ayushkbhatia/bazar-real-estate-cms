import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runSavedSearchAlerts } from "@/lib/saved-search-alerts";

// Vercel Cron Jobs send an Authorization: Bearer <CRON_SECRET> header.
// Reject anything else.
export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
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
    console.error("[cron/saved-search-alerts]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

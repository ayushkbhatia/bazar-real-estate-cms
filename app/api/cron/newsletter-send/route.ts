import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { recordHeartbeat, reportError } from "@/lib/observability";
import { runNewsletterSender } from "@/lib/newsletter/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The newsletter sender (docs/NEWSLETTER.md): starts scheduled campaigns whose
 * time has come, drains queued deliveries in Resend batches, and closes
 * campaigns with nothing left. Every minute; a run with nothing to do is one
 * claim that returns no rows.
 */
export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ ok: false, reason: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, reason: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runNewsletterSender({ deadlineMs: 45_000 });
    const busy = report.batches > 0 || report.started.length > 0 || report.finished.length > 0;
    await recordHeartbeat("newsletter-send", {
      ok: true,
      detail: busy
        ? `started ${report.started.length}, sent ${report.sent}, skipped ${report.skipped}, failed ${report.failed}, retrying ${report.retried}, finished ${report.finished.length}`
        : "nothing to send",
    });
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    await reportError(error, { source: "cron.newsletter-send" });
    await recordHeartbeat("newsletter-send", { ok: false, detail: "failed" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

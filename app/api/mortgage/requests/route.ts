import { after, type NextRequest } from "next/server";
import { extractClientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit, readJson, requireFlag } from "@/lib/mortgage-requests/server/http";
import { deliverNotifications } from "@/lib/mortgage-requests/server/notify";
import { submitBodySchema, submitRequest } from "@/lib/mortgage-requests/server/submit";
import { bearerToken } from "@/lib/mortgage-requests/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mortgage/requests — submit a Mortgage Consultancy request (W3) or
 * a Fast Pre-Approval application (W5/W6). SPEC §4.2.
 *
 * Headers: `Idempotency-Key` (a UUID the browser made with the wizard state),
 * and for a pre-approval `Authorization: Bearer <draft token>`.
 * Answers `{ reference, service, submittedAt, dueAt }`: 201 when this call
 * made the request, 200 when it repeats one that already succeeded.
 *
 * The confirmation email goes after the response (`after`), so the applicant
 * isn't kept waiting on Resend; the mortgage-worker cron retries it if it
 * doesn't go.
 */
export async function POST(req: NextRequest) {
  return handle("mortgage.requests.submit", async () => {
    const deps = mortgageDeps();
    await requireFlag(deps.db);
    const ip = extractClientIp(req.headers);
    await rateLimit("mortgage-submit", ip, 10, 3600);
    const body = await readJson(req, submitBodySchema());

    const result = await submitRequest(deps, {
      body,
      idempotencyKey: req.headers.get("idempotency-key"),
      draftToken: bearerToken(req.headers),
      ip: ip === "unknown" ? null : ip,
      userAgent: req.headers.get("user-agent"),
    });

    after(async () => {
      try {
        await deliverNotifications({ db: deps.db }, { requestId: result.requestId });
      } catch (error) {
        // The cron retries; this only makes the failure visible.
        await reportError(error, { source: "mortgage.requests.notify", context: { requestId: result.requestId } });
      }
    });

    return json(
      {
        reference: result.reference,
        service: result.service,
        submittedAt: result.submittedAt,
        dueAt: result.dueAt,
      },
      result.created ? 201 : 200,
    );
  });
}

import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { extractClientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { MortgageApiError } from "@/lib/mortgage-requests/server/errors";
import { handle, json, rateLimit, readJson } from "@/lib/mortgage-requests/server/http";
import { linkKey, sessionLink } from "@/lib/mortgage-requests/server/link-http";
import { fulfilReupload, inviteReplay, submitInvite } from "@/lib/mortgage-requests/server/links";
import { deliverNotifications } from "@/lib/mortgage-requests/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Body = z.object({
  /** The files the applicant sees as ready: only these are sent. */
  fileIds: z.array(z.string().regex(UUID, "invalid")).min(1).max(30),
  /** The invite only: the same consent as W5/W6. */
  consent: z.object({ given: z.literal(true), wordingVersion: z.string().max(40) }).optional(),
});

/**
 * POST /api/mortgage/links/:token/submit — send the re-upload (the file goes
 * back to review and the promise resumes), or apply through a pre-approval
 * invite (a new request, linked to the consultancy). The team is told after
 * the answer; the worker retries a failed send.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handle("mortgage.links.submit", async () => {
    const { token } = await ctx.params;
    const deps = mortgageDeps();
    await rateLimit("mortgage-link-submit", linkKey(token), 10, 3600);
    const header = req.headers.get("idempotency-key");
    const key = header && UUID.test(header) ? header.toLowerCase() : null;
    // A retry of an invite that already went through gets its application back.
    const replay = key ? await inviteReplay(deps.db, token, key) : null;
    if (replay) return json({ reference: replay.reference, submittedAt: replay.submittedAt, dueAt: replay.dueAt }, 201);
    const link = await sessionLink(req, token, deps);
    const body = await readJson(req, Body);

    let requestId: string;
    let payload: Record<string, unknown>;
    if (link.purpose === "reupload") {
      const done = await fulfilReupload(deps, link, body.fileIds);
      requestId = done.requestId;
      payload = { sent: true };
    } else {
      if (!body.consent) throw new MortgageApiError(422, "invalid", "consent is required", {}, "consent");
      const created = await submitInvite(deps, link, {
        fileIds: body.fileIds,
        consentVersion: body.consent.wordingVersion,
        submissionKey: key ?? crypto.randomUUID(),
        ip: extractClientIp(req.headers),
        userAgent: req.headers.get("user-agent"),
      });
      requestId = created.requestId;
      payload = { reference: created.reference, submittedAt: created.submittedAt, dueAt: created.dueAt };
    }

    after(async () => {
      try {
        await deliverNotifications({ db: deps.db }, { requestId });
      } catch (error) {
        await reportError(error, { source: "mortgage.links.notify" });
      }
    });
    return json(payload, 201);
  });
}

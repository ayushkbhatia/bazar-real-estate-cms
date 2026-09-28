import type { NextRequest } from "next/server";
import { z } from "zod";
import { extractClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { createDraft } from "@/lib/mortgage-requests/server/drafts";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { MortgageApiError } from "@/lib/mortgage-requests/server/errors";
import { handle, json, rateLimit, readJson, requireFlag } from "@/lib/mortgage-requests/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ turnstileToken: z.string().max(4096).optional() });

/** POST /api/mortgage/drafts — a new upload draft for a Fast Pre-Approval (SPEC §4.2). */
export async function POST(req: NextRequest) {
  return handle("mortgage.drafts.create", async () => {
    const deps = mortgageDeps();
    await requireFlag(deps.db);
    const ip = extractClientIp(req.headers);
    await rateLimit("mortgage-draft", ip, 10, 3600);
    const body = await readJson(req, Body);
    const bot = await verifyTurnstile(body.turnstileToken, ip);
    if (!bot.ok) {
      throw bot.reason === "not_configured"
        ? new MortgageApiError(503, "not_configured")
        : new MortgageApiError(403, "bot_check_failed");
    }
    return json(await createDraft(deps, { ip: ip === "unknown" ? null : ip }), 201);
  });
}

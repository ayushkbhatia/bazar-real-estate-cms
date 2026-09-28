import type { NextRequest } from "next/server";
import { extractClientIp } from "@/lib/rate-limit";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit } from "@/lib/mortgage-requests/server/http";
import { linkKey } from "@/lib/mortgage-requests/server/link-http";
import { sendLinkCode } from "@/lib/mortgage-requests/server/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mortgage/links/:token/otp — send a 6-digit code to the applicant
 * on file (SPEC §4.2, §8). One a minute per link (the database holds the
 * cooldown), and a ceiling per network. Not behind the public flag: a link is
 * sent to one applicant already in the system, and turning intake off mustn't
 * strand them.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handle("mortgage.links.otp", async () => {
    const { token } = await ctx.params;
    await rateLimit("mortgage-link-otp", extractClientIp(req.headers), 10, 3600);
    await rateLimit("mortgage-link-otp-link", linkKey(token), 6, 3600);
    return json(await sendLinkCode(mortgageDeps(), token));
  });
}

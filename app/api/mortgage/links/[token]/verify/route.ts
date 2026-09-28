import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extractClientIp } from "@/lib/rate-limit";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, rateLimit, readJson } from "@/lib/mortgage-requests/server/http";
import { sessionCookie } from "@/lib/mortgage-requests/server/link-http";
import { verifyLinkCode } from "@/lib/mortgage-requests/server/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().max(12) });

/**
 * POST /api/mortgage/links/:token/verify — check the code; a right one sets
 * the session cookie for this link (SPEC §8). Five wrong codes lock the link.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handle("mortgage.links.verify", async () => {
    const { token } = await ctx.params;
    await rateLimit("mortgage-link-verify", extractClientIp(req.headers), 30, 3600);
    const { code } = await readJson(req, Body);
    const verified = await verifyLinkCode(mortgageDeps(), token, code.replace(/\s+/g, ""));
    const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
    const cookie = sessionCookie(verified.linkId, verified.session, verified.expiresAt);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  });
}

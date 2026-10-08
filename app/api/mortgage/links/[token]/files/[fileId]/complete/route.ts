import type { NextRequest } from "next/server";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit } from "@/lib/mortgage-requests/server/http";
import { linkKey, sessionLink } from "@/lib/mortgage-requests/server/link-http";
import { completeLinkFile } from "@/lib/mortgage-requests/server/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reads up to 40 MB and parses PDFs.
export const maxDuration = 60;

/** POST — check the uploaded bytes, as for a draft (SPEC §4.2). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string; fileId: string }> }) {
  return handle("mortgage.links.complete", async () => {
    const { token, fileId } = await ctx.params;
    const deps = mortgageDeps();
    await rateLimit("mortgage-link-complete", linkKey(token), 60, 600);
    const link = await sessionLink(req, token, deps);
    return json(await completeLinkFile(deps, link, fileId));
  });
}

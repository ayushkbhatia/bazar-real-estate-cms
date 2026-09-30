import type { NextRequest } from "next/server";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit } from "@/lib/mortgage-requests/server/http";
import { linkKey, sessionLink } from "@/lib/mortgage-requests/server/link-http";
import { deleteLinkFile, linkFileStatus } from "@/lib/mortgage-requests/server/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string; fileId: string }> };

/** GET — where an upload stands (a scan still running). */
export async function GET(req: NextRequest, ctx: Params) {
  return handle("mortgage.links.status", async () => {
    const { token, fileId } = await ctx.params;
    const deps = mortgageDeps();
    await rateLimit("mortgage-link-status", linkKey(token), 240, 600);
    const link = await sessionLink(req, token, deps);
    return json(await linkFileStatus(deps, link, fileId));
  });
}

/** DELETE — cancel an upload or take a file back before sending. */
export async function DELETE(req: NextRequest, ctx: Params) {
  return handle("mortgage.links.delete", async () => {
    const { token, fileId } = await ctx.params;
    const deps = mortgageDeps();
    await rateLimit("mortgage-link-delete", linkKey(token), 60, 600);
    const link = await sessionLink(req, token, deps);
    await deleteLinkFile(deps, link, fileId);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  });
}

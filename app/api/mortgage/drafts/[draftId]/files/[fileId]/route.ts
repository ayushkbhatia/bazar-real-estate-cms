import type { NextRequest } from "next/server";
import { deleteFile, fileStatus } from "@/lib/mortgage-requests/server/drafts";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit, requireFlag } from "@/lib/mortgage-requests/server/http";
import { bearerToken } from "@/lib/mortgage-requests/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ draftId: string; fileId: string }> };

/** GET — where a file stands, for polling while another request completes it. */
export async function GET(req: NextRequest, ctx: Params) {
  return handle("mortgage.files.status", async () => {
    const { draftId, fileId } = await ctx.params;
    const deps = mortgageDeps();
    await requireFlag(deps.db);
    await rateLimit("mortgage-file-status", draftId, 300, 600);
    return json(await fileStatus(deps, { draftId, token: bearerToken(req.headers), fileId }));
  });
}

/** DELETE — cancel an upload, or remove a file before submitting. */
export async function DELETE(req: NextRequest, ctx: Params) {
  return handle("mortgage.files.delete", async () => {
    const { draftId, fileId } = await ctx.params;
    const deps = mortgageDeps();
    await requireFlag(deps.db);
    await rateLimit("mortgage-file-delete", draftId, 60, 600);
    await deleteFile(deps, { draftId, token: bearerToken(req.headers), fileId });
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  });
}

import type { NextRequest } from "next/server";
import { completeFile } from "@/lib/mortgage-requests/server/drafts";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit, requireFlag } from "@/lib/mortgage-requests/server/http";
import { bearerToken } from "@/lib/mortgage-requests/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reads up to 40 MB and parses PDFs.
export const maxDuration = 60;

/** POST — check the uploaded bytes (SPEC §4.2; no malware scan, decision D6). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ draftId: string; fileId: string }> }) {
  return handle("mortgage.files.complete", async () => {
    const { draftId, fileId } = await ctx.params;
    const deps = mortgageDeps();
    await requireFlag(deps.db);
    await rateLimit("mortgage-complete", draftId, 60, 600);
    return json(await completeFile(deps, { draftId, token: bearerToken(req.headers), fileId }));
  });
}

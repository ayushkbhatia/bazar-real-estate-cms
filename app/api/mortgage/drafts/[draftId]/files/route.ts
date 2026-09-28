import type { NextRequest } from "next/server";
import { z } from "zod";
import { presignFile } from "@/lib/mortgage-requests/server/drafts";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit, readJson, requireFlag } from "@/lib/mortgage-requests/server/http";
import { bearerToken } from "@/lib/mortgage-requests/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.string().max(40),
  name: z.string().min(1).max(500),
  size: z.number().int().positive(),
  mime: z.string().max(100),
  /** Ready files of the same document this one replaces ("Replace" on W5/W6). */
  replaces: z.array(z.string().max(40)).max(2).optional(),
});

/** POST …/drafts/:draftId/files — check a file against its kind's rules and presign its upload. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  return handle("mortgage.files.presign", async () => {
    const { draftId } = await ctx.params;
    const deps = mortgageDeps();
    await requireFlag(deps.db);
    await rateLimit("mortgage-presign", draftId, 60, 600);
    const body = await readJson(req, Body);
    return json(await presignFile(deps, { draftId, token: bearerToken(req.headers), ...body }), 201);
  });
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit, readJson } from "@/lib/mortgage-requests/server/http";
import { linkKey, sessionLink } from "@/lib/mortgage-requests/server/link-http";
import { presignLinkFile } from "@/lib/mortgage-requests/server/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.string().max(40).optional(),
  name: z.string().min(1).max(500),
  size: z.number().int().positive(),
  mime: z.string().max(100),
  replaces: z.array(z.string().max(40)).max(2).optional(),
});

/** POST …/links/:token/files — presign an upload, scoped to the link's document(s) (SPEC §4.2). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handle("mortgage.links.presign", async () => {
    const { token } = await ctx.params;
    const deps = mortgageDeps();
    await rateLimit("mortgage-link-presign", linkKey(token), 60, 600);
    const link = await sessionLink(req, token, deps);
    const body = await readJson(req, Body);
    return json(await presignLinkFile(deps, link, body), 201);
  });
}

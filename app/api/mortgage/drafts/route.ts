import type { NextRequest } from "next/server";
import { z } from "zod";
import { extractClientIp } from "@/lib/rate-limit";
import { createDraft } from "@/lib/mortgage-requests/server/drafts";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { handle, json, rateLimit, readJson, requireFlag } from "@/lib/mortgage-requests/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No fields; reading it still holds the route to JSON (SR-16).
const Body = z.object({});

/** POST /api/mortgage/drafts — a new upload draft for a Fast Pre-Approval (SPEC §4.2). */
export async function POST(req: NextRequest) {
  return handle("mortgage.drafts.create", async () => {
    const deps = mortgageDeps();
    await requireFlag(deps.db);
    const ip = extractClientIp(req.headers);
    await rateLimit("mortgage-draft", ip, 10, 3600);
    await readJson(req, Body);
    return json(await createDraft(deps, { ip: ip === "unknown" ? null : ip }), 201);
  });
}

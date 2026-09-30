import type { NextRequest } from "next/server";
import { mortgageDeps } from "@/lib/mortgage-requests/server/deps";
import { MortgageApiError } from "@/lib/mortgage-requests/server/errors";
import { handle, json } from "@/lib/mortgage-requests/server/http";
import { completeLetter } from "@/lib/mortgage-requests/server/letters";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/mortgages/letters/:fileId/complete — check and scan an
 * uploaded bank letter: a real PDF of at most 10 MB, without a password, and
 * clean. A member of the mortgage team only; the letter is only used through
 * `mortgage_record_bank_response()`, which checks who may.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ fileId: string }> }) {
  return handle("mortgage.letters.complete", async () => {
    const { fileId } = await ctx.params;
    const session = await createSupabaseServerClient();
    const { data: role } = await session.rpc("mortgage_role");
    if (!role) throw new MortgageApiError(403, "forbidden");
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw new MortgageApiError(404, "not_found");
    return json(await completeLetter(mortgageDeps(), fileId));
  });
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { MortgageApiError } from "@/lib/mortgage-requests/server/errors";
import { handle, json, readJson } from "@/lib/mortgage-requests/server/http";
import { presignLetter } from "@/lib/mortgage-requests/server/letters";
import { supabaseStorage } from "@/lib/mortgage-requests/server/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  submissionId: z.string().uuid(),
  name: z.string().min(1).max(200),
  size: z.number().int().positive(),
});

/**
 * POST /api/admin/mortgages/letters — make a bank letter's row and presign its
 * upload (C5's "Record response"). The row is made through the caller's own
 * session, so the database decides: the owner or the Head, on a file with the
 * banks. /api/admin isn't behind the proxy's sign-in redirect; the session is
 * checked here.
 */
export async function POST(req: NextRequest) {
  return handle("mortgage.letters.presign", async () => {
    const db = createAdminClient();
    if (!db) throw new MortgageApiError(503, "not_configured");
    const session = await createSupabaseServerClient();
    const { data } = await session.auth.getUser();
    if (!data.user) throw new MortgageApiError(401, "unauthorised");
    const body = await readJson(req, Body);
    const presigned = await presignLetter(
      { storage: supabaseStorage(db) },
      session,
      { submissionId: body.submissionId, name: body.name, sizeBytes: body.size },
    );
    return json(presigned, 201);
  });
}

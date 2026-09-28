import type { NextRequest } from "next/server";
import { extractClientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import { openPackageFile } from "@/lib/mortgage-requests/server/banks";
import { MortgageApiError } from "@/lib/mortgage-requests/server/errors";
import { contentDisposition } from "@/lib/mortgage-requests/server/files";
import { rateLimit } from "@/lib/mortgage-requests/server/http";
import { supabaseStorage } from "@/lib/mortgage-requests/server/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mortgage/packages/:token/files/:fileId — one of a package's
 * documents, for the bank it was sent to (SPEC §8): only an accepted
 * document's clean file on that request, while the link is open, and the
 * download written to the activity log, as the bank, before any byte.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await ctx.params;
  const db = createAdminClient();
  if (!db) return Response.json({ code: "not_configured" }, { status: 503 });
  try {
    await rateLimit("mortgage-package-file", extractClientIp(req.headers), 120, 3600);
    const file = await openPackageFile({ db, storage: supabaseStorage(db) }, token, fileId);
    return new Response(new Blob([file.bytes as BlobPart], { type: file.mime }), {
      status: 200,
      headers: {
        "content-type": file.mime,
        "content-length": String(file.sizeBytes),
        "content-disposition": contentDisposition("attachment", file.name),
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof MortgageApiError) {
      return Response.json(error.toJSON(), { status: error.status, headers: { "cache-control": "no-store" } });
    }
    await reportError(error, { source: "mortgage.packages.file" });
    return Response.json({ code: "internal" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

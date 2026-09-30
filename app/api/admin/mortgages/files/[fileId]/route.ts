import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";
import { staffFileResponse, type StaffCaller } from "@/lib/mortgage-requests/server/files";
import { supabaseStorage } from "@/lib/mortgage-requests/server/storage";
import type { Json } from "@/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/mortgages/files/:fileId[?download=1] — an applicant's
 * document, for the mortgage team only, logged before any byte is sent
 * (SPEC §8). SPEC names this /admin/mortgages/files/[fileId]; route handlers
 * live under /api here, and /api/admin isn't behind the proxy's sign-in
 * redirect, so this checks the session itself.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const db = createAdminClient();
  if (!db) return Response.json({ code: "not_configured" }, { status: 503 });

  try {
    const session = await createSupabaseServerClient();
    const { data } = await session.auth.getUser();
    let caller: StaffCaller = null;
    if (data.user) {
      const { data: staff } = await db
        .from("staff")
        .select("user_id, status, mortgage_role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      caller = staff
        ? { userId: staff.user_id, status: staff.status, mortgageRole: staff.mortgage_role }
        : { userId: data.user.id, status: "none", mortgageRole: null };
    }

    return await staffFileResponse(
      {
        db,
        storage: supabaseStorage(db),
        // Through the caller's own session: the database checks their role again.
        logAccess: async ({ requestId, type, data: eventData }) => {
          const { error } = await session.rpc("mortgage_log_event", {
            p_request_id: requestId,
            p_type: type,
            p_data: eventData as Json,
            p_actor_kind: "staff",
          });
          if (error) throw new Error(`access log failed: ${error.code}`);
        },
      },
      { caller, fileId, download: new URL(req.url).searchParams.get("download") === "1" },
    );
  } catch (error) {
    await reportError(error, { source: "mortgage.files.staff" });
    return Response.json({ code: "internal" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

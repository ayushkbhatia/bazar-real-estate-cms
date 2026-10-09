"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { DOCUMENT_SETS, type DocKind } from "@/lib/mortgage-requests/documents";
import { mayActOn } from "@/lib/mortgage-requests/permissions";
import { parseQueueParams, type QueueParams } from "@/lib/mortgage-requests/queue";
import {
  FAILED,
  INVALID,
  NOT_ALLOWED,
  refreshMortgagePaths as refresh,
  refused,
  targetSchema,
  teamSession,
  type MortgageActionResult,
  type Target,
} from "@/lib/mortgage-requests/server/cms-kit";
import { listBoard, type BoardResult } from "@/lib/mortgage-requests/server/cms-queries";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";

/**
 * The queue board's actions (C1's board view; lib/mortgage-requests/board.ts).
 * A drop reuses the request's own actions wherever one exists — logging a
 * contact, marking a consultation held, cancelling a re-upload, declining —
 * so the board can do nothing the file page couldn't. The one move with no
 * action of its own is "start review" (New → In review), which until now
 * happened only when the owner first opened a document.
 */

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

/** The board for a view and a search (it polls with this, as the list does). */
export async function loadBoard(
  params: Partial<Pick<QueueParams, "service" | "owner" | "risk">>,
  q: string,
): Promise<{ ok: true; result: BoardResult } | { ok: false }> {
  const s = await teamSession();
  if (!s) return { ok: false };
  try {
    const view = parseQueueParams({
      service: params.service,
      owner: params.owner,
      risk: params.risk ? "1" : undefined,
    });
    const { policy } = await loadMortgageSettings(s.supabase);
    const result = await listBoard(
      s.supabase,
      { service: view.service, owner: view.owner, risk: view.risk, q: String(q ?? "").slice(0, 100) },
      { now: new Date(), meId: s.user.id, role: s.role, myName: s.staff.display_name ?? "", policy },
    );
    return { ok: true, result };
  } catch (error) {
    await reportError(error, { source: "mortgage.cms.board" });
    return { ok: false };
  }
}

/**
 * New → In review, from the board. The move is the system's
 * (`first_document_opened`, as the owner's first open makes it), made with
 * the service role, so the caller's right to act is checked first, as the
 * re-upload request does before the same move (SECURITY-REVIEW SR-12). The
 * activity log names who started it.
 */
export async function startReview(input: Target): Promise<MortgageActionResult> {
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const admin = createAdminClient();
  if (!admin) return FAILED;

  const { data: request } = await s.supabase
    .from("mortgage_requests")
    .select("id, service, status, owner_staff_id, updated_at")
    .eq("id", parsed.data.requestId)
    .maybeSingle();
  if (!request) return FAILED;
  if (request.updated_at !== parsed.data.updatedAt) return refused({ code: "MR409", message: "" }, "mortgage.cms.board");
  if (!mayActOn(s.role, request.owner_staff_id, s.user.id)) return NOT_ALLOWED;
  if (request.service !== "pre_approval" || request.status !== "new") {
    return { ok: false, code: "invalid", message: t("board.refused.startReview") };
  }

  const { error } = await admin.rpc("mortgage_transition", {
    p_request_id: request.id,
    p_event: "first_document_opened",
    p_actor_kind: "system",
    p_data: { started_by: s.user.id, via: "board" },
    p_expected_updated_at: request.updated_at,
  });
  if (error) return refused(error, "mortgage.cms.board");
  await admin.rpc("mortgage_log_event", {
    p_request_id: request.id,
    p_type: "review.started",
    p_data: { via: "board" },
    p_actor_kind: "staff",
    p_actor_id: s.user.id,
  });
  refresh(parsed.data.reference);
  return { ok: true, message: t("board.done.startReview", { reference: parsed.data.reference }) };
}

export type BoardMoveContext = {
  /** The file's documents, for "which one needs a re-upload?". */
  documents: { kind: DocKind; state: "to_review" | "accepted" | "reupload_requested" }[];
  /** Re-upload requests still open, for cancelling one from the board. */
  reuploads: { id: string; kind: DocKind }[];
};

/** What a drop asks about before it moves a file: read fresh, since the card can be a minute old. */
export async function loadBoardMoveContext(requestId: string): Promise<{ ok: true; context: BoardMoveContext } | { ok: false }> {
  if (!z.string().uuid().safeParse(requestId).success) return { ok: false };
  const s = await teamSession();
  if (!s) return { ok: false };
  const [{ data: request }, { data: docs }, { data: open }] = await Promise.all([
    s.supabase.from("mortgage_requests").select("employment_type").eq("id", requestId).maybeSingle(),
    s.supabase.from("mortgage_documents").select("id, kind, state").eq("request_id", requestId),
    s.supabase
      .from("mortgage_reupload_requests")
      .select("id, document:mortgage_documents(kind)")
      .eq("request_id", requestId)
      .is("fulfilled_at", null)
      .is("cancelled_at", null),
  ]);
  if (!request || !docs) return { ok: false };
  const order = DOCUMENT_SETS[request.employment_type as keyof typeof DOCUMENT_SETS] ?? [];
  const documents = (docs as { kind: DocKind; state: BoardMoveContext["documents"][number]["state"] }[])
    .map((d) => ({ kind: d.kind, state: d.state }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const reuploads = ((open ?? []) as unknown as { id: string; document: { kind: DocKind } }[]).map((r) => ({
    id: r.id,
    kind: r.document.kind,
  }));
  return { ok: true, context: { documents, reuploads } };
}

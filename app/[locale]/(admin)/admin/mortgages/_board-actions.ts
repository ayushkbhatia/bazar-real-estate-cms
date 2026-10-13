"use server";

import { reportError } from "@/lib/observability";
import { parseQueueParams, type QueueParams } from "@/lib/mortgage-requests/queue";
import { teamSession } from "@/lib/mortgage-requests/server/cms-kit";
import { listBoard, type BoardResult } from "@/lib/mortgage-requests/server/cms-queries";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";

/**
 * The queue board's read (C1's board view; lib/mortgage-requests/board.ts).
 * A drop reuses the request's own actions — moving a stage, declining,
 * logging a contact, marking a consultation held — so the board can do
 * nothing the file page couldn't.
 */

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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  evaluateStageAdvance,
  nextStage,
  type DealStage,
  type DocumentKind,
  type DocumentStatus,
} from "@/lib/deals";

export type StageGatePreview = {
  /** The stage we'd transition to. null when current is terminal. */
  next: DealStage | null;
  /** True when next is non-null AND the gate would pass. */
  canAdvance: boolean;
  blockers: string[];
};

type DocsLite = {
  kind: DocumentKind;
  status: DocumentStatus;
  expires_at: string | null;
};

/**
 * Server-side preflight for the "Advance to next stage" UI. Returns the
 * same blockers `evaluateStageAdvance` would produce without mutating
 * anything.
 *
 * Used by the deal-detail page to label the Advance button when the gate
 * blocks (e.g. "Buyer KYC missing").
 */
export async function previewStageAdvance(opts: {
  dealId: string;
  stage: DealStage;
  buyerAccountId: string;
}): Promise<StageGatePreview> {
  const next = nextStage(opts.stage);
  if (!next) return { next: null, canAdvance: false, blockers: [] };
  if (!isSupabaseConfigured) {
    return { next, canAdvance: false, blockers: ["Service unavailable."] };
  }
  const supabase = await createSupabaseServerClient();
  const [buyerRes, dealRes] = await Promise.all([
    supabase
      .from("documents")
      .select("kind, status, expires_at")
      .eq("owner_kind", "account")
      .eq("owner_id", opts.buyerAccountId)
      .is("deleted_at", null),
    supabase
      .from("documents")
      .select("kind, status, expires_at")
      .eq("owner_kind", "deal")
      .eq("owner_id", opts.dealId)
      .is("deleted_at", null),
  ]);
  const buyerDocs = ((buyerRes.data ?? []) as DocsLite[]) ?? [];
  const dealDocs = ((dealRes.data ?? []) as DocsLite[]) ?? [];

  const gate = evaluateStageAdvance({
    from: opts.stage,
    to: next,
    docs: { buyerDocs, dealDocs },
  });
  return {
    next,
    canAdvance: gate.ok,
    blockers: gate.blockers,
  };
}

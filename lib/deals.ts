import type { Database } from "@/db/types";

export type DealStage = Database["public"]["Enums"]["deal_stage"];
export type DocumentKind = Database["public"]["Enums"]["document_kind"];
export type DocumentStatus = Database["public"]["Enums"]["document_status"];
export type DocumentOwnerKind =
  Database["public"]["Enums"]["document_owner_kind"];

export const DEAL_STAGES: readonly DealStage[] = [
  "mou",
  "deposit",
  "noc_pending",
  "dld_pending",
  "transferred",
] as const;

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  mou: "MoU",
  deposit: "Deposit",
  noc_pending: "NOC pending",
  dld_pending: "DLD pending",
  transferred: "Transferred",
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  passport: "Passport",
  emirates_id: "Emirates ID",
  title_deed: "Title deed",
  form_a: "Form A",
  noc: "NOC",
  mou: "MoU",
  sale_contract: "Sale contract",
  power_of_attorney: "Power of attorney",
  valuation_report: "Valuation report",
  mortgage_pre_approval: "Mortgage pre-approval",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  uploaded: "Uploaded",
  pending_review: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  expired: "Expired",
};

/** True for documents that legally identify the buyer (KYC). */
export function isKycKind(kind: DocumentKind): boolean {
  return kind === "passport" || kind === "emirates_id";
}

export function nextStage(stage: DealStage): DealStage | null {
  const idx = DEAL_STAGES.indexOf(stage);
  if (idx < 0 || idx >= DEAL_STAGES.length - 1) return null;
  return DEAL_STAGES[idx + 1] ?? null;
}

export function previousStage(stage: DealStage): DealStage | null {
  const idx = DEAL_STAGES.indexOf(stage);
  if (idx <= 0) return null;
  return DEAL_STAGES[idx - 1] ?? null;
}

/**
 * The DB snapshot we need to make stage decisions. Kept minimal so the
 * caller can build it cheaply from a single query.
 */
export type DealDocsContext = {
  /** All verified buyer-side docs to consider. Owner_kind = account or deal. */
  buyerDocs: {
    kind: DocumentKind;
    status: DocumentStatus;
    expires_at: string | null;
  }[];
  /** All verified deal-scoped docs (owner_kind = 'deal'). */
  dealDocs: {
    kind: DocumentKind;
    status: DocumentStatus;
    expires_at: string | null;
  }[];
};

function hasVerified(
  docs: DealDocsContext["buyerDocs"],
  predicate: (k: DocumentKind) => boolean,
  now: Date,
): boolean {
  return docs.some((d) => {
    if (d.status !== "verified") return false;
    if (!predicate(d.kind)) return false;
    if (d.expires_at) {
      const ts = Date.parse(d.expires_at);
      if (!Number.isNaN(ts) && ts < now.getTime()) return false;
    }
    return true;
  });
}

export type StageGateResult = {
  /** True when the deal can move from `from` → `to`. */
  ok: boolean;
  /** When !ok, the single most-relevant reason to surface to the user. */
  reason: string | null;
  /** All blockers, in case the UI wants to render a list. */
  blockers: string[];
};

/**
 * Pure server-side gate. Returns whether `deal` is allowed to advance from
 * `from` → `to` given the document state. `to` must equal `nextStage(from)`
 * or this returns ok:false with a "stage out of order" reason.
 */
export function evaluateStageAdvance(opts: {
  from: DealStage;
  to: DealStage;
  docs: DealDocsContext;
  now?: Date;
}): StageGateResult {
  const now = opts.now ?? new Date();
  const expected = nextStage(opts.from);
  if (expected !== opts.to) {
    return {
      ok: false,
      reason: `Cannot jump from ${DEAL_STAGE_LABELS[opts.from]} to ${DEAL_STAGE_LABELS[opts.to]}.`,
      blockers: ["Stage out of order"],
    };
  }

  const blockers: string[] = [];

  // Gate: advancing past `deposit` requires a verified passport OR emirates_id
  // on the buyer (KYC due diligence before NOC).
  if (opts.to === "noc_pending") {
    const kycOk = hasVerified(opts.docs.buyerDocs, isKycKind, now);
    if (!kycOk) {
      blockers.push(
        "Buyer KYC missing — upload and verify a passport or Emirates ID first.",
      );
    }
  }

  // Gate: advancing past `noc_pending` requires a verified NOC document on
  // the deal itself.
  if (opts.to === "dld_pending") {
    const nocOk = hasVerified(opts.docs.dealDocs, (k) => k === "noc", now);
    if (!nocOk) {
      blockers.push(
        "NOC not on file — upload and verify the developer NOC before requesting transfer.",
      );
    }
  }

  return {
    ok: blockers.length === 0,
    reason: blockers[0] ?? null,
    blockers,
  };
}

/**
 * Compose a deterministic storage object key for a document upload. The
 * leading segment must match the storage RLS policies in 0012_deal_room.sql,
 * so callers MUST go through this helper rather than building keys ad hoc.
 *
 *   accounts/<user-id>/<doc-id>-<filename>
 *   deals/<deal-id>/<doc-id>-<filename>
 */
export function composeDocumentStorageKey(opts: {
  ownerKind: DocumentOwnerKind;
  ownerId: string;
  documentId: string;
  filename: string;
}): string {
  const safeName = sanitiseFilename(opts.filename);
  if (opts.ownerKind === "account") {
    return `accounts/${opts.ownerId}/${opts.documentId}-${safeName}`;
  }
  if (opts.ownerKind === "deal") {
    return `deals/${opts.ownerId}/${opts.documentId}-${safeName}`;
  }
  // Generic fallback for other owner_kinds — never selectable by an account,
  // staff-only via RLS.
  return `${opts.ownerKind}s/${opts.ownerId}/${opts.documentId}-${safeName}`;
}

export function sanitiseFilename(name: string): string {
  // Drop path traversal segments and separators, then collapse anything
  // that isn't a portable filename char.
  const flat = name
    .replace(/\.\.+/g, "")
    .replace(/[\\/]+/g, "-")
    .trim();
  return (
    flat
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .replace(/-+/g, "-")
      .slice(0, 96) || "file"
  );
}

/**
 * Permission helper — can the given viewer SELECT a document row?
 * Mirrors the SQL policy (documents_staff_all + documents_owner_account_select
 * + documents_owner_deal_select) so we can sanity-check in TS too.
 */
export type DocumentVisibilityInput = {
  ownerKind: DocumentOwnerKind;
  ownerId: string;
  viewer:
    | { kind: "anon" }
    | { kind: "account"; userId: string }
    | { kind: "staff"; userId: string }
    | { kind: "buyer-of-deal"; userId: string; dealId: string };
};

export function canViewDocument(input: DocumentVisibilityInput): boolean {
  if (input.viewer.kind === "anon") return false;
  if (input.viewer.kind === "staff") return true;
  if (
    input.viewer.kind === "account" &&
    input.ownerKind === "account" &&
    input.ownerId === input.viewer.userId
  ) {
    return true;
  }
  if (
    input.viewer.kind === "buyer-of-deal" &&
    input.ownerKind === "deal" &&
    input.ownerId === input.viewer.dealId
  ) {
    return true;
  }
  return false;
}

/**
 * Required-doc checklist for a buyer given the deal's current stage. Used by
 * /account/documents to show "Required" tab contents.
 */
export function requiredBuyerDocs(stage: DealStage): DocumentKind[] {
  // KYC is required as soon as a deal exists; the gate only fires at
  // `deposit → noc_pending`, but we want to prompt earlier.
  if (stage === "mou" || stage === "deposit") {
    return ["passport", "emirates_id"];
  }
  return [];
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHECKLISTS } from "../checklists";
import { coverage, monthOf, type Coverage } from "../coverage";
import { DOC_KINDS, DOCUMENT_SETS, requiredStatementMonths, type DocKind } from "../documents";
import { formatDayTime } from "../format";
import type { RequestStatus } from "../queue";

/**
 * The document viewer's data (C3/C4; docs/mortgage/cms/C3 "getViewer"): the
 * request in brief, its documents in the set's order, this document's files,
 * checks, figures and statement coverage, and any open re-upload request. Read
 * through the reviewer's own session: RLS keeps it to the mortgage team.
 */

export type ViewerFile = {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  pageCount: number | null;
  /** Still being checked: can't be opened yet. */
  periodFrom: string | null;
  periodTo: string | null;
  round: number;
};

export type ViewerData = {
  request: {
    id: string;
    reference: string;
    fullName: string;
    firstName: string;
    status: RequestStatus;
    updatedAt: string;
    submittedAt: string;
  };
  documents: { id: string; kind: DocKind; state: "to_review" | "accepted" | "reupload_requested" }[];
  doc: {
    id: string;
    kind: DocKind;
    state: "to_review" | "accepted" | "reupload_requested";
    checks: Record<string, boolean>;
    recorded: Record<string, string | number>;
    acceptedBy: string | null;
    acceptedAt: string | null;
    files: ViewerFile[];
  };
  /** Statements only: the months required and what the entered periods cover. */
  required: string[];
  coverage: Coverage | null;
  openReupload: { id: string; reason: string; message: string; requestedAt: string } | null;
  /** How many of the request's other documents are accepted (the pause note). */
  acceptedOthers: number;
  can: { act: boolean };
};

export function isDocKind(value: string): value is DocKind {
  return (DOC_KINDS as readonly string[]).includes(value);
}

export async function getViewer(
  db: SupabaseClient,
  reference: string,
  kind: DocKind,
  me: { id: string; role: "head" | "adviser" },
): Promise<ViewerData | null> {
  if (!/^BZM-\d{2}-\d{4,}$/.test(reference)) return null;
  const { data: found, error } = await db
    .from("mortgage_requests")
    .select("id, reference, service, status, full_name, updated_at, submitted_at, employment_type, owner_staff_id")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw new Error(`request read failed: ${error.message}`);
  const r = found as {
    id: string;
    reference: string;
    service: string;
    status: RequestStatus;
    full_name: string;
    updated_at: string;
    submitted_at: string;
    employment_type: keyof typeof DOCUMENT_SETS;
    owner_staff_id: string | null;
  } | null;
  if (!r || r.service !== "pre_approval" || !DOCUMENT_SETS[r.employment_type].includes(kind)) return null;

  const [documents, reuploads] = await Promise.all([
    db
      .from("mortgage_documents")
      .select(
        "id, kind, state, checks, recorded, accepted_by, accepted_at, files:mortgage_files(id, original_name, mime, size_bytes, page_count, state, scan_status, period_from, period_to, upload_round, uploaded_at)",
      )
      .eq("request_id", r.id),
    db
      .from("mortgage_reupload_requests")
      .select("id, document_id, reason, message, requested_at")
      .eq("request_id", r.id)
      .is("fulfilled_at", null)
      .is("cancelled_at", null),
  ]);
  if (documents.error) throw new Error(`documents read failed: ${documents.error.message}`);
  if (reuploads.error) throw new Error(`re-uploads read failed: ${reuploads.error.message}`);

  type DocRow = {
    id: string;
    kind: DocKind;
    state: ViewerData["doc"]["state"];
    checks: Record<string, boolean> | null;
    recorded: Record<string, string | number> | null;
    accepted_by: string | null;
    accepted_at: string | null;
    files: {
      id: string;
      original_name: string;
      mime: string;
      size_bytes: number;
      page_count: number | null;
      state: string;
      scan_status: string;
      period_from: string | null;
      period_to: string | null;
      upload_round: number;
      uploaded_at: string;
    }[];
  };
  const order = DOCUMENT_SETS[r.employment_type];
  const docs = (documents.data as DocRow[]).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const doc = docs.find((d) => d.kind === kind);
  if (!doc) return null;

  let acceptedByName: string | null = null;
  if (doc.accepted_by) {
    const { data } = await db.from("staff").select("display_name").eq("user_id", doc.accepted_by).maybeSingle();
    acceptedByName = (data as { display_name: string } | null)?.display_name ?? null;
  }

  const files: ViewerFile[] = doc.files
    .filter((f) => f.state === "active")
    .sort(
      (a, b) =>
        (a.period_from ?? "").localeCompare(b.period_from ?? "") ||
        a.upload_round - b.upload_round ||
        a.uploaded_at.localeCompare(b.uploaded_at) ||
        a.original_name.localeCompare(b.original_name),
    )
    .map((f) => ({
      id: f.id,
      name: f.original_name,
      mime: f.mime,
      sizeBytes: Number(f.size_bytes),
      pageCount: f.page_count,
      periodFrom: f.period_from ? monthOf(f.period_from) : null,
      periodTo: f.period_to ? monthOf(f.period_to) : null,
      round: f.upload_round,
    }));

  const required = requiredStatementMonths(kind, r.submitted_at);
  const open = (reuploads.data as { id: string; document_id: string; reason: string; message: string; requested_at: string }[]).find(
    (u) => u.document_id === doc.id,
  );
  const closed = r.status === "with_banks" || r.status === "pre_approved" || r.status === "declined";

  return {
    request: {
      id: r.id,
      reference: r.reference,
      fullName: r.full_name,
      firstName: r.full_name.trim().split(/\s+/)[0] ?? r.full_name,
      status: r.status,
      updatedAt: r.updated_at,
      submittedAt: r.submitted_at,
    },
    documents: docs.map((d) => ({ id: d.id, kind: d.kind, state: d.state })),
    doc: {
      id: doc.id,
      kind: doc.kind,
      state: doc.state,
      checks: doc.checks ?? {},
      recorded: doc.recorded ?? {},
      acceptedBy: acceptedByName && doc.accepted_at ? `${acceptedByName.split(/\s+/)[0]} · ${formatDayTime(doc.accepted_at)}` : null,
      acceptedAt: doc.accepted_at,
      files,
    },
    required,
    coverage: required.length ? coverage(required, files.map((f) => ({ from: f.periodFrom, to: f.periodTo }))) : null,
    openReupload: open ? { id: open.id, reason: open.reason, message: open.message, requestedAt: open.requested_at } : null,
    acceptedOthers: docs.filter((d) => d.id !== doc.id && d.state === "accepted").length,
    can: { act: !closed && (me.role === "head" || r.owner_staff_id === me.id) },
  };
}

/** The checks a document needs ticked before Accept (SPEC §2.3), and the figures (D21). */
export function acceptRequirements(kind: DocKind): { checks: string[]; fields: string[] } {
  return {
    checks: CHECKLISTS[kind].checks.map((c) => c.key),
    fields: CHECKLISTS[kind].recorded.map((f) => f.key),
  };
}


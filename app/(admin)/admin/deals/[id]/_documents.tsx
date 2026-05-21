"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Upload, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  type DocumentKind,
  type DocumentStatus,
} from "@/lib/deals";
import {
  setDocumentStatus,
  startDealDocumentUpload,
} from "./_actions";

const DEAL_DOC_KINDS: DocumentKind[] = [
  "title_deed",
  "form_a",
  "noc",
  "mou",
  "sale_contract",
  "power_of_attorney",
  "mortgage_pre_approval",
  "valuation_report",
];

type DocRow = {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  filename: string | null;
  storage_key: string | null;
  size_bytes: number | null;
  rejected_reason: string | null;
  uploaded_at: string;
  owner_kind: "account" | "deal";
};

type Props = {
  dealId: string;
  dealDocs: DocRow[];
  /** Buyer-side KYC docs (passport, emirates_id) — read-only here. */
  buyerKycDocs: DocRow[];
};

function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const styles: Record<DocumentStatus, string> = {
    uploaded: "bg-bz-surface-3 text-bz-ink-2",
    pending_review: "bg-[oklch(0.96_0.05_60)] text-[oklch(0.45_0.13_60)]",
    verified: "bg-bz-accent-soft text-bz-accent",
    rejected: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
    expired: "bg-bz-surface-2 text-bz-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded text-[11.5px] font-medium",
        styles[status],
      )}
    >
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function DocumentsPane({ dealId, dealDocs, buyerKycDocs }: Props) {
  const [kind, setKind] = useState<DocumentKind>("title_deed");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  function onFileChosen(file: File) {
    startUpload(async () => {
      const init = await startDealDocumentUpload({
        dealId,
        kind,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (init.status === "error") {
        toast.error(init.message);
        return;
      }
      try {
        const r = await fetch(init.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!r.ok) {
          toast.error(`Upload failed (${r.status}).`);
          return;
        }
        toast.success(`${DOCUMENT_KIND_LABELS[kind]} uploaded.`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Upload row */}
      <div className="bg-bz-surface-2 border border-bz-border rounded-lg p-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as DocumentKind)}
          >
            <SelectTrigger className="w-[200px] h-8 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEAL_DOC_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {DOCUMENT_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={13} strokeWidth={1.8} />
            {uploading ? "Uploading…" : "Choose file"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileChosen(file);
              e.target.value = "";
            }}
          />
          <span className="text-[11.5px] text-bz-muted">
            PDF or image, max 20 MB.
          </span>
        </div>
      </div>

      {/* Buyer KYC strip */}
      {buyerKycDocs.length > 0 ? (
        <div>
          <div className="text-[10.5px] uppercase tracking-widest text-bz-muted mb-2">
            Buyer KYC
          </div>
          <ul className="flex flex-col gap-2">
            {buyerKycDocs.map((d) => (
              <DocItem key={d.id} doc={d} accountScoped />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Deal documents */}
      <div>
        <div className="text-[10.5px] uppercase tracking-widest text-bz-muted mb-2">
          Deal documents
        </div>
        {dealDocs.length === 0 ? (
          <div className="text-[12.5px] text-bz-muted py-3">
            Nothing yet. Pick a kind above and choose a file to start.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {dealDocs.map((d) => (
              <DocItem key={d.id} doc={d} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DocItem({
  doc,
  accountScoped,
}: {
  doc: DocRow;
  accountScoped?: boolean;
}) {
  const [pending, start] = useTransition();

  function setStatus(next: "verified" | "rejected") {
    if (next === "rejected") {
      const reason = window.prompt("Reason for rejection?");
      if (reason === null) return;
      start(async () => {
        const r = await setDocumentStatus({
          documentId: doc.id,
          next,
          reason,
        });
        if (r.status === "error") toast.error(r.message);
        else toast.success("Marked rejected.");
      });
      return;
    }
    start(async () => {
      const r = await setDocumentStatus({ documentId: doc.id, next });
      if (r.status === "error") toast.error(r.message);
      else toast.success("Marked verified.");
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 bg-bz-surface border border-bz-border rounded-md">
      <FileText size={16} strokeWidth={1.6} className="text-bz-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-bz-ink">
            {DOCUMENT_KIND_LABELS[doc.kind]}
          </span>
          <StatusBadge status={doc.status} />
          {accountScoped ? (
            <span className="text-[11px] text-bz-muted">
              from buyer&apos;s vault
            </span>
          ) : null}
        </div>
        <div className="text-[11.5px] text-bz-muted truncate">
          {doc.filename ?? "—"} · {formatBytes(doc.size_bytes)}
        </div>
        {doc.status === "rejected" && doc.rejected_reason ? (
          <div className="mt-1 inline-flex items-start gap-1.5 text-[11.5px] text-[oklch(0.45_0.13_28)]">
            <AlertTriangle size={11} strokeWidth={1.8} className="mt-0.5" />
            {doc.rejected_reason}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        {doc.storage_key ? (
          <a
            href={`/api/documents/${doc.id}/download`}
            className="px-2 h-7 text-[12px] inline-flex items-center rounded border border-bz-border text-bz-ink-2 hover:bg-bz-surface-2"
            target="_blank"
            rel="noreferrer"
          >
            View
          </a>
        ) : null}
        {doc.status !== "verified" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setStatus("verified")}
            aria-label="Verify document"
          >
            <Check size={12} strokeWidth={1.8} />
            Verify
          </Button>
        ) : null}
        {doc.status !== "rejected" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setStatus("rejected")}
            aria-label="Reject document"
          >
            <X size={12} strokeWidth={1.8} />
            Reject
          </Button>
        ) : null}
      </div>
    </li>
  );
}

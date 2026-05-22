"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  RefreshCcw,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  name: string;
  kind: string;
  uploaded_at: string;
  expires_at: string | null;
  size_bytes: number;
  status: "ready" | "pending" | "rejected";
};

/**
 * Sprint 6 (backfilled): single row in the documents list with
 * replace / delete / download buttons and an expiry warning when
 * within 60 days.
 */
export function DocRow({
  doc,
  onReplace,
  onDelete,
  onDownload,
  nowMs,
}: {
  doc: Doc;
  onReplace?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDownload?: (id: string) => void;
  /** Server-passed timestamp; keeps Date.now() out of the render body. */
  nowMs: number;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const expiryWarn =
    doc.expires_at &&
    new Date(doc.expires_at).getTime() - nowMs < 60 * 86_400_000 &&
    new Date(doc.expires_at).getTime() > nowMs;
  const expired =
    doc.expires_at && new Date(doc.expires_at).getTime() <= nowMs;

  return (
    <li className="rounded-md border border-bz-border bg-bz-surface px-4 py-3 flex items-start gap-3">
      <FileText
        size={18}
        strokeWidth={1.6}
        className={cn(
          "flex-shrink-0 mt-0.5",
          expired ? "text-bz-danger" : "text-bz-muted",
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[14px] text-bz-ink truncate">{doc.name}</span>
          <span className="text-[10.5px] uppercase tracking-wider text-bz-muted">
            {doc.kind.replace(/_/g, " ")}
          </span>
          {doc.status === "pending" ? (
            <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-yellow-100 text-yellow-900 text-[10px]">
              Under review
            </span>
          ) : null}
          {doc.status === "rejected" ? (
            <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-red-50 text-red-700 text-[10px]">
              Rejected — replace
            </span>
          ) : null}
        </div>
        <div className="mt-1 mono text-[11px] text-bz-muted">
          Uploaded{" "}
          {new Date(doc.uploaded_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" · "}
          {(doc.size_bytes / 1024).toFixed(0)} KB
          {doc.expires_at ? (
            <>
              {" · "}
              <span
                className={cn(
                  expired
                    ? "text-bz-danger"
                    : expiryWarn
                      ? "text-bz-warning"
                      : "",
                )}
              >
                {expired ? "Expired " : "Expires "}
                {new Date(doc.expires_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </>
          ) : null}
        </div>
        {expiryWarn && !expired ? (
          <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-bz-warning">
            <AlertTriangle size={11} strokeWidth={2} />
            Expires within 60 days — upload a fresh copy soon.
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            if (onDownload) onDownload(doc.id);
            else toast.info("Download wires Sprint 9.");
          }}
          aria-label="Download"
          className="w-7 h-7 rounded-md text-bz-muted hover:text-bz-ink hover:bg-bz-bg flex items-center justify-center"
        >
          <Download size={13} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (onReplace) onReplace(doc.id);
            else toast.info("Replace wires Sprint 9.");
          }}
          aria-label="Replace"
          className="w-7 h-7 rounded-md text-bz-muted hover:text-bz-ink hover:bg-bz-bg flex items-center justify-center"
        >
          <RefreshCcw size={13} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirmingDelete) {
              setConfirmingDelete(true);
              setTimeout(() => setConfirmingDelete(false), 3000);
              return;
            }
            if (onDelete) onDelete(doc.id);
            else toast.info("Delete wires Sprint 9.");
            setConfirmingDelete(false);
          }}
          aria-label={confirmingDelete ? "Confirm delete" : "Delete"}
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
            confirmingDelete
              ? "bg-bz-danger text-white"
              : "text-bz-muted hover:text-bz-danger hover:bg-bz-bg",
          )}
        >
          <Trash2 size={13} strokeWidth={1.7} />
        </button>
      </div>
    </li>
  );
}

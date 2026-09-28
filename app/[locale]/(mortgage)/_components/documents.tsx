"use client";

import { Plus, RefreshCw, Upload, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { acceptAttribute, DOCUMENT_RULES, type DocKind } from "@/lib/mortgage-requests/documents";
import { formatLimitMb, formatMb } from "@/lib/mortgage-requests/format";
import {
  isInFlight,
  isMultiFile,
  rowAction,
  type RowView,
  type UploadError,
  type UploadItem,
} from "@/lib/mortgage-requests/client/upload-queue";
import { cn } from "@/lib/utils";
import { DOC_GLYPH, Glyph } from "@/components/mortgage/glyphs";
import { CheckMark, FlowButton, Pill, Tick } from "./primitives";

/**
 * The documents step's parts (00-foundations §5 and §7.3): the document
 * tile, a file's line, the upload row in each of its states, and the consent.
 */

/** `emirates_id` → `emiratesId`: the kind's key in the message catalogue. */
export function docKey(kind: DocKind): string {
  return kind.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

// ── Tile ────────────────────────────────────────────────────────

export type TileState = "empty" | "busy" | "done" | "error";

const TILE: Record<TileState, string> = {
  empty: "bg-bz-surface-2 text-bz-ink-2",
  busy: "bg-bz-accent-soft text-bz-accent",
  done: "bg-[var(--mrq-success-bg)] text-[var(--mrq-success-glyph)]",
  error: "bg-[var(--mrq-danger-bg)] text-[var(--mrq-danger-glyph)]",
};

export function DocumentIcon({ kind, state = "empty", size = 44 }: { kind: DocKind; state?: TileState; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn("relative grid shrink-0 place-items-center", TILE[state])}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    >
      <Glyph name={DOC_GLYPH[kind]} size={Math.round(size * 0.46)} />
      {state === "done" || state === "error" ? (
        <span
          className={cn(
            "absolute -end-[5px] -bottom-[5px] grid size-[18px] place-items-center rounded-full text-white shadow-[0_0_0_2px_var(--bz-surface)]",
            state === "done" ? "bg-[var(--mrq-badge-done)]" : "bg-[var(--mrq-badge-error)]",
          )}
        >
          {state === "done" ? <Tick size={10} strokeWidth={3} /> : <span className="text-[11px] leading-none font-bold">!</span>}
        </span>
      ) : null}
    </span>
  );
}

// ── A file's line ───────────────────────────────────────────────

function Thumb({ image }: { image: boolean }) {
  if (image) {
    return (
      <span
        aria-hidden
        className="h-[30px] w-[46px] shrink-0 rounded-[4px] border border-bz-border"
        style={{
          background:
            "repeating-linear-gradient(135deg, var(--bz-surface-3) 0 1px, var(--bz-surface-2) 1px 6px)",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="relative box-border flex h-[38px] w-[30px] shrink-0 flex-col gap-[3px] rounded-[3px] border border-bz-border-strong bg-white px-[5px] py-1.5"
    >
      {[80, 100, 62, 100].map((w, i) => (
        <span key={i} className="h-[1.5px] rounded-[1px] bg-[var(--mrq-thumb-line)]" style={{ width: `${w}%` }} />
      ))}
      <span className="mono absolute start-[3px] bottom-0.5 text-[7px] font-semibold text-[var(--mrq-danger-glyph)]">PDF</span>
    </span>
  );
}

export function UploadedFile({
  item,
  meta,
  onRemove,
  onCancel,
}: {
  item: UploadItem;
  /** The line under the name once the file is still: its size, unless the page says more (W8). */
  meta?: ReactNode;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("mortgage");
  const moving = isInFlight(item);
  const error = item.stage === "error";
  const pct = item.sizeBytes > 0 ? Math.min(100, Math.round((item.loaded / item.sizeBytes) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <Thumb image={item.mime.startsWith("image/")} />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "mono truncate text-[12.5px]",
            error ? "text-[var(--mrq-danger-fg)]" : "text-bz-ink",
          )}
        >
          {item.name}
        </div>
        {moving ? (
          <div className="mt-1.5 flex items-center gap-2.5">
            <div
              role="progressbar"
              aria-label={t("upload.progressLabel", { name: item.name })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="mrq-progress h-1 max-w-[280px] flex-1 overflow-hidden rounded-full bg-bz-surface-3"
            >
              <div className="h-full rounded-full bg-bz-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11.5px] whitespace-nowrap text-bz-muted">
              {t("upload.progress", { loaded: formatMb(item.loaded), total: formatMb(item.sizeBytes) })}
            </span>
          </div>
        ) : (
          <div className="mt-0.5 text-[11.5px] text-bz-muted">{meta ?? t("upload.size", { size: formatMb(item.sizeBytes) })}</div>
        )}
      </div>
      {item.stage === "ready" && !item.error ? (
        <span className="flex text-[var(--mrq-success-tick)]" aria-hidden>
          <Tick size={16} strokeWidth={2.2} />
        </span>
      ) : null}
      <button
        type="button"
        onClick={moving ? onCancel : onRemove}
        aria-label={moving ? t("upload.cancelFile", { name: item.name }) : t("upload.remove", { name: item.name })}
        className="grid size-7 place-items-center rounded-md text-bz-muted hover:bg-bz-surface-2 hover:text-bz-ink pointer-coarse:size-11"
      >
        <X size={16} strokeWidth={1.6} aria-hidden />
      </button>
    </div>
  );
}

// ── The copy for an upload error (00-foundations §7.4) ──────────

export function useUploadErrorMessage() {
  const t = useTranslations("mortgage");
  return (kind: DocKind, error: UploadError): string => {
    const pdfOnly = !DOCUMENT_RULES[kind].mimes.some((m) => m.startsWith("image/"));
    switch (error.code) {
      case "too_large":
        return pdfOnly
          ? t("upload.error.tooLargePdf", {
              size: formatMb(error.sizeBytes ?? 0),
              limit: formatLimitMb(error.limitBytes ?? DOCUMENT_RULES[kind].maxFileBytes),
            })
          : t("upload.error.tooLarge", {
              size: formatMb(error.sizeBytes ?? 0),
              limit: formatLimitMb(error.limitBytes ?? DOCUMENT_RULES[kind].maxFileBytes),
              documentNoun: t(`doc.${docKey(kind)}.noun`),
            });
      case "total_exceeded":
        return t("upload.error.totalExceeded", {
          total: formatMb(error.totalBytes ?? 0),
          limit: formatLimitMb(error.limitBytes ?? DOCUMENT_RULES[kind].maxTotalBytes ?? 0),
        });
      case "bad_type":
        return pdfOnly ? t("upload.error.badTypePdf") : t("upload.error.badType");
      case "too_many_files":
        return t("upload.error.tooManyFiles", { limit: error.limit ?? DOCUMENT_RULES[kind].maxFiles });
      case "encrypted_pdf":
        return t("upload.error.encryptedPdf");
      case "unreadable":
        return t("upload.error.unreadable");
      case "infected":
        return t("upload.error.infected");
      case "scan_failed":
        return t("upload.error.scanFailed");
      case "network":
        return t("upload.error.network");
      case "draft_expired":
        return t("upload.error.draftExpired");
      default:
        return t("upload.error.generic");
    }
  };
}

// ── The row ─────────────────────────────────────────────────────

export function DocumentUploadRow({
  kind,
  view,
  note,
  onPick,
  onCancel,
  onRemove,
  onRetry,
  canRetry,
}: {
  kind: DocKind;
  view: RowView;
  note?: ReactNode;
  /** Files chosen or dropped. `replace` when the row's action was Replace. */
  onPick: (files: File[], mode: "add" | "replace" | "choose_another") => void;
  onCancel: (localId: string) => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  canRetry: (localId: string) => boolean;
}) {
  const t = useTranslations("mortgage");
  const errorMessage = useUploadErrorMessage();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const mode = useRef<"add" | "replace" | "choose_another">("add");
  const [dragging, setDragging] = useState(false);
  const multi = isMultiFile(kind);
  const action = rowAction(kind, view);
  const key = docKey(kind);
  const tile: TileState =
    view.state === "attention" ? "error" : view.state === "uploading" ? "busy" : view.state === "added" ? "done" : "empty";
  const rule = DOCUMENT_RULES[kind];

  const pick = (m: typeof mode.current) => {
    mode.current = m;
    input.current?.click();
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    onPick(
      files,
      action === "choose_another" ? "choose_another" : action === "replace" ? "replace" : "add",
    );
  };
  const cancelAll = () => view.items.filter(isInFlight).forEach((i) => onCancel(i.localId));

  const errorId = `${id}-error`;
  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={view.error ? errorId : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "rounded-[14px] px-5 py-[18px] transition-colors",
        dragging
          ? "border-[1.5px] border-solid border-bz-ink-2 bg-bz-surface-2"
          : view.state === "empty"
            ? "border-[1.5px] border-dashed border-bz-border-strong bg-bz-surface"
            : view.state === "attention"
              ? "border border-[var(--mrq-danger-row-border)] bg-[var(--mrq-danger-row-bg)]"
              : "border border-bz-border bg-bz-surface",
      )}
    >
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={acceptAttribute(kind)}
        multiple={multi}
        aria-label={t("upload.pickerLabel", { document: t(`doc.${key}.name`) })}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length > 0) onPick(files, mode.current);
        }}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <DocumentIcon kind={kind} state={tile} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span id={`${id}-title`} className="text-[15.5px] font-medium">
                {t(`doc.${key}.name`)}
              </span>
              {view.state === "added" ? (
                <Pill tone="success" small>
                  {multi && rule.maxFiles > 2
                    ? t("upload.pill.filesAdded", { count: view.readyCount })
                    : t("upload.pill.added")}
                </Pill>
              ) : view.state === "uploading" ? (
                <Pill tone="accent" small>
                  {t("upload.pill.uploading")}
                </Pill>
              ) : view.state === "attention" ? (
                <Pill tone="danger" small>
                  {t("upload.pill.needsAttention")}
                </Pill>
              ) : null}
            </div>
            <div className="mt-[3px] text-[12.5px] text-bz-muted">{t(`doc.${key}.hint`)}</div>
            {note ? <div className="mt-0.5 text-[12.5px] text-bz-ink-2">{note}</div> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 ps-[60px] md:ps-0">
          {action === "upload" ? (
            <>
              <span className="hidden text-[12px] text-bz-muted md:inline">
                {multi && rule.maxFiles > 2 ? t("upload.dropMany") : t("upload.dropOne")}
              </span>
              <FlowButton kind="outline" onClick={() => pick("add")}>
                <Upload size={16} strokeWidth={1.6} aria-hidden />
                {multi && rule.maxFiles > 2 ? t("upload.uploadMany") : t("upload.uploadOne")}
              </FlowButton>
            </>
          ) : action === "cancel" ? (
            <FlowButton kind="ghost" size="sm" onClick={cancelAll}>
              {t("upload.cancel")}
            </FlowButton>
          ) : action === "replace" ? (
            <FlowButton kind="ghost" size="sm" onClick={() => pick("replace")}>
              <RefreshCw size={16} strokeWidth={1.6} aria-hidden />
              {t("upload.replace")}
            </FlowButton>
          ) : action === "add_more" ? (
            <FlowButton kind="outline" size="sm" onClick={() => pick("add")}>
              <Plus size={16} strokeWidth={1.6} aria-hidden />
              {t("upload.addMore")}
            </FlowButton>
          ) : (
            <FlowButton kind="outline" onClick={() => pick("choose_another")}>
              <Upload size={16} strokeWidth={1.6} aria-hidden />
              {t("upload.chooseAnother")}
            </FlowButton>
          )}
        </div>
      </div>

      {view.items.length > 0 ? (
        <div className="ph-no-capture mt-4 flex flex-col gap-2.5 border-t border-bz-border pt-3.5 md:ms-[60px]">
          {view.items.map((item) => (
            <UploadedFile
              key={item.localId}
              item={item}
              onRemove={() => onRemove(item.localId)}
              onCancel={() => onCancel(item.localId)}
            />
          ))}
          {view.error?.error ? (
            <div id={errorId} className="flex gap-2 text-[12.5px] leading-[1.5] text-[var(--mrq-danger-fg)]">
              <Glyph name="alert" size={15} className="mt-0.5 shrink-0" />
              <span>
                {errorMessage(kind, view.error.error)}
                {canRetry(view.error.localId) ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => onRetry(view.error!.localId)}
                      className="font-medium underline underline-offset-2"
                    >
                      {t("upload.retry")}
                    </button>
                  </>
                ) : null}
              </span>
            </div>
          ) : null}
          {rule.maxTotalBytes ? (
            <div className="mt-0.5 flex items-center gap-3">
              <div className="h-1 max-w-[320px] flex-1 overflow-hidden rounded-full bg-bz-surface-3" aria-hidden>
                <div
                  className="h-full rounded-full bg-bz-ink-2"
                  style={{ width: `${Math.min(100, (view.usedBytes / rule.maxTotalBytes) * 100)}%` }}
                />
              </div>
              <span className="mono text-[11.5px] whitespace-nowrap text-bz-muted">
                {t("upload.totalUsed", { used: formatMb(view.usedBytes), limit: formatLimitMb(rule.maxTotalBytes) })}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Consent ─────────────────────────────────────────────────────

export function ConsentCheckbox({
  checked,
  onChange,
  label,
  pending,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  pending?: string;
}) {
  return (
    <label
      className={cn(
        "mt-5 flex cursor-pointer items-start gap-3.5 rounded-[14px] border border-bz-border px-5 py-[18px]",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-bz-ink",
        checked ? "bg-bz-surface" : "bg-transparent",
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <CheckMark on={checked} size={20} />
      <span className="text-[13.5px] leading-[1.6]">
        {label}
        {pending ? <span className="text-bz-muted"> {pending}</span> : null}
      </span>
    </label>
  );
}

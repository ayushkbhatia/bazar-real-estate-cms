"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Download, RefreshCw, RotateCw, Send, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { Glyph } from "@/components/mortgage/glyphs";
import { Button } from "@/components/ui/button";
import { DOC_LABEL_KEY } from "@/lib/mortgage-requests/activity";
import { CHECKLISTS } from "@/lib/mortgage-requests/checklists";
import { formatBytes, formatDayMonth, formatTime } from "@/lib/mortgage-requests/cms-format";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import {
  contiguous,
  formatMonthAbbrev,
  formatMonthProse,
  formatMonthShort,
  formatMonthSpan,
  formatPeriodChip,
  periodChoices,
  type Coverage,
} from "@/lib/mortgage-requests/coverage";
import type { DocKind } from "@/lib/mortgage-requests/documents";
import { formatMonthList } from "@/lib/mortgage-requests/format";
import type { ViewerData, ViewerFile } from "@/lib/mortgage-requests/server/review";
import { cn } from "@/lib/utils";
import { acceptDocument, requestReupload, setDocumentCheck, setRecordedFields, setStatementPeriod } from "../_review-actions";
import { useFileCache } from "./file-cache";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

// pdf.js runs in the browser only (file-stage.tsx).
const FileStage = dynamic(() => import("./file-stage").then((m) => m.FileStage), {
  ssr: false,
  loading: () => <div className="py-24 text-center text-[12.5px] text-bz-ink-2">{t("c3.openedPending")}</div>,
});

const HINT_KEY: Record<DocKind, string> = {
  emirates_id: "docHint.emiratesId",
  passport: "docHint.passport",
  salary_certificate: "docHint.salaryCertificate",
  bank_statements_3m: "docHint.bankStatements3m",
  trade_license: "docHint.tradeLicense",
  bank_statements_12m: "docHint.bankStatements12m",
};
const SHORT_KEY: Record<DocKind, string> = {
  emirates_id: "docShort.emiratesId",
  passport: "docShort.passport",
  salary_certificate: "docShort.salaryCertificate",
  bank_statements_3m: "docShort.bankStatements3m",
  trade_license: "docShort.tradeLicense",
  bank_statements_12m: "docShort.bankStatements12m",
};
const REASONS = [
  ["unreadable", "c4.reason.unreadable"],
  ["wrong_document", "c4.reason.wrongDocument"],
  ["expired", "c4.reason.expired"],
  ["period_incomplete", "c4.reason.periodIncomplete"],
  ["pages_missing", "c4.reason.pagesMissing"],
  ["other", "c4.reason.other"],
] as const;
type Reason = (typeof REASONS)[number][0];

const ZOOMS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const STATEMENTS: readonly DocKind[] = ["bank_statements_3m", "bank_statements_12m"];
const GREEN = "oklch(0.55 0.12 145)";
const DANGER_TEXT = "text-[oklch(0.45_0.13_28)]";

// ── Tabs ─────────────────────────────────────────────────────────

function StateDot({ state }: { state: ViewerData["doc"]["state"] }) {
  if (state === "accepted") {
    return (
      <span aria-hidden className="grid size-4 place-items-center rounded-full text-white" style={{ background: GREEN }}>
        <Check size={10} strokeWidth={3} />
      </span>
    );
  }
  if (state === "reupload_requested") {
    return (
      <span
        aria-hidden
        className="grid size-4 place-items-center rounded-full bg-[oklch(0.55_0.18_28)] text-[10px] font-bold leading-none text-white"
      >
        !
      </span>
    );
  }
  return <span aria-hidden className="size-4 rounded-full border-[1.5px] border-[oklch(0.78_0.1_80)]" />;
}

// ── Coverage grid ────────────────────────────────────────────────

function CoverageGrid({ coverage: cov }: { coverage: Coverage }) {
  return (
    <>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cov.total}, minmax(0,1fr))` }} aria-hidden>
        {cov.months.map(({ month, received }) => {
          const [y, m] = month.split("-");
          const name = formatMonthAbbrev(month);
          return (
            <div
              key={month}
              className={cn(
                "flex h-[38px] flex-col items-center justify-center gap-px rounded-md",
                received
                  ? "border border-transparent bg-[oklch(0.94_0.04_145)]"
                  : "border-[1.5px] border-dashed border-[oklch(0.72_0.12_28)] bg-[oklch(0.985_0.01_28)]",
              )}
              title={`${name} ${y}`}
            >
              <span className={cn("text-[11px] font-medium", received ? "text-[oklch(0.35_0.08_145)]" : "text-[oklch(0.48_0.15_28)]")}>
                {name}
              </span>
              <span className={cn("mono text-[9px]", received ? "text-[oklch(0.45_0.06_145)]" : "text-[oklch(0.55_0.12_28)]")}>
                ’{y!.slice(2)}
              </span>
              <span className="sr-only">{m}</span>
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {cov.received.length ? <li>{formatMonthList(cov.received)}</li> : null}
        {cov.missing.length ? (
          <li>
            {t("c4.check.value.missing", {
              months: formatMonthList(cov.missing),
            })}
          </li>
        ) : null}
      </ul>
    </>
  );
}

// ── Checks ───────────────────────────────────────────────────────

function CheckRow({
  label,
  sub,
  on,
  problem = false,
  disabled,
  onToggle,
}: {
  label: string;
  sub: string | null;
  on: boolean;
  /** The sub-line reports something wrong (months missing): red, as C4 shows it. Otherwise it's a hint. */
  problem?: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const subId = useId();
  return (
    <div className="flex gap-2.5 border-t border-bz-border py-2.5 first:border-t-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={label}
        aria-describedby={sub ? subId : undefined}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] text-white",
          on ? "border-transparent" : "border-bz-border-strong bg-bz-surface",
          disabled ? "cursor-default" : "cursor-pointer",
        )}
        style={on ? { background: GREEN } : undefined}
      >
        {on ? <Check size={12} strokeWidth={2.8} /> : null}
      </button>
      <div className="min-w-0">
        <div className="text-[13px]" aria-hidden>
          {label}
        </div>
        {sub ? (
          <div id={subId} className={cn("mt-0.5 text-[11.5px]", problem && !on ? DANGER_TEXT : "text-bz-muted")}>
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function checkSub(key: string, data: ViewerData, recorded: Record<string, string | number>, now: Date): string | null {
  const cov = data.coverage;
  switch (key) {
    case "name_matches":
      return data.request.fullName;
    case "addressed_to_bank":
      return typeof recorded.addressed_to === "string" ? recorded.addressed_to : null;
    case "issued_recently": {
      if (typeof recorded.issued_on !== "string") return null;
      const days = Math.max(0, Math.round((now.getTime() - new Date(`${recorded.issued_on}T00:00:00+04:00`).getTime()) / 86_400_000));
      return t("c3.check.value.issued", {
        date: formatDayMonth(`${recorded.issued_on}T12:00:00+04:00`) + ` ${recorded.issued_on.slice(0, 4)}`,
        days,
      });
    }
    case "signed_and_stamped":
      // What to look for: the design's line, not a reading of the document (CMS-3).
      return t("c3.check.value.signed");
    case "salary_stated":
      return typeof recorded.monthly_gross_aed === "number"
        ? t("c3.check.value.salary", {
            amount: recorded.monthly_gross_aed.toLocaleString("en-US"),
          })
        : null;
    case "holder_matches":
      return typeof recorded.account_holder === "string" ? recorded.account_holder : null;
    case "issued_by_bank":
      return STATEMENTS.includes(data.doc.kind) ? t("c4.check.value.original") : null;
    case "covers_period":
      if (!cov) return null;
      if (cov.complete) return formatMonthSpan(cov.months[0]!.month, cov.months.at(-1)!.month);
      return t("c4.check.value.missing", {
        months: formatMonthList(cov.missing),
      });
    default:
      return null;
  }
}

// ── The re-upload request's first draft (C4) ─────────────────────

function prefill(cov: Coverage | null): string {
  if (!cov || cov.complete) return "";
  const missing = formatMonthList(cov.missing, "en", "long");
  if (cov.received.length === 0) return t("c4.prefill.none", { missing });
  const received = contiguous(cov.received)
    ? formatMonthProse(cov.received[0]!, cov.received.at(-1)!)
    : formatMonthList(cov.received, "en", "long");
  return t(cov.total === 12 ? "c4.prefill.year" : "c4.prefill.months", {
    received,
    missing,
  });
}

// ── The viewer ───────────────────────────────────────────────────

export function DocumentReview({
  data,
  myFirstName,
  startInReupload,
  initialFileId,
}: {
  data: ViewerData;
  myFirstName: string;
  startInReupload: boolean;
  initialFileId: string | null;
}) {
  const router = useRouter();
  const cache = useFileCache();
  const files = data.doc.files;
  const [fileId, setFileId] = useState(
    () => files.find((f) => f.id === initialFileId && !f.scanning)?.id ?? files.find((f) => !f.scanning)?.id ?? null,
  );
  const file = files.find((f) => f.id === fileId) ?? null;
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const docName = t(DOC_LABEL_KEY[data.doc.kind]);
  const multi = files.length > 1;
  const index = data.documents.findIndex((d) => d.kind === data.doc.kind);

  const onOpened = useCallback(() => setOpenedAt(formatTime(new Date())), []);
  const onPages = useCallback((n: number) => setPages(n), []);
  const onPage = useCallback((n: number) => setPage(n), []);

  const zoomBy = useCallback((step: number) => {
    setZoom((z) => {
      const at = ZOOMS.indexOf(z);
      return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (at < 0 ? 3 : at) + step))]!;
    });
  }, []);

  // C3's proposed shortcuts: + and - zoom, R rotates, [ and ] step through files.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") zoomBy(1);
      else if (e.key === "-") zoomBy(-1);
      else if (e.key === "r" || e.key === "R") setRotation((r) => (r + 90) % 360);
      else if ((e.key === "[" || e.key === "]") && files.length > 1) {
        const open = files.filter((f) => !f.scanning);
        const at = open.findIndex((f) => f.id === fileId);
        const next = open[(at + (e.key === "]" ? 1 : -1) + open.length) % open.length];
        if (next) setFileId(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBy, files, fileId]);

  const onTabKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('[role="tab"]'));
    const at = tabs.indexOf(document.activeElement as HTMLAnchorElement);
    tabs[(at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]?.focus();
    e.preventDefault();
  };

  const chipLabel = (f: ViewerFile) => (f.periodFrom && f.periodTo ? formatPeriodChip(f.periodFrom, f.periodTo) : f.name);

  return (
    <div className="grid h-[calc(100dvh-116px)] min-h-[640px] grid-cols-[minmax(0,1fr)_372px] overflow-hidden rounded-xl border border-bz-border bg-bz-surface">
      <div className="flex min-w-0 flex-col border-e border-bz-border">
        {/* Document tabs */}
        <nav
          role="tablist"
          aria-label={t("viewer.tabs")}
          onKeyDown={onTabKey}
          className="flex gap-0 overflow-x-auto border-b border-bz-border px-2.5"
        >
          {data.documents.map((d) => {
            const on = d.kind === data.doc.kind;
            return (
              <Link
                key={d.kind}
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                href={`/admin/mortgages/${data.request.reference}/documents/${d.kind}`}
                className={cn(
                  "-mb-px flex h-[46px] shrink-0 items-center gap-2 border-b-2 px-3 text-[12.5px] whitespace-nowrap",
                  on ? "border-bz-ink font-medium text-bz-ink" : "border-transparent text-bz-ink-2 hover:text-bz-ink",
                )}
              >
                <StateDot state={d.state} />
                {t(DOC_LABEL_KEY[d.kind])}
              </Link>
            );
          })}
        </nav>

        {/* Toolbar */}
        {/* Wraps when narrow: the controls keep together and drop under the files. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-bz-border px-4 py-2.5">
          {multi ? (
            <div className="flex max-w-full min-w-0 flex-wrap gap-1.5">
              {files.map((f) => {
                const on = f.id === fileId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={f.scanning}
                    aria-pressed={on}
                    title={f.scanning ? t("viewer.scanning") : f.name}
                    onClick={() => setFileId(f.id)}
                    className={cn(
                      "inline-flex h-[30px] max-w-[220px] items-center gap-2 rounded-md px-3 text-[12px]",
                      on ? "bg-bz-ink text-bz-bg" : "bg-bz-surface-2 text-bz-ink hover:bg-bz-surface-3",
                      f.scanning && "opacity-50",
                    )}
                  >
                    <span className={cn("mono text-[9px] font-semibold", on ? "" : "text-[oklch(0.5_0.15_28)]")}>
                      {f.mime === "application/pdf" ? "PDF" : f.mime === "image/png" ? "PNG" : "JPG"}
                    </span>
                    <span className="truncate">{chipLabel(f)}</span>
                  </button>
                );
              })}
            </div>
          ) : file ? (
            <span className="mono min-w-0 max-w-full truncate text-[12px] text-bz-ink">
              {t("viewer.fileMeta", {
                name: file.name,
                pages: t("viewer.pages", { count: file.pageCount ?? 1 }),
                size: formatBytes(file.sizeBytes),
              })}
            </span>
          ) : null}
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label={t("viewer.zoomOut")}
              onClick={() => zoomBy(-1)}
              className="grid size-[30px] place-items-center rounded-md border border-bz-border text-bz-ink-2 hover:bg-bz-surface-2"
            >
              <ZoomOut size={15} strokeWidth={1.6} />
            </button>
            <span className="mono w-11 text-center text-[11.5px]" aria-live="polite">
              {t("viewer.zoom", { percent: Math.round(zoom * 100) })}
            </span>
            <button
              type="button"
              aria-label={t("viewer.zoomIn")}
              onClick={() => zoomBy(1)}
              className="grid size-[30px] place-items-center rounded-md border border-bz-border text-bz-ink-2 hover:bg-bz-surface-2"
            >
              <ZoomIn size={15} strokeWidth={1.6} />
            </button>
            <button
              type="button"
              aria-label={t("viewer.rotate")}
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="grid size-[30px] place-items-center rounded-md border border-bz-border text-bz-ink-2 hover:bg-bz-surface-2"
            >
              <RotateCw size={14} strokeWidth={1.6} />
            </button>
            <span aria-hidden className="mx-1 h-5 w-px bg-bz-border" />
            {file ? (
              <Button asChild variant="ghost" className="text-[13px]">
                <a href={`/api/admin/mortgages/files/${file.id}?download=1`}>
                  <Download strokeWidth={1.6} />
                  {t("viewer.download")}
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Stage */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 overflow-auto bg-bz-surface-2 py-7">
            {file ? (
              <FileStage
                file={file}
                cache={cache}
                zoom={zoom}
                rotation={rotation}
                label={docName}
                onOpened={onOpened}
                onPages={onPages}
                onPage={onPage}
              />
            ) : (
              <p className="py-24 text-center text-[12.5px] text-bz-ink-2">{files.length ? t("viewer.scanning") : t("viewer.noFiles")}</p>
            )}
          </div>
          {file ? (
            <span className="mono pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-bz-ink px-3 py-1 text-[11px] whitespace-nowrap text-bz-bg">
              {multi
                ? t("viewer.fileAndPage", {
                    file: files.indexOf(file) + 1,
                    files: files.length,
                    page,
                    total: pages,
                  })
                : t("viewer.page", { page, total: pages })}
            </span>
          ) : null}
        </div>
      </div>

      <ReviewPanel
        key={data.doc.id}
        data={data}
        index={index}
        docName={docName}
        myFirstName={myFirstName}
        openedAt={openedAt}
        startInReupload={startInReupload}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

// ── The review panel ─────────────────────────────────────────────

function ReviewPanel({
  data,
  index,
  docName,
  myFirstName,
  openedAt,
  startInReupload,
  onDone,
}: {
  data: ViewerData;
  index: number;
  docName: string;
  myFirstName: string;
  openedAt: string | null;
  startInReupload: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const kind = data.doc.kind;
  const list = CHECKLISTS[kind];
  const reviewable = data.doc.state === "to_review" && data.can.act;
  const [checks, setChecks] = useState(data.doc.checks);
  const [recorded, setRecorded] = useState(data.doc.recorded);
  // Each save refreshes the page; the panel stays mounted (focus stays where
  // the reviewer is) and takes the saved state from the server.
  const [server, setServer] = useState(data.doc);
  if (server !== data.doc) {
    setServer(data.doc);
    setChecks(data.doc.checks);
    setRecorded(data.doc.recorded);
  }
  const [mode, setMode] = useState<"review" | "reupload">(startInReupload && reviewable ? "reupload" : "review");
  const [pending, start] = useTransition();
  const [now] = useState(() => new Date());
  const isStatement = STATEMENTS.includes(kind);
  const cov = data.coverage;

  // Statements' coverage check is drawn from the months, and saved from them as the document is accepted.
  const allTicked = list.checks.every((c) => (isStatement && cov && c.key === "covers_period" ? cov.complete : checks[c.key] === true));
  const fieldsIn = list.recorded.every((f) => recorded[f.key] !== undefined && recorded[f.key] !== "");
  const canAccept = reviewable && allTicked && fieldsIn && data.doc.files.some((f) => !f.scanning);

  const nextDoc = useMemo(() => {
    const order = data.documents;
    for (let i = 1; i <= order.length; i++) {
      const d = order[(index + i) % order.length]!;
      if (d.kind !== kind && d.state !== "accepted") return d;
    }
    return null;
  }, [data.documents, index, kind]);

  const run = (action: () => Promise<{ ok: boolean; message?: string; warning?: boolean }>, after?: () => void) =>
    start(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) (result.warning ? toast.warning : toast.success)(result.message);
        after?.();
      } else if (result.message) {
        toast.error(result.message);
      }
      onDone();
    });

  const target = {
    reference: data.request.reference,
    documentId: data.doc.id,
    kind,
  };

  const toggle = (key: string) => {
    const value = !(checks[key] === true);
    setChecks((c) => ({ ...c, [key]: value }));
    run(() => setDocumentCheck({ ...target, key, value }));
  };

  const hint = t(HINT_KEY[kind]);
  const required = t("viewer.required", {
    hint: hint.charAt(0).toLowerCase() + hint.slice(1),
  });

  return (
    <aside className="flex min-h-0 flex-col" aria-label={docName}>
      <div className="border-b border-bz-border px-5 pt-[18px] pb-4">
        <div className="eyebrow text-[11px] tracking-[0.12em] text-bz-muted uppercase">
          {t("viewer.eyebrow", {
            index: index + 1,
            total: data.documents.length,
          })}
        </div>
        <h2 className="serif mt-1.5 text-[26px] leading-[1.1]">{docName}</h2>
        <p className="mt-1.5 text-[12px] text-bz-muted">{required}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isStatement && cov ? (
          <div className="border-b border-bz-border px-5 pt-3.5 pb-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-bz-ink-2">
                {cov.total === 12 ? t("c4.coverage.title") : t("c4.coverage.titleN", { count: cov.total })}
              </span>
              <span className={cn("mono text-[11.5px]", cov.complete ? "text-[oklch(0.35_0.08_145)]" : DANGER_TEXT)}>
                {t("c4.coverage.count", { have: cov.have, total: cov.total })}
              </span>
            </div>
            <CoverageGrid coverage={cov} />
            <div className="mt-3">
              {list.checks.map((c) => (
                <CheckRow
                  key={c.key}
                  label={c.label}
                  sub={checkSub(c.key, data, recorded, now)}
                  on={c.key === "covers_period" ? cov.complete : checks[c.key] === true}
                  problem={c.key === "covers_period" && !cov.complete}
                  disabled={!reviewable || c.key === "covers_period" || pending}
                  onToggle={() => toggle(c.key)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="px-5 pt-3.5 pb-2">
            <div className="mb-1 text-[12px] font-medium text-bz-ink-2">{t("viewer.checks")}</div>
            {list.checks.map((c) => (
              <CheckRow
                key={c.key}
                label={c.label}
                sub={checkSub(c.key, data, recorded, now)}
                on={checks[c.key] === true}
                disabled={!reviewable || pending}
                onToggle={() => toggle(c.key)}
              />
            ))}
          </div>
        )}

        {mode === "review" && list.recorded.length ? (
          <RecordFields
            fields={list.recorded}
            recorded={recorded}
            disabled={!reviewable}
            onSave={(key, raw) => {
              run(
                () => setRecordedFields({ ...target, values: { [key]: raw } }),
                () => undefined,
              );
              setRecorded((r) => ({ ...r, [key]: raw }));
            }}
          />
        ) : null}

        {mode === "review" && isStatement && reviewable ? (
          <PeriodEditor
            files={data.doc.files}
            required={data.required}
            disabled={pending}
            onSet={(fileId, from, to) => run(() => setStatementPeriod({ ...target, fileId, from, to }))}
          />
        ) : null}

        {data.doc.state === "accepted" && data.doc.acceptedBy ? (
          <p className="px-5 py-3 text-[12px] text-bz-muted">
            {t("c3.acceptedBy", {
              name: data.doc.acceptedBy.split(" · ")[0]!,
              time: data.doc.acceptedBy.split(" · ")[1] ?? "",
            })}
          </p>
        ) : null}
        {data.doc.state === "reupload_requested" && data.openReupload ? (
          <div className="px-5 py-3 text-[12px] text-bz-ink-2">
            <p>
              {t("c3.awaiting", {
                firstName: data.request.firstName,
                when: formatDayMonth(data.openReupload.requestedAt),
              })}
            </p>
            <blockquote className="mt-1.5 text-bz-muted">{t("activity.quote", { text: data.openReupload.message })}</blockquote>
          </div>
        ) : null}

        {mode === "reupload" ? (
          <ReuploadForm
            data={data}
            coverage={cov}
            disabled={pending}
            onCancel={() => setMode("review")}
            onSend={(input) =>
              run(
                () =>
                  requestReupload({
                    ...input,
                    requestId: data.request.id,
                    reference: data.request.reference,
                    updatedAt: data.request.updatedAt,
                    documentId: data.doc.id,
                    kind,
                  }),
                () => router.push(`/admin/mortgages/${data.request.reference}`),
              )
            }
          />
        ) : null}
      </div>

      {mode === "review" ? (
        <div className="border-t border-bz-border px-5 py-4">
          {reviewable ? (
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1 text-[13px]" disabled={pending} onClick={() => setMode("reupload")}>
                <RefreshCw strokeWidth={1.6} />
                {t("viewer.requestReupload")}
              </Button>
              <Button
                className="h-10 flex-1 text-[13px]"
                disabled={!canAccept || pending}
                title={!allTicked ? undefined : !fieldsIn ? t("c3.fieldsNeeded") : undefined}
                onClick={() => run(() => acceptDocument(target))}
              >
                <Check strokeWidth={2} />
                {t("c3.action.accept")}
              </Button>
            </div>
          ) : !data.can.act ? (
            <p className="text-[12px] text-bz-muted">{t("common.notOwner")}</p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-3 text-[11.5px] text-bz-muted">
            <span className="flex min-w-0 items-center gap-1.5">
              <Glyph name="lock" size={13} />
              <span className="truncate">{openedAt ? t("c3.opened", { name: myFirstName, time: openedAt }) : t("c3.openedPending")}</span>
            </span>
            {nextDoc ? (
              <Link
                href={`/admin/mortgages/${data.request.reference}/documents/${nextDoc.kind}`}
                className="shrink-0 font-medium text-bz-ink hover:underline"
              >
                {t("c3.next", { document: t(SHORT_KEY[nextDoc.kind]) })}
              </Link>
            ) : (
              <Link href={`/admin/mortgages/${data.request.reference}`} className="shrink-0 font-medium text-bz-ink hover:underline">
                {t("c3.allAccepted")}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

// ── Record for pricing (C3) ──────────────────────────────────────

function RecordFields({
  fields,
  recorded,
  disabled,
  onSave,
}: {
  fields: (typeof CHECKLISTS)[DocKind]["recorded"];
  recorded: Record<string, string | number>;
  disabled: boolean;
  onSave: (key: string, raw: string) => void;
}) {
  const id = useId();
  const shown = (f: (typeof fields)[number], value: string | number | undefined) =>
    value === undefined ? "" : f.type === "aed" ? `AED ${Number(value).toLocaleString("en-US")}` : String(value);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, shown(f, recorded[f.key])])),
  );
  // A saved figure comes back from the server; only the fields it changed are
  // rewritten, so one still being typed in keeps what's in it.
  const [server, setServer] = useState(recorded);
  if (server !== recorded) {
    const changed = fields.filter((f) => server[f.key] !== recorded[f.key]);
    setServer(recorded);
    if (changed.length)
      setDraft((d) => ({
        ...d,
        ...Object.fromEntries(changed.map((f) => [f.key, shown(f, recorded[f.key])])),
      }));
  }
  const saved = (key: string) =>
    shown(
      fields.find((x) => x.key === key)!,
      recorded[key],
    );
  return (
    <div className="px-5 pt-2 pb-4">
      <div className="mb-2.5 text-[12px] font-medium text-bz-ink-2">{t("c3.record.title")}</div>
      <div className="grid grid-cols-2 gap-2.5">
        {fields.map((f) => (
          <label key={f.key} htmlFor={`${id}-${f.key}`} className={cn("flex flex-col gap-1", f.type === "text" && "col-span-2")}>
            <span className="text-[11px] text-bz-muted">{f.label}</span>
            <input
              id={`${id}-${f.key}`}
              type={f.type === "month" ? "month" : "text"}
              inputMode={f.type === "aed" ? "numeric" : undefined}
              disabled={disabled}
              value={draft[f.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              onBlur={() => {
                if ((draft[f.key] ?? "") !== saved(f.key)) onSave(f.key, draft[f.key] ?? "");
              }}
              className="h-[34px] w-full rounded-md border border-bz-border bg-bz-surface px-3 text-[12.5px] outline-none focus-visible:border-bz-accent disabled:bg-bz-surface-2"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Statement periods (CMS-5: not designed) ──────────────────────

function PeriodEditor({
  files,
  required,
  disabled,
  onSet,
}: {
  files: readonly ViewerFile[];
  required: readonly string[];
  disabled: boolean;
  onSet: (fileId: string, from: string, to: string) => void;
}) {
  const months = useMemo(() => periodChoices(required), [required]);
  const [values, setValues] = useState<Record<string, { from: string; to: string }>>(() =>
    Object.fromEntries(files.map((f) => [f.id, { from: f.periodFrom ?? "", to: f.periodTo ?? "" }])),
  );
  // After each refresh the server's periods win — a refused one goes back to
  // what was saved — except a half-set pair (a "from" without its "to"),
  // which stays as the reviewer left it.
  const [server, setServer] = useState(files);
  if (server !== files) {
    setServer(files);
    const next = { ...values };
    let dirty = false;
    for (const f of files) {
      const saved = { from: f.periodFrom ?? "", to: f.periodTo ?? "" };
      const local = next[f.id];
      const halfSet = !!local && (local.from === "") !== (local.to === "");
      if (!halfSet && (local?.from !== saved.from || local?.to !== saved.to)) {
        next[f.id] = saved;
        dirty = true;
      }
    }
    if (dirty) setValues(next);
  }
  const change = (fileId: string, part: "from" | "to", value: string) => {
    const next = { ...values[fileId]!, [part]: value };
    setValues((v) => ({ ...v, [fileId]: next }));
    if (next.from && next.to && next.from <= next.to) onSet(fileId, next.from, next.to);
  };
  const select = "h-8 rounded-md border border-bz-border bg-bz-surface px-2 text-[12px]";
  return (
    <div className="border-t border-bz-border px-5 pt-3.5 pb-4">
      <div className="text-[12px] font-medium text-bz-ink-2">{t("c3.period.title")}</div>
      <p className="mt-0.5 mb-2.5 text-[11.5px] text-bz-muted">{t("c3.period.hint")}</p>
      <ul className="flex flex-col gap-2">
        {files.map((f) => (
          <li key={f.id} className="flex flex-col gap-1">
            <span className="mono truncate text-[11px] text-bz-ink-2" title={f.name}>
              {f.name}
            </span>
            <span className="flex items-center gap-1.5">
              <select
                aria-label={`${t("c3.period.from")} · ${f.name}`}
                disabled={disabled}
                value={values[f.id]?.from ?? ""}
                onChange={(e) => change(f.id, "from", e.target.value)}
                className={select}
              >
                <option value="">{t("c3.period.from")}</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthShort(m)}
                  </option>
                ))}
              </select>
              <span className="text-bz-muted">–</span>
              <select
                aria-label={`${t("c3.period.to")} · ${f.name}`}
                disabled={disabled}
                value={values[f.id]?.to ?? ""}
                onChange={(e) => change(f.id, "to", e.target.value)}
                className={select}
              >
                <option value="">{t("c3.period.to")}</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthShort(m)}
                  </option>
                ))}
              </select>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Request re-upload (C4) ───────────────────────────────────────

function ReuploadForm({
  data,
  coverage: cov,
  disabled,
  onCancel,
  onSend,
}: {
  data: ViewerData;
  coverage: Coverage | null;
  disabled: boolean;
  onCancel: () => void;
  onSend: (input: { reason: Reason; message: string; channels: ("whatsapp" | "email")[] }) => void;
}) {
  const shortOfMonths = !!cov && !cov.complete;
  const [reason, setReason] = useState<Reason | null>(shortOfMonths ? "period_incomplete" : null);
  const [message, setMessage] = useState(() => (shortOfMonths ? prefill(cov) : ""));
  const [whatsapp, setWhatsapp] = useState(true);
  const [email, setEmail] = useState(true);
  const pauseId = useId();
  const messageId = useId();
  const firstName = data.request.firstName;
  const channels = [...(whatsapp ? (["whatsapp"] as const) : []), ...(email ? (["email"] as const) : [])];
  const ready = !!reason && message.trim().length > 0 && message.length <= 1000 && channels.length > 0;

  const pick = (r: Reason) => {
    setReason(r);
    if (r === "period_incomplete" && !message.trim()) setMessage(prefill(cov));
  };

  return (
    <>
      <div className="border-t border-bz-border bg-bz-bg px-5 py-3.5">
        <div className="text-[13px] font-medium">{t("viewer.requestReupload")}</div>
        <div role="radiogroup" aria-label={t("viewer.requestReupload")} className="mt-2.5 flex flex-wrap gap-1.5">
          {REASONS.map(([value, key]) => {
            const on = reason === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => pick(value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px]",
                  on
                    ? "border-transparent bg-bz-ink text-bz-bg"
                    : "border-bz-border bg-bz-surface text-bz-ink hover:border-bz-border-strong",
                )}
              >
                {on ? <Check size={11} strokeWidth={2.6} aria-hidden /> : null}
                {t(key)}
              </button>
            );
          })}
        </div>
        <label htmlFor={messageId} className="mt-3.5 mb-1.5 block text-[11.5px] text-bz-muted">
          {t("c4.message.label", { firstName })}
        </label>
        <textarea
          id={messageId}
          rows={4}
          maxLength={1000}
          disabled={disabled}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-y rounded-md border border-bz-border bg-bz-surface px-3 py-2 text-[12.5px] leading-[1.5] outline-none focus-visible:border-bz-accent"
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[12.5px]">
          <span className="text-bz-muted">{t("common.sendBy")}</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={whatsapp}
              disabled={disabled}
              onChange={(e) => setWhatsapp(e.target.checked)}
              className="size-4 accent-bz-ink"
            />
            {t("common.whatsapp")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={email}
              disabled={disabled}
              onChange={(e) => setEmail(e.target.checked)}
              className="size-4 accent-bz-ink"
            />
            {t("common.email")}
          </label>
        </div>
        {whatsapp ? <p className="mt-1.5 text-[11.5px] text-bz-muted">{t("c4.whatsappPending")}</p> : null}
        <p id={pauseId} className="mt-3 flex gap-2 rounded-lg bg-bz-surface-2 px-3 py-2.5 text-[11.5px] leading-[1.5] text-bz-ink-2">
          <Glyph name="pause" size={14} className="mt-px shrink-0" />
          {t("c4.pause", { firstName, count: data.acceptedOthers })}
        </p>
      </div>
      <div className="sticky bottom-0 mt-auto flex gap-2 border-t border-bz-border bg-bz-surface px-5 py-3.5">
        <Button variant="ghost" className="h-10 flex-1 text-[13px]" disabled={disabled} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          className="h-10 flex-[2] text-[13px]"
          disabled={!ready || disabled}
          aria-describedby={pauseId}
          onClick={() => reason && onSend({ reason, message: message.trim(), channels })}
        >
          <Send strokeWidth={1.6} />
          {t("c4.send", { firstName })}
        </Button>
      </div>
    </>
  );
}

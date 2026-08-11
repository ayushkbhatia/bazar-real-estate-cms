"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Archive, ChevronDown, ChevronRight, Download, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubmissionRow } from "@/lib/queries/forms";
import type { FormSubmissionStatus } from "@/lib/forms/types";
import { setSubmissionStatus } from "../_actions";

const FILTERS: { key: FormSubmissionStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "archived", label: "Archived" },
];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * What each form has actually collected.
 *
 * Rows carry their own label snapshot, so a question renamed last month still
 * reads the way the visitor saw it — which matters most for the answers that
 * have no column anywhere else. The lead itself keeps living in Enquiries;
 * this is the record of what was asked and what came back.
 */
export function ResponsesTable({
  formName,
  formKey,
  rows,
  error,
}: {
  formName: string;
  formKey: string;
  rows: SubmissionRow[];
  error: string | null;
}) {
  const [filter, setFilter] = useState<FormSubmissionStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<
    Record<string, FormSubmissionStatus>
  >({});

  const statusOf = (row: SubmissionRow) => statuses[row.id] ?? row.status;

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => statusOf(r) === filter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, filter, statuses],
  );

  /** Every key any row answered, in first-seen order — the CSV's columns. */
  const columns = useMemo(() => {
    const keys: string[] = [];
    const labels: Record<string, string> = {};
    for (const row of rows) {
      for (const key of Object.keys(row.data)) {
        if (!keys.includes(key)) keys.push(key);
        if (!labels[key] && row.labels[key]) labels[key] = row.labels[key]!;
      }
    }
    return { keys, labels };
  }, [rows]);

  function mark(id: string, status: FormSubmissionStatus) {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    startTransition(async () => {
      const result = await setSubmissionStatus(id, status);
      if (result.status === "error") toast.error(result.message);
    });
  }

  function downloadCsv() {
    const header = ["Received", "Status", "Page", "Enquiry"].concat(
      columns.keys.map((k) => columns.labels[k] ?? k),
    );
    const lines = [header, ...rows.map(csvRow)];
    const csv = lines
      .map((cells) =>
        cells
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${formKey}-responses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvRow(row: SubmissionRow): string[] {
    return [
      row.created_at,
      statusOf(row),
      row.source_path ?? "",
      row.enquiry_id ?? "",
      ...columns.keys.map((key) => displayValue(row.data[key])),
    ];
  }

  if (error) {
    return (
      <p className="text-[13px] rounded border border-bz-border bg-bz-surface p-3">
        Couldn&apos;t load responses — {error}. Nothing has been lost; reload to
        try again.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded border border-bz-border bg-bz-surface p-8 text-center">
        <Inbox size={20} className="mx-auto text-bz-muted-2" strokeWidth={1.5} />
        <p className="mt-3 text-[13px] text-bz-ink-2">
          Nothing has come through {formName} yet.
        </p>
        <p className="mt-1 text-[12px] text-bz-muted-2 max-w-[52ch] mx-auto leading-relaxed">
          Responses appear here from the moment the form is submitted — the
          lead itself also lands in Enquiries, where it is worked.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-7 px-2.5 rounded text-[12px] transition-colors",
                filter === f.key
                  ? "bg-bz-navy text-bz-bg"
                  : "text-bz-ink-2 hover:bg-bz-surface-2",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsv}>
          <Download size={13} strokeWidth={1.7} />
          Download CSV
        </Button>
      </div>

      <ul className="flex flex-col gap-1.5">
        {visible.map((row) => {
          const status = statusOf(row);
          const isOpen = expanded === row.id;
          const summary = columns.keys
            .slice(0, 3)
            .map((key) => displayValue(row.data[key]))
            .filter((v) => v !== "—")
            .join(" · ");

          return (
            <li
              key={row.id}
              className={cn(
                "rounded border bg-bz-surface",
                status === "new" ? "border-bz-accent/40" : "border-bz-border",
              )}
            >
              <div className="flex items-center gap-2 p-2.5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => {
                    setExpanded(isOpen ? null : row.id);
                    if (!isOpen && status === "new") mark(row.id, "read");
                  }}
                >
                  {isOpen ? (
                    <ChevronDown size={14} className="shrink-0 text-bz-muted-2" />
                  ) : (
                    <ChevronRight size={14} className="shrink-0 text-bz-muted-2" />
                  )}
                  <span className="mono text-[11px] text-bz-muted-2 shrink-0">
                    {formatWhen(row.created_at)}
                  </span>
                  <span className="truncate text-[12.5px] text-bz-ink-2">
                    {summary || "—"}
                  </span>
                </button>
                {status === "new" ? (
                  <span className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full bg-bz-accent-soft text-bz-accent text-[10.5px] font-medium">
                    New
                  </span>
                ) : null}
                <button
                  type="button"
                  title={status === "archived" ? "Restore" : "Archive"}
                  disabled={pending}
                  onClick={() =>
                    mark(row.id, status === "archived" ? "read" : "archived")
                  }
                  className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded text-bz-ink-2 hover:bg-bz-surface-2 transition-colors"
                >
                  <Archive size={13} strokeWidth={1.7} />
                </button>
              </div>

              {isOpen ? (
                <dl className="border-t border-bz-border p-3 grid gap-2 sm:grid-cols-2">
                  {columns.keys.map((key) => (
                    <div key={key}>
                      <dt className="eyebrow">{row.labels[key] ?? key}</dt>
                      <dd className="text-[12.5px] text-bz-ink-2 whitespace-pre-wrap leading-relaxed">
                        {displayValue(row.data[key])}
                      </dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2 flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11.5px] text-bz-muted-2">
                    {row.source_path ? (
                      <span className="mono">{row.source_path}</span>
                    ) : null}
                    {row.enquiry_id ? (
                      <Link
                        href={`/admin/enquiries/${row.enquiry_id}`}
                        className="text-bz-accent underline underline-offset-2"
                      >
                        Open the enquiry this became →
                      </Link>
                    ) : (
                      <span>No enquiry — this form doesn&apos;t create one.</span>
                    )}
                  </div>
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>

      {visible.length === 0 ? (
        <p className="text-[12.5px] text-bz-muted-2 py-4 text-center">
          Nothing in this filter.
        </p>
      ) : null}
    </div>
  );
}

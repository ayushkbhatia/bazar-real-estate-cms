"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

/**
 * Sprint 7h (backfilled): export button on /admin/analytics.
 * CSV download is fully wired today (the parent passes the rows + filename).
 * PDF activates with Sprint 12's PDF library.
 */
export function AnalyticsExportButton({
  csvRows,
  csvFilename = `bazar-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
}: {
  csvRows: { header: string[]; rows: (string | number)[][] };
  csvFilename?: string;
}) {
  const [open, setOpen] = useState(false);

  function csv() {
    const lines = [csvRows.header.join(",")];
    for (const r of csvRows.rows) {
      lines.push(r.map((v) => quoteCsv(String(v))).join(","));
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  function pdf() {
    setOpen(false);
    toast.info(
      "Branded PDF export wires Sprint 12 (@react-pdf/renderer).",
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
        >
          <Download size={13} strokeWidth={1.7} />
          Export
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={csv}>
          <FileSpreadsheet size={13} strokeWidth={1.7} />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={pdf}>
          <FileText size={13} strokeWidth={1.7} />
          Export PDF · Sprint 12
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function quoteCsv(s: string): string {
  if (!s.includes(",") && !s.includes('"') && !s.includes("\n")) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

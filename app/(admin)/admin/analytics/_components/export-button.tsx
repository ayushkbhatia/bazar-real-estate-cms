"use client";

import { useState, useTransition } from "react";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type PdfSnapshot = {
  rangeLabel: string;
  kpis: {
    site_visits: number;
    property_views: number;
    enquiry_conversion_pct: number;
    form_completions: number;
    closes_aed: number;
  };
  traffic_by_source: { label: string; visits: number; share: number }[];
  top_searches: { query: string; count: number }[];
  top_neighborhoods: { slug: string; name: string; views: number }[];
  agent_leaderboard: {
    display_name: string;
    title: string | null;
    closedAed: number;
    deals: number;
  }[];
};

/**
 * Sprint 7h (backfilled): export button on /admin/analytics. Sprint 12
 * activates the PDF branch — the parent passes the on-screen snapshot
 * so the PDF matches what the user is looking at.
 */
export function AnalyticsExportButton({
  csvRows,
  csvFilename = `bazar-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
  pdfSnapshot,
}: {
  csvRows: { header: string[]; rows: (string | number)[][] };
  csvFilename?: string;
  pdfSnapshot?: PdfSnapshot;
}) {
  const [open, setOpen] = useState(false);
  const [pdfPending, startPdf] = useTransition();

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
    if (!pdfSnapshot) {
      toast.error("No analytics snapshot available.");
      return;
    }
    startPdf(async () => {
      try {
        const res = await fetch("/api/pdf/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pdfSnapshot),
        });
        if (!res.ok) throw new Error(`PDF render failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bazar-analytics-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not generate PDF.",
        );
      }
    });
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
        <DropdownMenuItem onSelect={pdf} disabled={pdfPending}>
          <FileText size={13} strokeWidth={1.7} />
          {pdfPending ? "Generating…" : "Export PDF"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function quoteCsv(s: string): string {
  if (!s.includes(",") && !s.includes('"') && !s.includes("\n")) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

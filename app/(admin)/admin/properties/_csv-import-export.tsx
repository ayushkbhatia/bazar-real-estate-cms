"use client";

import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

/**
 * Sprint 7b (backfilled): CSV import + export buttons on the properties
 * toolbar. Export downloads a CSV of the visible rows immediately (the
 * caller passes the rows). Import is a stub today; Sprint 10 wires the
 * staff-side CSV validator + Postgres upsert.
 */
export function CsvImportExport({
  rows,
}: {
  rows: {
    reference: string;
    title: string;
    status: string;
    type: string;
    price_aed: number;
    beds: number;
    baths: number;
    built_up_ft2: number | null;
    area: string | null;
  }[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function exportCsv() {
    const header = [
      "reference",
      "title",
      "status",
      "type",
      "price_aed",
      "beds",
      "baths",
      "built_up_ft2",
      "area",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.reference,
          quoteCsv(r.title),
          r.status,
          r.type,
          r.price_aed,
          r.beds,
          r.baths,
          r.built_up_ft2 ?? "",
          quoteCsv(r.area ?? ""),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bazar-properties-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    toast.info(
      `${f.name} queued. Server-side CSV upsert activates with Sprint 10.`,
    );
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={exportCsv}
        disabled={rows.length === 0}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12.5px] text-bz-ink-2 hover:border-bz-border-strong transition-colors disabled:opacity-50"
      >
        <Download size={12} strokeWidth={1.7} />
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12.5px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
      >
        <Upload size={12} strokeWidth={1.7} />
        Import CSV
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={onImportFile}
        className="hidden"
      />
    </div>
  );
}

function quoteCsv(s: string): string {
  if (!s.includes(",") && !s.includes('"') && !s.includes("\n")) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

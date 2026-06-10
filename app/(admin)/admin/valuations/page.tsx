import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import {
  listValuationRequests,
  type ValuationListRow,
  type ValuationStatus,
} from "@/lib/queries/valuations";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

const STATUS_TABS: { value: ValuationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In review" },
  { value: "sent", label: "Sent" },
  { value: "archived", label: "Archived" },
];

const STATUS_STYLES: Record<ValuationStatus, string> = {
  pending: "bg-[oklch(0.96_0.05_240)] text-[oklch(0.45_0.1_240)]",
  in_review: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  sent: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  archived: "bg-bz-surface-2 text-bz-muted",
};

const STATUS_LABELS: Record<ValuationStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  sent: "Sent",
  archived: "Archived",
};

function isStatusFilter(s?: string): s is ValuationStatus | "all" {
  return STATUS_TABS.some((t) => t.value === s);
}

function relative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

function formatAedShort(n: string | number | null): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  if (num >= 1_000_000) return `AED ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `AED ${(num / 1_000).toFixed(0)}K`;
  return `AED ${num.toLocaleString()}`;
}

export default async function AdminValuationsPage({
  searchParams,
}: PageProps) {
  const { status: statusRaw } = await searchParams;
  const status = isStatusFilter(statusRaw) ? statusRaw : "all";
  const rows = await listValuationRequests({ status });

  return (
    <CmsShell
      title="Valuations"
      breadcrumbs="Workspace"
    >
      <div className="flex gap-2 mb-5">
        {STATUS_TABS.map((tab) => {
          const active = tab.value === status;
          const href =
            tab.value === "all"
              ? "/admin/valuations"
              : `/admin/valuations?status=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={cn(
                "px-3.5 py-1.5 rounded text-[13px] transition-colors",
                active
                  ? "bg-bz-ink text-bz-bg"
                  : "bg-bz-surface border border-bz-border text-bz-ink-2 hover:border-bz-border-strong",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="border border-bz-border rounded-lg overflow-hidden">
            <table className="w-full text-[13.5px]" data-testid="valuations-list">
            <thead className="bg-bz-surface-2 text-[11.5px] uppercase tracking-wider text-bz-muted">
              <tr>
                <th className="text-left px-4 py-2.5">Owner</th>
                <th className="text-left px-4 py-2.5">Property</th>
                <th className="text-left px-4 py-2.5">Instant range</th>
                <th className="text-left px-4 py-2.5">Advisor</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Submitted</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RowLine key={r.id} row={r} />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </CmsShell>
  );
}

function RowLine({ row }: { row: ValuationListRow }) {
  const propertyLine = [
    row.building_name,
    row.area_name,
    row.beds ? `${row.beds} bd` : null,
    row.built_up_ft2 ? `${row.built_up_ft2.toLocaleString()} ft²` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <tr className="border-t border-bz-border hover:bg-bz-surface-2">
      <td className="px-4 py-3">
        <div className="font-medium">{row.owner_name}</div>
        <div className="text-[12px] text-bz-muted">{row.owner_email}</div>
      </td>
      <td className="px-4 py-3 max-w-[280px]">{propertyLine || "—"}</td>
      <td className="px-4 py-3 mono text-[12.5px]">
        {row.estimate_low_aed && row.estimate_high_aed
          ? `${formatAedShort(row.estimate_low_aed)} – ${formatAedShort(row.estimate_high_aed)}`
          : "—"}
      </td>
      <td className="px-4 py-3">{row.advisor_display_name ?? "—"}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "px-2 py-0.5 rounded text-[11px] uppercase tracking-wider",
            STATUS_STYLES[row.status],
          )}
        >
          {STATUS_LABELS[row.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-bz-muted text-[12.5px]">
        {relative(row.created_at)} ago
      </td>
      <td className="px-2 py-3 text-bz-muted">
        <Link
          href={`/admin/valuations/${row.id}`}
          className="hover:text-bz-ink"
          aria-label="Open"
        >
          <ChevronRight size={16} />
        </Link>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-bz-border rounded-lg p-12 text-center">
      <h3 className="serif text-[20px]">No valuation requests yet</h3>
      <p className="text-[13px] text-bz-muted mt-2">
        When an owner submits the form at /tools/valuation, the row lands
        here. The status starts at <strong>Pending</strong>.
      </p>
    </div>
  );
}

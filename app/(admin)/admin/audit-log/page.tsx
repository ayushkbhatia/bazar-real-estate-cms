import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import {
  AUDIT_PAGE_SIZE,
  listAuditLog,
  parseAuditFilters,
  type AuditLogRow,
} from "@/lib/queries/audit";
import {
  BULK_OPERATIONS_PAGE_SIZE,
  listBulkOperations,
  type BulkOperationRow,
} from "@/lib/queries/bulk-operations";
import { AuditLogFilters } from "./_filters";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatIsoUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  if (!(await currentUserIsAdmin())) {
    redirect("/admin?error=admins_only");
  }
  const params = await searchParams;
  const isBulkView = params.kind === "bulk";
  const filters = parseAuditFilters(params);
  const page = Math.max(
    0,
    Number(typeof params.page === "string" ? params.page : "0") || 0,
  );

  if (isBulkView) {
    return <BulkOperationsView page={page} params={params} />;
  }

  const { rows, total, actions, target_kinds } = await listAuditLog(
    filters,
    page,
  );

  const exportQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (typeof v === "string" && v) exportQuery.set(k, v);
  }

  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  return (
    <CmsShell
      title="Audit log"
      breadcrumbs="Admin"
      primary={
        <Button asChild variant="outline" size="sm">
          <a href={`/api/admin/audit-log/export?${exportQuery.toString()}`}>
            <Download size={14} strokeWidth={1.7} />
            Export CSV
          </a>
        </Button>
      }
    >
      <div className="flex flex-col gap-5 min-w-0">
        <AuditLogFilters
          initial={filters}
          actionOptions={actions}
          targetKindOptions={target_kinds}
        />

        <div className="flex items-center justify-between gap-3 text-[12.5px] text-bz-muted">
          <div>
            {total.toLocaleString()} entr{total === 1 ? "y" : "ies"}
            {pages > 1 ? (
              <span className="ml-2">
                · page {page + 1} of {pages}
              </span>
            ) : null}
          </div>
          <Link
            href="/admin/audit-log?kind=bulk"
            className="text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            View bulk operations →
          </Link>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10.5px] text-bz-muted-2 uppercase tracking-wider border-b border-bz-border">
                <th className="px-4 py-3 w-[16%]">When</th>
                <th className="px-3 py-3 w-[20%]">Actor</th>
                <th className="px-3 py-3 w-[22%]">Action</th>
                <th className="px-3 py-3 w-[16%]">Target</th>
                <th className="px-3 py-3 w-[26%]">Diff</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-16 text-center text-bz-muted text-[12.5px]"
                  >
                    No audit entries match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => <AuditRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pages={pages}
          searchParams={params}
        />

        <Eyebrow>About audit entries</Eyebrow>
        <p className="text-[12.5px] text-bz-muted max-w-[80ch] -mt-3">
          Audit rows are append-only and admin-readable. They cover every
          permission change, publish, role swap, suspend, and a handful of
          settings + viewing mutations since Phase 1. RLS guarantees nothing
          but the admin role can read this view.
        </p>
      </div>
    </CmsShell>
  );
}

function AuditRow({ row }: { row: AuditLogRow }) {
  const before = jsonString(row.before);
  const after = jsonString(row.after);
  return (
    <tr className="border-b border-bz-border last:border-b-0 align-top">
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-medium">{relativeTime(row.at)}</div>
        <div className="text-[11px] text-bz-muted mono">
          {formatIsoUtc(row.at)}
        </div>
      </td>
      <td className="px-3 py-3">
        {row.actor_display_name ? (
          <>
            <div className="font-medium truncate">
              {row.actor_display_name}
            </div>
            {row.actor_email ? (
              <div className="text-[11px] text-bz-muted truncate">
                {row.actor_email}
              </div>
            ) : null}
          </>
        ) : row.actor_email ? (
          <div className="font-medium truncate">{row.actor_email}</div>
        ) : (
          <span className="inline-flex items-center h-[20px] px-1.5 rounded text-[10.5px] font-medium bg-bz-surface-2 text-bz-muted">
            {row.actor_kind}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-medium bg-bz-surface-2 text-bz-ink-2 mono">
          {row.action}
        </span>
      </td>
      <td className="px-3 py-3">
        {row.target_kind ? (
          <>
            <div className="text-[12.5px] text-bz-ink-2">{row.target_kind}</div>
            {row.target_id ? (
              <div className="text-[11px] text-bz-muted mono truncate">
                {row.target_id}
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-bz-muted text-[12px]">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-[11.5px] text-bz-muted">
        {before && after ? (
          <details>
            <summary className="cursor-pointer text-bz-ink hover:text-bz-accent">
              show diff
            </summary>
            <pre className="mt-2 max-h-[140px] overflow-auto bg-bz-surface-2 p-2 rounded text-[11px] leading-[1.4] font-mono">
              before: {before}
              {"\n"}after:  {after}
            </pre>
          </details>
        ) : after ? (
          <pre className="bg-bz-surface-2 p-2 rounded text-[11px] leading-[1.4] font-mono max-h-[80px] overflow-auto">
            {after}
          </pre>
        ) : before ? (
          <pre className="bg-bz-surface-2 p-2 rounded text-[11px] leading-[1.4] font-mono max-h-[80px] overflow-auto">
            {before}
          </pre>
        ) : (
          <span className="text-bz-muted">—</span>
        )}
      </td>
    </tr>
  );
}

function jsonString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 0);
  } catch {
    return null;
  }
}

async function BulkOperationsView({
  page,
  params,
}: {
  page: number;
  params: Record<string, string | string[] | undefined>;
}) {
  const { rows, total } = await listBulkOperations(page);
  const pages = Math.max(1, Math.ceil(total / BULK_OPERATIONS_PAGE_SIZE));

  return (
    <CmsShell title="Audit log · bulk operations" breadcrumbs="Admin">
      <div className="flex flex-col gap-5 min-w-0">
        <div className="flex items-center justify-between gap-3 text-[12.5px] text-bz-muted">
          <div>
            {total.toLocaleString()} bulk{" "}
            {total === 1 ? "operation" : "operations"}
            {pages > 1 ? (
              <span className="ml-2">
                · page {page + 1} of {pages}
              </span>
            ) : null}
          </div>
          <Link
            href="/admin/audit-log"
            className="text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            ← Back to per-row audit log
          </Link>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10.5px] text-bz-muted-2 uppercase tracking-wider border-b border-bz-border">
                <th className="px-4 py-3 w-[16%]">When</th>
                <th className="px-3 py-3 w-[22%]">Actor</th>
                <th className="px-3 py-3 w-[18%]">Action</th>
                <th className="px-3 py-3 w-[10%]">Target</th>
                <th className="px-3 py-3 w-[12%]">Count</th>
                <th className="px-3 py-3 w-[22%]">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-bz-muted text-[12.5px]"
                  >
                    No bulk operations yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => <BulkOpRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>

        <BulkPagination
          page={page}
          pages={pages}
          searchParams={params}
        />

        <Eyebrow>About this view</Eyebrow>
        <p className="text-[12.5px] text-bz-muted max-w-[80ch] -mt-3">
          Each row is one user-initiated bulk action (publish, off-market,
          reassign, archive). The per-row audit trail lives on the main
          audit-log view — this is an index for &ldquo;which bulks ran
          today&rdquo;.
        </p>
      </div>
    </CmsShell>
  );
}

function BulkOpRow({ row }: { row: BulkOperationRow }) {
  const okN = row.succeeded.length;
  const skippedN = row.skipped.length;
  return (
    <tr className="border-b border-bz-border last:border-b-0 align-top">
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-medium">{relativeTime(row.created_at)}</div>
        <div className="text-[11px] text-bz-muted mono">
          {formatIsoUtc(row.created_at)}
        </div>
      </td>
      <td className="px-3 py-3">
        {row.actor_display_name ? (
          <>
            <div className="font-medium truncate">{row.actor_display_name}</div>
            {row.actor_email ? (
              <div className="text-[11px] text-bz-muted truncate">
                {row.actor_email}
              </div>
            ) : null}
          </>
        ) : row.actor_email ? (
          <div className="font-medium truncate">{row.actor_email}</div>
        ) : (
          <span className="text-bz-muted text-[12px]">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-medium bg-bz-surface-2 text-bz-ink-2 mono">
          {row.action}
        </span>
      </td>
      <td className="px-3 py-3 text-[12.5px] text-bz-ink-2">{row.target_kind}</td>
      <td className="px-3 py-3 mono text-[12.5px]">{row.target_count}</td>
      <td className="px-3 py-3 text-[12px]">
        <div>
          <span className="text-[oklch(0.45_0.1_145)] font-medium">{okN}</span>{" "}
          <span className="text-bz-muted">ok</span>
          {skippedN > 0 ? (
            <>
              {" · "}
              <span className="text-[oklch(0.45_0.13_28)] font-medium">{skippedN}</span>{" "}
              <span className="text-bz-muted">skipped</span>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function BulkPagination({
  page,
  pages,
  searchParams,
}: {
  page: number;
  pages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (pages <= 1) return null;
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string" && v && k !== "page") baseParams.set(k, v);
  }
  function hrefFor(p: number) {
    const next = new URLSearchParams(baseParams);
    if (p > 0) next.set("page", String(p));
    return `/admin/audit-log${next.toString() ? `?${next}` : ""}`;
  }
  return (
    <div className="flex items-center gap-2 self-end">
      <Link
        aria-disabled={page === 0}
        href={hrefFor(Math.max(0, page - 1))}
        className={
          page === 0
            ? "pointer-events-none opacity-40 inline-flex items-center gap-1 px-2 h-8 text-[12.5px] text-bz-muted"
            : "inline-flex items-center gap-1 px-2 h-8 text-[12.5px] text-bz-ink hover:text-bz-accent"
        }
      >
        <ChevronLeft size={13} strokeWidth={1.7} /> Prev
      </Link>
      <span className="text-[11.5px] text-bz-muted">
        {page + 1} / {pages}
      </span>
      <Link
        aria-disabled={page + 1 >= pages}
        href={hrefFor(Math.min(pages - 1, page + 1))}
        className={
          page + 1 >= pages
            ? "pointer-events-none opacity-40 inline-flex items-center gap-1 px-2 h-8 text-[12.5px] text-bz-muted"
            : "inline-flex items-center gap-1 px-2 h-8 text-[12.5px] text-bz-ink hover:text-bz-accent"
        }
      >
        Next <ChevronRight size={13} strokeWidth={1.7} />
      </Link>
    </div>
  );
}

function Pagination({
  page,
  pages,
  searchParams,
}: {
  page: number;
  pages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (pages <= 1) return null;
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string" && v && k !== "page") baseParams.set(k, v);
  }
  function hrefFor(p: number) {
    const next = new URLSearchParams(baseParams);
    if (p > 0) next.set("page", String(p));
    return `/admin/audit-log${next.toString() ? `?${next}` : ""}`;
  }
  return (
    <div className="flex items-center gap-2 self-end">
      <Link
        aria-disabled={page === 0}
        href={hrefFor(Math.max(0, page - 1))}
        className={
          page === 0
            ? "pointer-events-none opacity-40 inline-flex items-center gap-1 px-2 h-8 text-[12.5px] text-bz-muted"
            : "inline-flex items-center gap-1 px-2 h-8 text-[12.5px] text-bz-ink hover:text-bz-accent"
        }
      >
        <ChevronLeft size={13} strokeWidth={1.7} /> Prev
      </Link>
      <span className="text-[11.5px] text-bz-muted">
        {page + 1} / {pages}
      </span>
      <Link
        aria-disabled={page + 1 >= pages}
        href={hrefFor(Math.min(pages - 1, page + 1))}
        className={
          page + 1 >= pages
            ? "pointer-events-none opacity-40 inline-flex items-center gap-1 px-2 h-8 text-[12.5px] text-bz-muted"
            : "inline-flex items-center gap-1 px-2 h-8 text-[12.5px] text-bz-ink hover:text-bz-accent"
        }
      >
        Next <ChevronRight size={13} strokeWidth={1.7} />
      </Link>
    </div>
  );
}

import Link from "next/link";
import {
  ChevronRight,
  Database,
  ExternalLink,
  LayoutList,
  Plus,
} from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  evaluateDevelopmentHeroFacts,
  formatStartingPrice,
  quarterLabel,
} from "@/lib/schemas/development";
import { listDevelopmentSubPages } from "@/lib/queries/subpages";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pre_launch: "bg-bz-accent-soft text-bz-accent",
  on_sale: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  sold_out: "bg-bz-surface-3 text-bz-muted",
  handed_over: "bg-bz-surface-2 text-bz-ink-2",
};

const STATUS_LABELS: Record<string, string> = {
  pre_launch: "Pre-launch",
  on_sale: "On sale",
  sold_out: "Sold out",
  handed_over: "Handed over",
};

/**
 * The one place developments are worked on.
 *
 * A project has two editable halves — its **record** (units, prices, payment
 * plan, publishing) and its **page** (section order, copy, imagery). Those
 * used to live in two separate lists, one of which wasn't linked from the
 * sidebar at all. This is the single list; each row opens either half.
 */
export default async function DevelopmentSubPagesIndex() {
  const rows = await listDevelopmentSubPages();
  const live = rows.filter((r) => r.published_at !== null).length;
  const drafts = rows.length - live;

  // What each draft still needs before it can go live — the same gate the
  // publish action enforces. Shown here so a half-finished project can be
  // picked back up without opening it to find out what is missing.
  const outstanding = new Map<string, number>(
    rows
      .filter((r) => r.published_at === null)
      .map((r) => [
        r.id,
        evaluateDevelopmentHeroFacts({
          starting_price:
            r.starting_price != null ? Number(r.starting_price) : null,
          bedrooms_text: r.bedrooms_text,
          total_units: r.total_units,
          handover_date: r.handover_date,
        }).blockers.length,
      ]),
  );

  return (
    <CmsShell
      title="Developments"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub" className="hover:text-bz-ink">
            Sub-pages
          </Link>
          <ChevronRight size={11} />
          <span>Developments</span>
        </span>
      }
      primary={
        <Button asChild>
          <Link href="/admin/pages/sub/development/new">
            <Plus size={14} strokeWidth={1.8} />
            Add development
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed max-w-[80ch]">
          Every project, with both halves in one place.{" "}
          <span className="text-bz-ink">Page</span> opens the layout editor —
          section order, copy and imagery for{" "}
          <span className="mono">/developments/&lt;slug&gt;</span>.{" "}
          <span className="text-bz-ink">Record</span> opens the project&apos;s
          facts — units, payment plan, handover and publishing.
        </p>

        <div className="text-[12.5px] text-bz-muted">
          {rows.length} {rows.length === 1 ? "project" : "projects"} · {live}{" "}
          live · {drafts} {drafts === 1 ? "draft" : "drafts"}
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Handover</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-16 text-bz-muted"
                  >
                    No projects yet — start one with{" "}
                    <Link
                      href="/admin/pages/sub/development/new"
                      className="text-bz-ink underline"
                    >
                      Add development
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/pages/sub/development/${row.slug}`}
                        className="block hover:text-bz-accent transition-colors"
                      >
                        <div className="font-medium truncate max-w-[36ch]">
                          {row.name}
                        </div>
                        <div className="mono text-[11px] text-bz-muted mt-0.5 truncate">
                          /developments/{row.slug}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                            STATUS_STYLES[row.status] ??
                              "bg-bz-surface-2 text-bz-ink-2",
                          )}
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                        {row.published_at ? null : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium bg-bz-surface-3 text-bz-ink-2">
                              Draft
                            </span>
                            {/* Named here so an unfinished project can be
                                picked up without opening it first. */}
                            {(outstanding.get(row.id) ?? 0) > 0 ? (
                              <span className="text-[11px] text-bz-muted-2">
                                {outstanding.get(row.id)} to add
                              </span>
                            ) : (
                              <span className="text-[11px] text-bz-muted-2">
                                ready to publish
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-bz-ink-2 text-[12.5px]">
                      {row.developer ?? "—"}
                    </TableCell>
                    <TableCell className="text-bz-ink-2 text-[12.5px]">
                      {row.area ?? "—"}
                    </TableCell>
                    <TableCell className="text-bz-ink-2 text-[12.5px]">
                      {quarterLabel(row.handover_date)}
                    </TableCell>
                    <TableCell className="mono text-[12.5px]">
                      {row.total_units ?? "—"}
                    </TableCell>
                    <TableCell className="mono text-[12.5px] font-medium">
                      {formatStartingPrice(row.starting_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/pages/sub/development/${row.slug}`}
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          title="Section order, copy and imagery"
                        >
                          <LayoutList size={12} /> Page
                        </Link>
                        <Link
                          href={`/admin/developments/${row.id}`}
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          title="Units, payment plan, handover, publishing"
                        >
                          <Database size={12} /> Record
                        </Link>
                        {row.published_at ? (
                          <Link
                            href={`/developments/${row.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          >
                            View <ExternalLink size={12} />
                          </Link>
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </CmsShell>
  );
}

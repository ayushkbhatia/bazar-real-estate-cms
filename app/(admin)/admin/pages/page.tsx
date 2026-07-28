import Link from "next/link";
import { Plus, ExternalLink } from "lucide-react";
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
import { listAllPagesForAdmin, pageUrl, type PageListRow } from "@/lib/queries/pages";
import { MASTER_PAGES } from "@/lib/master-pages";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: PageListRow["status"] }) {
  const styles: Record<PageListRow["status"], string> = {
    draft: "bg-bz-surface-2 text-bz-ink-2",
    published: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  };
  const label: Record<PageListRow["status"], string> = {
    draft: "Draft",
    published: "Published",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
        styles[status],
      )}
    >
      {label[status]}
    </span>
  );
}

function relative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  const days = Math.floor(diff / day);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default async function AdminPagesPage() {
  const { rows, total } = await listAllPagesForAdmin({ limit: 200 });

  return (
    <CmsShell
      title="Pages"
      breadcrumbs="Content · Pages & blocks"
      primary={
        <Button asChild>
          <Link href="/admin/pages/new">
            <Plus size={14} strokeWidth={1.8} />
            New page
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[14px] font-medium">Master pages</h2>
            <p className="text-[13px] text-bz-muted max-w-[70ch] mt-1">
              The marketing pages. Reorder their sections, hide the ones you
              don&apos;t need, and edit copy, links and images without touching
              code.
            </p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {MASTER_PAGES.map((p) => (
              <li key={p.key}>
                <Link
                  href={`/admin/pages/master/${p.key}`}
                  className="flex h-full flex-col gap-1 rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-accent transition-colors"
                >
                  <span className="text-[13.5px] font-medium">{p.label}</span>
                  <span className="mono text-[11px] text-bz-muted">
                    {p.path}
                  </span>
                  <span className="mt-1 text-[11.5px] text-bz-muted-2">
                    {p.sections.length} sections
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-[13px] text-bz-muted max-w-[60ch] border-t border-bz-border pt-6">
          Block-based content pages. Each lives at <span className="mono">/pages/&lt;slug&gt;</span>.
          Compose hero, strip, split, grid, and banner blocks; publish when ready.
        </p>

        <div className="flex items-baseline justify-between">
          <div className="text-[13px] text-bz-muted">
            {total} {total === 1 ? "page" : "pages"}
          </div>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-16 text-bz-muted"
                  >
                    No pages yet — start one with{" "}
                    <Link href="/admin/pages/new" className="text-bz-ink underline">
                      New page
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/pages/${row.id}`}
                        className="font-medium hover:text-bz-accent transition-colors"
                      >
                        {row.title}
                      </Link>
                    </TableCell>
                    <TableCell className="mono text-[12px] text-bz-muted">
                      /{row.slug}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={row.status} />
                    </TableCell>
                    <TableCell className="text-bz-muted text-[12px]">
                      {relative(row.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === "published" ? (
                        <Link
                          href={pageUrl(row)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                        >
                          View <ExternalLink size={12} />
                        </Link>
                      ) : (
                        <span className="text-[12px] text-bz-muted-2">—</span>
                      )}
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

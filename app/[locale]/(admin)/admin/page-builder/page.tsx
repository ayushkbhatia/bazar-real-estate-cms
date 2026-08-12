import Link from "next/link";
import { ExternalLink, LayoutTemplate, Plus } from "lucide-react";
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
  landingUrl,
  listLandingPagesForAdmin,
  type LandingListRow,
} from "@/lib/queries/landing-pages";
import { RowActions } from "./_row-actions";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: LandingListRow["status"] }) {
  const styles: Record<LandingListRow["status"], string> = {
    draft: "bg-bz-surface-2 text-bz-ink-2",
    published: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  };
  const label: Record<LandingListRow["status"], string> = {
    draft: "Draft",
    published: "Live",
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

function PageTable({ rows }: { rows: LandingListRow[] }) {
  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="w-[110px]">Status</TableHead>
            <TableHead className="w-[90px]">Sections</TableHead>
            <TableHead className="w-[110px]">Updated</TableHead>
            <TableHead className="w-[52px] text-end">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/admin/page-builder/${row.id}`}
                  className="font-medium hover:text-bz-accent"
                >
                  {row.title}
                </Link>
                {row.has_draft ? (
                  <span className="ms-2 inline-flex items-center h-[20px] px-2 rounded-full bg-[oklch(0.95_0.05_85)] text-[oklch(0.38_0.09_75)] text-[10.5px] font-medium">
                    Unpublished changes
                  </span>
                ) : null}
                {row.noindex ? (
                  <span className="ms-2 text-[10.5px] text-bz-muted-2">
                    no-index
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="mono text-[12px] text-bz-muted">
                {row.status === "published" ? (
                  <a
                    href={landingUrl(row)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-bz-ink"
                  >
                    /lp/{row.slug}
                    <ExternalLink size={11} strokeWidth={1.7} />
                  </a>
                ) : (
                  <span>/lp/{row.slug}</span>
                )}
              </TableCell>
              <TableCell>
                <StatusPill status={row.status} />
              </TableCell>
              <TableCell className="text-[12.5px] text-bz-muted">
                {row.block_count}
              </TableCell>
              <TableCell className="text-[12.5px] text-bz-muted">
                {relative(row.updated_at)}
              </TableCell>
              <TableCell className="text-end">
                <RowActions
                  id={row.id}
                  slug={row.slug}
                  title={row.title}
                  status={row.status}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function PageBuilderListPage() {
  const rows = await listLandingPagesForAdmin();
  const drafts = rows.filter((r) => r.status === "draft");
  const live = rows.filter((r) => r.status === "published");

  return (
    <CmsShell
      title="Page builder"
      breadcrumbs={<>Content · Page builder</>}
      primary={
        <Button asChild size="sm">
          <Link href="/admin/page-builder/new">
            <Plus size={14} strokeWidth={1.8} />
            New landing page
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <p className="text-[13px] text-bz-muted max-w-[70ch]">
          Campaign landing pages, assembled from the sections the site already
          uses. Each one lives at <span className="mono">/lp/&lt;url&gt;</span>.
          Edits are saved as a draft — the live page only changes when you press
          Publish.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="text-[13.5px] font-medium">
            Drafts{" "}
            <span className="text-bz-muted font-normal">({drafts.length})</span>
          </h2>
          {drafts.length > 0 ? (
            <PageTable rows={drafts} />
          ) : (
            <div className="rounded-lg border border-dashed border-bz-border bg-bz-surface px-5 py-10 text-center">
              <LayoutTemplate
                size={22}
                strokeWidth={1.5}
                className="mx-auto text-bz-muted-2"
              />
              <p className="mt-3 text-[13px] text-bz-muted">
                No drafts. Start one from a preset or a blank page.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link href="/admin/page-builder/new">New landing page</Link>
              </Button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[13.5px] font-medium">
            Live{" "}
            <span className="text-bz-muted font-normal">({live.length})</span>
          </h2>
          {live.length > 0 ? (
            <PageTable rows={live} />
          ) : (
            <p className="text-[13px] text-bz-muted">
              Nothing published yet.
            </p>
          )}
        </section>
      </div>
    </CmsShell>
  );
}

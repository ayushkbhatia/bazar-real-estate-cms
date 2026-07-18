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
import {
  articleUrl,
  listAllArticlesForAdmin,
  type ArticleListRow,
} from "@/lib/queries/articles";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: ArticleListRow["status"] }) {
  const styles: Record<ArticleListRow["status"], string> = {
    draft: "bg-bz-surface-2 text-bz-ink-2",
    scheduled: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
    published: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
    archived: "bg-bz-surface-3 text-bz-muted",
  };
  const label: Record<ArticleListRow["status"], string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    published: "Published",
    archived: "Archived",
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

export default async function AdminBlogPage() {
  const { rows, total } = await listAllArticlesForAdmin({ limit: 100 });

  return (
    <CmsShell
      title="Insights"
      breadcrumbs="Content · Blog"
      primary={
        <Button asChild>
          <Link href="/admin/blog/new">
            <Plus size={14} strokeWidth={1.8} />
            New article
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] text-bz-muted">
            {total} {total === 1 ? "article" : "articles"}
          </div>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44%]">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-bz-muted">
                    No articles yet — start the first one with{" "}
                    <Link
                      href="/admin/blog/new"
                      className="text-bz-ink underline"
                    >
                      New article
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/blog/${row.id}`}
                        className="block hover:text-bz-accent transition-colors"
                      >
                        <div className="font-medium truncate max-w-[60ch]">
                          {row.title}
                        </div>
                        <div className="mono text-[11px] text-bz-muted mt-0.5">
                          {row.slug}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={row.status} />
                    </TableCell>
                    <TableCell className="text-bz-ink-2 text-[12.5px]">
                      {row.category_label}
                    </TableCell>
                    <TableCell className="text-bz-ink-2 text-[12.5px]">
                      {row.author?.display_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-bz-muted text-[12px]">
                      {relative(row.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === "published" ? (
                        <Link
                          href={articleUrl(row)}
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          target="_blank"
                          rel="noreferrer"
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

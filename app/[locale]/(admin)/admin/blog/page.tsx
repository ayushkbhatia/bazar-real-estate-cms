import Link from "next/link";
import { Plus, ExternalLink, Trash2 } from "lucide-react";
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
import { currentStaffRow } from "@/lib/queries/staff";
import { BlogRowActions } from "./_row-actions";

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

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBlogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view = (Array.isArray(sp.view) ? sp.view[0] : sp.view) ?? "";
  const trashed = view === "trash";

  const [{ rows, total }, trash, staff] = await Promise.all([
    listAllArticlesForAdmin({ limit: 100, trashed }),
    listAllArticlesForAdmin({ limit: 1, trashed: true }),
    currentStaffRow(),
  ]);
  const canDestroy = staff?.role === "admin";

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
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
            <Link
              href="/admin/blog"
              aria-current={trashed ? undefined : "page"}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
                trashed
                  ? "text-bz-ink-2 hover:text-bz-ink"
                  : "bg-bz-navy text-bz-bg font-medium",
              )}
            >
              Articles
            </Link>
            <Link
              href="/admin/blog?view=trash"
              aria-current={trashed ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
                trashed
                  ? "bg-bz-navy text-bz-bg font-medium"
                  : "text-bz-ink-2 hover:text-bz-ink",
              )}
            >
              <Trash2 size={12} strokeWidth={1.8} />
              Trash
              <span
                className={cn(
                  "mono text-[10.5px]",
                  trashed ? "text-bz-bg/80" : "text-bz-muted",
                )}
              >
                {trash.total}
              </span>
            </Link>
          </div>
          <div className="text-[13px] text-bz-muted">
            {total} {total === 1 ? "article" : "articles"}
            {trashed ? " in trash" : ""}
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
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-bz-muted">
                    {trashed ? (
                      "Trash is empty. Posts you delete land here first."
                    ) : (
                      <>
                        No articles yet — start the first one with{" "}
                        <Link
                          href="/admin/blog/new"
                          className="text-bz-ink underline"
                        >
                          New article
                        </Link>
                        .
                      </>
                    )}
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
                    <TableCell className="text-end">
                      <span className="inline-flex items-center justify-end gap-2">
                        {row.status === "published" && !trashed ? (
                          <Link
                            href={articleUrl(row)}
                            className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                            target="_blank"
                            rel="noreferrer"
                          >
                            View <ExternalLink size={12} />
                          </Link>
                        ) : null}
                        <BlogRowActions
                          id={row.id}
                          title={row.title}
                          archived={row.status === "archived"}
                          trashed={trashed}
                          canDestroy={canDestroy}
                        />
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

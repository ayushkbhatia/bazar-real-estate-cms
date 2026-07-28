import Link from "next/link";
import { ChevronRight, ExternalLink, Plus } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listDevelopmentSubPages } from "@/lib/queries/subpages";

export const dynamic = "force-dynamic";

export default async function SubPagesIndex() {
  const rows = await listDevelopmentSubPages();
  const live = rows.filter((r) => r.published_at !== null).length;

  return (
    <CmsShell
      title="Development pages"
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
            Add development page
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5 max-w-[900px]">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed">
          Project pages under <span className="mono">/developments</span>. Each
          one is built from the same template, so editing here changes the copy,
          imagery and which sections appear on that project&apos;s page — not on
          the others.
        </p>

        <div className="text-[12.5px] text-bz-muted">
          {rows.length} {rows.length === 1 ? "page" : "pages"} · {live} live
        </div>

        {rows.length === 0 ? (
          <div className="bg-bz-surface border border-bz-border rounded-lg p-12 text-center text-bz-muted text-[13.5px]">
            No development pages yet — start one with{" "}
            <span className="text-bz-ink">Add development page</span>.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-lg border border-bz-border bg-bz-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/pages/sub/development/${row.slug}`}
                    className="text-[13.5px] font-medium hover:text-bz-accent transition-colors"
                  >
                    {row.name}
                  </Link>
                  <div className="mono text-[11px] text-bz-muted truncate">
                    /developments/{row.slug}
                    {row.developer ? ` · ${row.developer}` : ""}
                  </div>
                </div>

                {row.edited ? (
                  <span className="text-[11px] text-bz-muted-2">Edited</span>
                ) : null}

                <span
                  className={cn(
                    "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                    row.published_at
                      ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                      : "bg-bz-surface-2 text-bz-ink-2",
                  )}
                >
                  {row.published_at ? "Live" : "Not published"}
                </span>

                {row.published_at ? (
                  <Link
                    href={`/developments/${row.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                  >
                    View <ExternalLink size={12} />
                  </Link>
                ) : (
                  <span className="text-[12px] text-bz-muted-2">—</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </CmsShell>
  );
}

import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { cn } from "@/lib/utils";
import { listAreaSubPages } from "@/lib/queries/subpages";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  emirate: "Emirate",
  area: "Area",
  sub_community: "Sub-community",
};

export default async function AreaSubPagesIndex() {
  const rows = await listAreaSubPages();
  const edited = rows.filter((r) => r.edited).length;

  return (
    <CmsShell
      title="Area pages"
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
          <span>Areas</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5 max-w-[900px]">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed">
          Community guides under <span className="mono">/areas</span>. Each is
          built from the same template, so editing here changes the copy,
          imagery and section order on that area&apos;s guide — not on the
          others.
        </p>

        <div className="text-[12.5px] text-bz-muted">
          {rows.length} {rows.length === 1 ? "page" : "pages"}
          {edited > 0 ? ` · ${edited} edited` : ""}
        </div>

        {rows.length === 0 ? (
          <div className="bg-bz-surface border border-bz-border rounded-lg p-12 text-center text-bz-muted text-[13.5px]">
            No areas yet — add them in the catalogue first.
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
                    href={`/admin/pages/sub/area/${row.slug}`}
                    className="text-[13.5px] font-medium hover:text-bz-accent transition-colors"
                  >
                    {row.name}
                  </Link>
                  <div className="mono text-[11px] text-bz-muted truncate">
                    /areas/{row.slug}
                  </div>
                </div>

                {row.edited ? (
                  <span className="text-[11px] text-bz-muted-2">Edited</span>
                ) : null}

                <span
                  className={cn(
                    "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                    "bg-bz-surface-2 text-bz-ink-2",
                  )}
                >
                  {KIND_LABELS[row.kind] ?? row.kind}
                </span>

                <Link
                  href={`/areas/${row.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                >
                  View <ExternalLink size={12} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CmsShell>
  );
}

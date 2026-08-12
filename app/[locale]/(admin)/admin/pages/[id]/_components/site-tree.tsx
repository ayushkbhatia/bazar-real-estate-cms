import Link from "next/link";
import { FileText, FolderOpen } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";

type PageNode = {
  id: string;
  slug: string;
  title: string;
  parent_slug: string | null;
  status: "draft" | "published" | "archived";
};

/**
 * Sprint 7g (backfilled): 300px site-tree sidebar on the pages editor.
 * Renders the page hierarchy by parent_slug. Sprint 8 adds the
 * pages.parent_slug column; today the parent passes a flat list and
 * we render it grouped by slug-prefix.
 */
export function PagesSiteTree({
  pages,
  activeId,
}: {
  pages: PageNode[];
  activeId: string;
}) {
  // Group by parent_slug (or "Root").
  const groups = new Map<string, PageNode[]>();
  for (const p of pages) {
    const k = p.parent_slug ?? "Root";
    const arr = groups.get(k) ?? [];
    arr.push(p);
    groups.set(k, arr);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }
  const groupKeys = Array.from(groups.keys()).sort();

  return (
    <aside className="w-[300px] flex-shrink-0 border-e border-bz-border pe-4">
      <Eyebrow>Site tree</Eyebrow>
      <p className="mt-1 text-[11.5px] text-bz-muted">
        Pages grouped by parent. Sprint 8 adds parent_slug.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {groupKeys.map((key) => (
          <div key={key}>
            <div className="px-2 mb-1.5 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-bz-muted">
              <FolderOpen size={11} strokeWidth={1.6} />
              {key === "Root" ? "Root" : `/${key}`}
            </div>
            <ul className="flex flex-col gap-0.5">
              {(groups.get(key) ?? []).map((p) => {
                const active = p.id === activeId;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/admin/pages/${p.id}`}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded text-[12.5px] transition-colors",
                        active
                          ? "bg-bz-navy text-bz-bg"
                          : "text-bz-ink-2 hover:bg-bz-surface-2",
                      )}
                    >
                      <FileText
                        size={11}
                        strokeWidth={1.6}
                        className="flex-shrink-0"
                      />
                      <span className="flex-1 truncate">{p.title}</span>
                      {p.status !== "published" ? (
                        <span
                          className={cn(
                            "text-[9.5px] uppercase tracking-wider",
                            active ? "text-bz-bg/70" : "text-bz-muted",
                          )}
                        >
                          {p.status}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

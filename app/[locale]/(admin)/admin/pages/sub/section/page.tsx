import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { LIBRARY_SECTIONS } from "@/lib/master-pages/library";
import { getLibrarySectionContent } from "@/lib/queries/content-sections";
import { list } from "@/lib/master-pages";

export const dynamic = "force-dynamic";

/**
 * Index of library sections — content that belongs to the site rather than to
 * one page. One entry today (Testimonials); the route exists as its own so the
 * Sub-pages card has somewhere to land and so a second entry is a registry
 * line rather than a new screen.
 */
export default async function LibrarySectionIndex() {
  const entries = await Promise.all(
    LIBRARY_SECTIONS.map(async (entry) => {
      const content = await getLibrarySectionContent(entry.key, "bilingual");
      // Two shapes share this card. A `list` section owns a repeating `items`
      // list and the useful number is how many of them a visitor sees; a
      // `fields` section owns a flat bag of copy and the useful number is how
      // many strings it holds. Reading `items` off both — which is what this
      // did — makes every copy section report "0 of 0 … shown".
      const items =
        entry.shape === "list"
          ? list<Record<string, unknown>>(content.section.values, "items")
          : [];
      return {
        entry,
        summary:
          entry.shape === "list"
            ? // Switched-off items still exist; the count is what an editor
              // manages, not what a visitor sees.
              `${items.filter((i) => i.enabled !== false).length} of ${items.length} ${
                items.length === 1 ? entry.itemLabel : `${entry.itemLabel}s`
              } shown`
            : `${entry.section.fields.length} ${entry.itemLabel}s`,
        edited: !content.usingDefaults,
      };
    }),
  );

  return (
    <CmsShell
      title="Sections"
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
          <span>Sections</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5 max-w-[900px]">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed">
          Content that belongs to the site rather than to one page. Edit it once
          here and every page that places it updates — including landing pages
          built in the Page Builder.
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map(({ entry, summary, edited }) => (
            <li key={entry.key}>
              <Link
                href={`/admin/pages/sub/section/${entry.key}`}
                className="flex h-full flex-col gap-1 rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-accent transition-colors"
              >
                <span className="text-[13.5px] font-medium">{entry.label}</span>
                <span className="mono text-[11px] text-bz-muted">
                  {entry.usedOn.map((u) => u.label).join(" · ")}
                </span>
                <span className="mt-1 text-[12px] text-bz-muted">
                  {entry.description}
                </span>
                <span className="mt-1 text-[11.5px] text-bz-muted-2">
                  {summary}
                  {edited ? "" : " · never edited"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </CmsShell>
  );
}

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { SEARCH_HEADERS } from "@/lib/master-pages/search-headers";
import { getSearchHeaderContent } from "@/lib/queries/search-headers";
import { str } from "@/lib/master-pages";

export const dynamic = "force-dynamic";

/**
 * Index of search-page headers — one card per facet of the marketplace search.
 *
 * Seven cards over six routes, because `/buy/search` carries the umbrella copy
 * *and* the off-plan slice reached from the completion filter. The card prints
 * the live headline rather than the entry's description, so an editor can see
 * which one they are about to change without opening all seven.
 */
export default async function SearchHeaderIndex() {
  const entries = await Promise.all(
    SEARCH_HEADERS.map(async (entry) => {
      // English, so the index reads consistently for an admin whose CMS is
      // pinned to English (ADR-0007 §6) whatever the public site is serving.
      const content = await getSearchHeaderContent(entry.key, "en");
      return {
        entry,
        headline: str(content.section.values, "title") ?? "—",
        edited: !content.usingDefaults,
      };
    }),
  );

  return (
    <CmsShell
      title="Search results"
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
          <span>Search results</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5 max-w-[900px]">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed">
          The eyebrow, headline and sub-title above the filter bar on each
          search page, plus the title and description it publishes to a search
          engine. The listings, the result count and the filters underneath
          come from the catalogue and are not edited here.
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map(({ entry, headline, edited }) => (
            <li key={entry.key}>
              <Link
                href={`/admin/pages/sub/search/${entry.key}`}
                className="flex h-full flex-col gap-1 rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-accent transition-colors"
              >
                <span className="text-[13.5px] font-medium">{entry.label}</span>
                <span className="mono text-[11px] text-bz-muted">
                  {entry.publicPath}
                </span>
                <span className="mt-1 text-[12px] text-bz-muted">
                  {entry.description}
                </span>
                <span className="mt-1 text-[11.5px] text-bz-muted-2">
                  “{headline}”{edited ? "" : " · never edited"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </CmsShell>
  );
}

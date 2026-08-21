import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import {
  getSearchHeader,
  isSearchHeaderKey,
} from "@/lib/master-pages/search-headers";
import { getSearchHeaderContent } from "@/lib/queries/search-headers";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { saveSearchHeader, resetSearchHeader } from "../_actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ key: string }> };

// Handed to the client editor by reference. Wrapping them in arrows here would
// make them plain functions, which cannot cross the server/client boundary —
// the same constraint the area, development and library editors document.
const ACTIONS: SectionActions = {
  save: saveSearchHeader,
  reset: resetSearchHeader,
};

export default async function SearchHeaderEditorPage({ params }: PageProps) {
  const { key } = await params;
  if (!isSearchHeaderKey(key)) notFound();
  const entry = getSearchHeader(key);
  if (!entry) notFound();

  // "bilingual" keeps the `_ar` twins in `values`. Without it the fold strips
  // them, the Arabic inputs render blank over stored content, and the next
  // save writes that blank back.
  const content = await getSearchHeaderContent(entry.key, "bilingual");

  return (
    <CmsShell
      title={entry.label}
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
          <Link href="/admin/pages/sub/search" className="hover:text-bz-ink">
            Search results
          </Link>
          <ChevronRight size={11} />
          <span>{entry.label}</span>
        </span>
      }
      secondary={
        <Link
          href={entry.publicPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View page
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        {/*
          What this edit does and does not reach, stated before the form. Every
          search facet has its own document precisely so /buy/ready and
          /buy/resale cannot share a headline, and an editor who assumes
          otherwise would rewrite one page and expect six.
        */}
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">
            This page only
          </h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            {entry.description} Each search facet keeps its own wording — on
            the page and in a search result — so editing this one changes{" "}
            <Link href={entry.publicPath} className="text-bz-ink underline">
              {entry.publicPath}
            </Link>{" "}
            and nothing else. Type the Arabic under each English field —
            anything left blank falls back to the English rather than leaving a
            hole.
          </p>
        </div>

        <MasterPageEditor
          pageKey={entry.key}
          pageLabel={entry.label}
          path={entry.publicPath}
          usingDefaults={content.usingDefaults}
          media={[]}
          seeds={{}}
          actions={ACTIONS}
          // One section, so there is nothing to reorder.
          allowReorder={false}
          resetLabel="Reset to the shipped wording"
          initial={[
            {
              key: content.section.key,
              def: content.section.def,
              enabled: content.section.enabled,
              values: content.section.values,
            },
          ]}
        />
      </div>
    </CmsShell>
  );
}

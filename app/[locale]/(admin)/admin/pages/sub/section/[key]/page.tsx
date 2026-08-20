import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import {
  getLibrarySection,
  isLibrarySectionKey,
} from "@/lib/master-pages/library";
import { getLibrarySectionContent } from "@/lib/queries/content-sections";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { saveLibrarySection, resetLibrarySection } from "../_actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ key: string }> };

// Handed to the client editor by reference. Wrapping them in arrows here would
// make them plain functions, which cannot cross the server/client boundary —
// the same constraint the area and development editors document.
const ACTIONS: SectionActions = {
  save: saveLibrarySection,
  reset: resetLibrarySection,
};

export default async function LibrarySectionEditorPage({ params }: PageProps) {
  const { key } = await params;
  if (!isLibrarySectionKey(key)) notFound();
  const entry = getLibrarySection(key);
  if (!entry) notFound();

  // "bilingual" keeps the `_ar` twins in `values`. Without it the fold strips
  // them, the Arabic inputs render blank over stored content, and the next
  // save writes that blank back.
  const content = await getLibrarySectionContent(entry.key, "bilingual");

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
          <Link href="/admin/pages/sub/section" className="hover:text-bz-ink">
            Sections
          </Link>
          <ChevronRight size={11} />
          <span>{entry.label}</span>
        </span>
      }
      secondary={
        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View on the home page
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        {/*
          The blast radius, stated before the form rather than discovered after
          it. Shared content is the one editing surface where "what else does
          this change" is invisible from the fields in front of you.
        */}
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">One edit, every surface</h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            {entry.description} It renders on{" "}
            {entry.usedOn.map((u, i) => (
              <span key={u.href}>
                {i > 0 ? (i === entry.usedOn.length - 1 ? " and " : ", ") : ""}
                <Link href={u.href} className="text-bz-ink underline">
                  {u.label}
                </Link>
              </span>
            ))}
            . Type the Arabic under each English field — anything left blank
            falls back to the English rather than leaving a hole.
          </p>
        </div>

        <MasterPageEditor
          pageKey={entry.key}
          pageLabel={entry.label}
          path="/"
          usingDefaults={content.usingDefaults}
          media={[]}
          seeds={{}}
          actions={ACTIONS}
          // One section, so there is nothing to reorder.
          allowReorder={false}
          resetLabel="Reset to the shipped reviews"
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

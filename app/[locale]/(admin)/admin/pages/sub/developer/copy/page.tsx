import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { NAME_TOKEN } from "@/lib/master-pages/developer-page";
import { getDeveloperPageContent } from "@/lib/queries/developer-page";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { saveDeveloperPageCopy, resetDeveloperPageCopy } from "./_actions";

export const dynamic = "force-dynamic";

// Handed to the client editor by reference. Wrapping them in arrows here would
// make them plain functions, which cannot cross the server/client boundary —
// the same constraint the area, development, library and search editors
// document.
const ACTIONS: SectionActions = {
  save: saveDeveloperPageCopy,
  reset: resetDeveloperPageCopy,
};

export default async function DeveloperPageCopyEditor() {
  // "bilingual" keeps the `_ar` twins in `values`. Without it the fold strips
  // them, the Arabic inputs render blank over stored content, and the next
  // save writes that blank back.
  const content = await getDeveloperPageContent("bilingual");

  return (
    <CmsShell
      title="Developer profile pages"
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
          <Link href="/admin/pages/sub/developer" className="hover:text-bz-ink">
            Developers
          </Link>
          <ChevronRight size={11} />
          <span>Page copy</span>
        </span>
      }
      secondary={
        <Link
          href="/developers"
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
          What this edit reaches, stated before the form. It is the opposite of
          the search-header editor's warning: this document is shared, so an
          editor who assumes it belongs to the developer whose page they were
          just looking at would change all 32 without meaning to.
        */}
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">Every developer profile</h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            One set of words, shared by every{" "}
            <span className="mono">/developers/&lt;slug&gt;</span> page — the
            back link, both headings, both buttons and the message shown when a
            developer has no projects yet. Editing it here changes all of them.
            A developer&apos;s own name, description and logo are not here: they
            live on its{" "}
            <Link
              href="/admin/pages/sub/developer"
              className="text-bz-ink underline"
            >
              record
            </Link>
            .
          </p>
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed">
            Write <span className="mono">{NAME_TOKEN}</span> where the
            developer&apos;s name belongs and it is filled in per page. Type the
            Arabic under each English field — anything left blank falls back to
            the English rather than leaving a hole.
          </p>
        </div>

        <MasterPageEditor
          pageKey="copy"
          pageLabel="Developer profile pages"
          path="/developers"
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

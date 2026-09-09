import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { DEVELOPMENT_TOKENS } from "@/lib/master-pages/development-page";
import { getDevelopmentPageCopyContent } from "@/lib/queries/development-page";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../../master/[key]/_editor";
import {
  saveDevelopmentPageCopy,
  resetDevelopmentPageCopy,
} from "./_actions";

export const dynamic = "force-dynamic";

// Handed to the client editor by reference. Wrapping them in arrows here would
// make them plain functions, which cannot cross the server/client boundary —
// the same constraint the area, development, developer, library and search
// editors document.
const ACTIONS: SectionActions = {
  save: saveDevelopmentPageCopy,
  reset: resetDevelopmentPageCopy,
};

export default async function DevelopmentPageCopyEditor() {
  // "bilingual" keeps the `_ar` twins in `values`. Without it the fold strips
  // them, the Arabic inputs render blank over stored content, and the next
  // save writes that blank back.
  const content = await getDevelopmentPageCopyContent("bilingual");

  return (
    <CmsShell
      title="Project pages"
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
          <Link
            href="/admin/pages/sub/development"
            className="hover:text-bz-ink"
          >
            Developments
          </Link>
          <ChevronRight size={11} />
          <span>Page copy</span>
        </span>
      }
      secondary={
        <Link
          href="/developments"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View pages
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        {/*
          What this edit reaches, stated before the form. The per-project editor
          is one click away and looks almost identical, so an editor who assumes
          this document belongs to the project they were just looking at would
          change every one of them without meaning to.
        */}
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">Every project page</h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            One set of words, shared by every{" "}
            <span className="mono">/developments/&lt;slug&gt;</span> page — the
            eyebrow, heading and standfirst above each band. They are already
            filled in, so a newly created project reads correctly with nothing
            typed. Editing them here changes every project at once.
          </p>
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed">
            A project that wants its own wording overrides it on{" "}
            <Link
              href="/admin/pages/sub/development"
              className="text-bz-ink underline"
            >
              its own page
            </Link>
            , and that override wins — including, today, on all 22 projects
            set up before this screen existed, which had every one of these
            lines typed into them by hand, in both languages. Clearing a field
            there hands that band back to this document. Everything else about
            a project — its name, tagline, facts, units, imagery — lives on its
            record, not here.
          </p>
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed">
            Write <span className="mono">{DEVELOPMENT_TOKENS.name}</span>,{" "}
            <span className="mono">{DEVELOPMENT_TOKENS.area}</span>,{" "}
            <span className="mono">{DEVELOPMENT_TOKENS.developer}</span>,{" "}
            <span className="mono">{DEVELOPMENT_TOKENS.plan}</span>,{" "}
            <span className="mono">{DEVELOPMENT_TOKENS.available}</span> or{" "}
            <span className="mono">{DEVELOPMENT_TOKENS.total}</span> where the
            project&apos;s own name, area, developer, payment-plan name or unit
            counts belong, and they are filled in per page. Type the Arabic
            under each English field — anything left blank falls back to the
            English rather than leaving a hole.
          </p>
        </div>

        <MasterPageEditor
          pageKey="copy"
          pageLabel="Project pages"
          path="/developments"
          usingDefaults={content.usingDefaults}
          media={[]}
          seeds={{}}
          actions={ACTIONS}
          // The order here mirrors the project page's own band order, which is
          // fixed by the template — see DEVELOPMENT_SECTIONS.
          allowReorder={false}
          resetLabel="Reset to the shipped wording"
          initial={content.sections.map((s) => ({
            key: s.key,
            def: s.def,
            enabled: s.enabled,
            values: s.values,
          }))}
        />
      </div>
    </CmsShell>
  );
}

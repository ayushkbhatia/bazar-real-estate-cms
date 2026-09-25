import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { PROPERTY_TOKENS } from "@/lib/master-pages/property-page";
import { getPropertyPageCopyContent } from "@/lib/queries/property-page";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../master/[key]/_editor";
import { savePropertyPageCopy, resetPropertyPageCopy } from "./_actions";

export const dynamic = "force-dynamic";

// Handed to the client editor by reference. Wrapping them in arrows here would
// make them plain functions, which cannot cross the server/client boundary —
// the same constraint the area, development, developer, library and search
// editors document.
const ACTIONS: SectionActions = {
  save: savePropertyPageCopy,
  reset: resetPropertyPageCopy,
};

export default async function PropertyPageCopyEditor() {
  // "bilingual" keeps the `_ar` twins in `values`. Without it the fold strips
  // them, the Arabic inputs render blank over stored content, and the next
  // save writes that blank back.
  const content = await getPropertyPageCopyContent("bilingual");

  return (
    <CmsShell
      title="Property pages"
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
          <span>Property pages</span>
        </span>
      }
      secondary={
        <Link
          href="/buy/search"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View listings
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        {/*
          What this edit reaches, stated before the form. Every listing shares
          this one document, so an editor who arrives from a listing and assumes
          it belongs to that listing would change all of them without meaning to.
        */}
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">Every listing page</h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            One set of words, shared by every{" "}
            <span className="mono">/p/&lt;slug&gt;</span> page — the eyebrow
            and heading above each band, the enquiry card and dialog, the
            lead-advisor card&apos;s label and button, the questions shown on
            every listing, and the nearby-listings rail. Editing them here
            changes every listing at once. A listing&apos;s own title,
            description, photos and facts live on its record in{" "}
            <Link href="/admin/properties" className="text-bz-ink underline">
              Properties
            </Link>
            .
          </p>
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed">
            Write <span className="mono">{PROPERTY_TOKENS.reference}</span>,{" "}
            <span className="mono">{PROPERTY_TOKENS.title}</span>,{" "}
            <span className="mono">{PROPERTY_TOKENS.area}</span>,{" "}
            <span className="mono">{PROPERTY_TOKENS.advisor}</span> or{" "}
            <span className="mono">{PROPERTY_TOKENS.type}</span> where the
            listing&apos;s own reference, title, area, advisor or property type
            belong, and they are filled in per page — in any field, English or
            Arabic. Type the Arabic under each English field: an Arabic box
            left blank shows the Arabic the site shipped with, not a
            translation of your new English, and a question you added shows
            its English.
          </p>
        </div>

        <MasterPageEditor
          pageKey="copy"
          pageLabel="Property pages"
          path="/p"
          usingDefaults={content.usingDefaults}
          media={[]}
          seeds={{}}
          actions={ACTIONS}
          // The order mirrors the listing page's own band order, which the
          // template fixes — the sidebar cannot move into the main column.
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

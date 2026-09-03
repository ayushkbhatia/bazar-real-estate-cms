import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { getHeaderCtaContent } from "@/lib/queries/header-cta";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../pages/master/[key]/_editor";
import { saveHeaderCta, resetHeaderCta } from "./_actions";

export const dynamic = "force-dynamic";

// Handed to the client editor by reference. Wrapping them in arrows here would
// make them plain functions, which cannot cross the server/client boundary —
// the same constraint the area, development, library, search and developer
// editors document.
const ACTIONS: SectionActions = {
  save: saveHeaderCta,
  reset: resetHeaderCta,
};

export default async function HeaderCtaEditor() {
  // "bilingual" keeps the `_ar` twins in `values`. Without it the fold strips
  // them, the Arabic inputs render blank over stored content, and the next
  // save writes that blank back.
  const content = await getHeaderCtaContent("bilingual");

  return (
    <CmsShell
      title="Header button"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/megamenu" className="hover:text-bz-ink">
            Megamenu
          </Link>
          <ChevronRight size={11} />
          <span>Header button</span>
        </span>
      }
      secondary={
        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View the live header
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        {/*
          Where the three fields actually land, stated before the form. The
          short label is the one an editor cannot picture: it renders only
          below xl, next to the hamburger, and nothing in the admin is that
          narrow.
        */}
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">Three places, one button</h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            The button label shows in the top bar on a desktop and across the
            bottom of the menu drawer on a phone. The short label replaces it in
            the phone header itself, beside the menu button, where the full
            wording will not fit. The link is shared by all three.
          </p>
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed">
            Type the Arabic under each English field — anything left blank falls
            back to the English rather than leaving a hole. The link carries no
            Arabic: one address serves both languages, and the{" "}
            <span className="mono">/ar</span> prefix is added on the way out.
          </p>
        </div>

        <MasterPageEditor
          pageKey="cta"
          pageLabel="Header button"
          path="/"
          usingDefaults={content.usingDefaults}
          media={[]}
          seeds={{}}
          actions={ACTIONS}
          // One section, so there is nothing to reorder.
          allowReorder={false}
          resetLabel="Reset to the shipped button"
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

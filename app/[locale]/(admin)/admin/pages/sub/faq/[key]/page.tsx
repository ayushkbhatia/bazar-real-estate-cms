import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { getPageFaq } from "@/lib/master-pages/page-faqs";
import { getPageFaqContent } from "@/lib/queries/page-faqs";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { savePageFaq, resetPageFaq } from "../_actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ key: string }> };

// Handed to the client editor by reference: wrapped in arrows they would be
// plain functions, which cannot cross the server/client boundary.
const ACTIONS: SectionActions = {
  save: savePageFaq,
  reset: resetPageFaq,
};

export default async function PageFaqEditorPage({ params }: PageProps) {
  const { key } = await params;
  const entry = getPageFaq(key);
  if (!entry) notFound();

  // "bilingual" keeps the `_ar` twins, so the Arabic inputs show what is stored.
  const content = await getPageFaqContent(entry.key, "bilingual");

  return (
    <CmsShell
      title={`${entry.label} · FAQ`}
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
          <Link href="/admin/pages/sub/faq" className="hover:text-bz-ink">
            Page FAQs
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
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">This page only</h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            These questions show at the foot of{" "}
            <Link href={entry.publicPath} className="text-bz-ink underline">
              {entry.publicPath}
            </Link>{" "}
            and nowhere else, and are published to search engines as that
            page&rsquo;s FAQ. Type the Arabic under each English field; a
            question with no Arabic shows in English on the Arabic page.
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
          allowReorder={false}
          resetLabel="Remove every question"
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

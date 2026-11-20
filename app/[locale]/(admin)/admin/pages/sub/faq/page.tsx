import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import {
  PAGE_FAQS,
  PAGE_FAQ_GROUP_LABELS,
  developerPageFaq,
  type PageFaqDef,
  type PageFaqGroup,
} from "@/lib/master-pages/page-faqs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getPageFaqContent } from "@/lib/queries/page-faqs";
import { faqPairs } from "@/lib/master-pages";

export const dynamic = "force-dynamic";

/**
 * Index of page FAQs: one card per guide, service page and tool, grouped,
 * each with its question count so an editor can see which pages have none.
 */
/** One entry per developer record, for the record-backed group. */
async function developerEntries(): Promise<PageFaqDef[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("developers")
    .select("slug, name")
    .order("name");
  return (data ?? []).map((d) => developerPageFaq(d.slug, d.name));
}

export default async function PageFaqIndex() {
  const all = [...PAGE_FAQS, ...(await developerEntries())];
  const entries = await Promise.all(
    all.map(async (entry) => {
      // English, so the index reads the same whatever the public site serves.
      const content = await getPageFaqContent(entry.key, "en");
      return { entry, count: faqPairs(content.section.values).length };
    }),
  );
  const groups = (Object.keys(PAGE_FAQ_GROUP_LABELS) as PageFaqGroup[]).map(
    (g) => ({ g, items: entries.filter((e) => e.entry.group === g) }),
  );

  return (
    <CmsShell
      title="Page FAQs"
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
          <span>Page FAQs</span>
        </span>
      }
    >
      <div className="flex flex-col gap-6 max-w-[900px]">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed">
          The questions at the foot of each guide, service page and tool, in
          English and Arabic. They are published to search engines as an FAQ,
          so lead each answer with one sentence that answers the question on
          its own. A page with no questions shows no FAQ.
        </p>
        {groups.map(({ g, items }) => (
          <section key={g} className="flex flex-col gap-3">
            <h2 className="text-[13.5px] font-medium">
              {PAGE_FAQ_GROUP_LABELS[g]}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(({ entry, count }) => (
                <li key={entry.key}>
                  <Link
                    href={`/admin/pages/sub/faq/${entry.key}`}
                    className="flex h-full flex-col gap-1 rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-accent transition-colors"
                  >
                    <span className="text-[13.5px] font-medium">
                      {entry.label}
                    </span>
                    <span className="mono text-[11px] text-bz-muted">
                      {entry.publicPath}
                    </span>
                    <span className="mt-1 text-[11.5px] text-bz-muted-2">
                      {count === 0
                        ? "No questions yet"
                        : `${count} question${count === 1 ? "" : "s"}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </CmsShell>
  );
}

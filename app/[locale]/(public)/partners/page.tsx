import { setRequestLocale } from "next-intl/server";
import * as React from "react";
import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { getPartners } from "@/lib/queries/content-sections";
import { str } from "@/lib/master-pages";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { asLocale } from "@/lib/i18n/locales";
import type {
  PartnerCategory,
  ResolvedPartner,
} from "@/lib/partners/directory-data";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → this page → Search
  // appearance. Unedited, they fall back to the strings that used to be the
  // literal `export const metadata` here, now in MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("partners", asLocale((await params).locale), {
    alternates: { canonical: "/partners" },
  });
}

export const revalidate = 300;

/**
 * The headline italicises a word in the middle rather than at the end, so it
 * takes three fields — see the comment on the hero section in
 * `lib/master-pages/sections/partners.ts`. An empty tail ends the line on the
 * italic, which is the shape every other master page's headline has.
 */
function heroTitle(
  lead: string | null,
  emphasis: string | null,
  tail: string | null,
): React.ReactNode {
  return (
    <>
      {lead}
      {emphasis ? (
        <>
          {" "}
          <em className="italic">{emphasis}</em>
        </>
      ) : null}
      {tail ? ` ${tail}` : null}
    </>
  );
}

/**
 * Which category each group section shows.
 *
 * The words above the cards are the section's and come from the CMS; the
 * category is the filter key and stays in code beside the data it filters. An
 * editor can hide either group or swap their order — that is the section
 * document's business — but not point one at a set that does not exist.
 */
const GROUP_CATEGORY: Record<string, PartnerCategory> = {
  banking: "banking",
  regulatory: "regulatory",
};

function PartnerCard({ partner }: { partner: ResolvedPartner }) {
  return (
    <article className="rounded-xl border border-bz-border bg-bz-surface overflow-hidden flex flex-col">
      <div className="h-[150px] flex items-center justify-center bg-white px-8 border-b border-bz-border">
        {partner.logo ? (
          <Image
            src={partner.logo.src}
            alt={partner.name}
            width={partner.logo.w}
            height={partner.logo.h}
            className="max-h-[64px] w-auto object-contain"
            style={{ width: "auto" }}
            sizes="360px"
          />
        ) : (
          /* A partner added in the CMS with no logo picked and no shipped art
             to match. The tile keeps its shape and sets the name in type
             rather than leaving a white hole in the grid. */
          <span className="serif text-center text-[22px] leading-tight text-bz-ink">
            {partner.name}
          </span>
        )}
      </div>
      <div className="p-6">
        <div className="serif text-[19px] leading-tight">{partner.name}</div>
        {partner.tag ? (
          <p className="text-[13.5px] text-bz-muted mt-2">{partner.tag}</p>
        ) : null}
      </div>
    </article>
  );
}

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await. `getMasterPageContent` resolves its locale from
  // the request, and without this `getLocale()` has nothing to resolve — the
  // page renders English content under `lang="ar"` in an RTL layout, which is
  // the failure `lib/i18n/current.ts` describes: it looks finished.
  setRequestLocale(asLocale((await params).locale));

  // Two documents, one round: the page's own copy comes from
  // /admin/pages/master/partners, and the institutions themselves from
  // /admin/pages/sub/section/partners — the same list the home page and
  // /about draw their logo strip from.
  const [content, partners] = await Promise.all([
    getMasterPageContent("partners"),
    getPartners(),
  ]);
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const ctaV = v("cta");

  // Which group bands actually render, in document order — so the stripe
  // alternates over what an editor left switched on rather than over the two
  // this page used to hardcode.
  const groupKeys = content.order.filter(
    (key) =>
      key in GROUP_CATEGORY &&
      partners.some((p) => p.category === GROUP_CATEGORY[key]),
  );

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section
        key="hero"
        className="px-4 md:px-12 pt-12 md:pt-16 pb-10 md:pb-12"
      >
        {str(heroV, "eyebrow") ? (
          <Eyebrow>{str(heroV, "eyebrow")}</Eyebrow>
        ) : null}
        <h1
          className="serif mt-3.5 max-w-[16ch]"
          style={{
            fontSize: fluid(72),
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
          }}
        >
          {heroTitle(
            str(heroV, "title") ?? "The institutions",
            str(heroV, "title_emphasis"),
            str(heroV, "title_tail"),
          )}
        </h1>
        {str(heroV, "sub") ? (
          <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[720px] leading-relaxed mt-5">
            {str(heroV, "sub")}
          </p>
        ) : null}
      </section>
    ),

    cta: (
      <section
        key="cta"
        className="px-4 md:px-12 py-16 md:py-20 border-t border-bz-border"
      >
        <div className="rounded-2xl bg-bz-ink text-white px-8 md:px-14 py-14 md:py-16 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            {str(ctaV, "eyebrow") ? (
              <Eyebrow className="text-white/60">
                {str(ctaV, "eyebrow")}
              </Eyebrow>
            ) : null}
            <h2
              className="serif text-white mt-4 max-w-[18ch]"
              style={{
                fontSize: fluid(44),
                letterSpacing: "-0.025em",
                lineHeight: 1.08,
              }}
            >
              {str(ctaV, "heading")}
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-white text-bz-ink hover:bg-white/90">
              <Link href="/contact">
                {str(ctaV, "cta_label") ?? "Talk to an advisor"}
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/developers">
                {str(ctaV, "cta2_label") ?? "Our developers"}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    ),
  };

  // A group band is only worth drawing when it has cards under it: a heading
  // over an empty grid is what an editor sees after moving every institution
  // into the other group, and it reads as a bug rather than as a choice.
  for (const [i, key] of groupKeys.entries()) {
    const groupV = v(key);
    const cards = partners.filter((p) => p.category === GROUP_CATEGORY[key]);
    nodes[key] = (
      <section
        key={key}
        className={`px-4 md:px-12 py-14 md:py-18 border-t border-bz-border${
          i % 2 === 1 ? " bg-bz-surface-2" : ""
        }`}
      >
        <SectionHead
          eyebrow={str(groupV, "eyebrow") ?? undefined}
          title={str(groupV, "heading")}
          sub={str(groupV, "body")}
          size={40}
          className="mb-9"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((p) => (
            <PartnerCard key={p.slug} partner={p} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="bg-bz-bg">
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}

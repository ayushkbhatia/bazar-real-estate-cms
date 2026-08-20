import { setRequestLocale } from "next-intl/server";
import * as React from "react";
import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { StepFlow } from "../_components/marketing/step-flow";
import { WhyBand } from "../_components/marketing/why-band";
import { Faq } from "../_components/marketing/faq";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { faqPairs, list, statPairs, str } from "@/lib/master-pages";
import { chipLines } from "@/lib/master-pages/text";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { asLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → this page →
  // Search appearance. Unedited, they fall back to the strings that used
  // to be the literal here, now in MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("services", asLocale((await params).locale),
  {
    alternates: { canonical: "/services" },
  });
}

export const revalidate = 300;

/**
 * Practice bands are one section each — see lib/master-pages/sections/services.
 * The page finds them by key prefix rather than by a hardcoded list, so a
 * practice added to the registry renders (and gets its hero chip) with no
 * change here.
 */
const PRACTICE_PREFIX = "practice_";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await. `getMasterPageContent` resolves its locale from
  // the request, and without this `getLocale()` has nothing to resolve — the
  // page renders English content under `lang="ar"` in an RTL layout, which is
  // the failure `lib/i18n/current.ts` describes: it looks finished.
  setRequestLocale(asLocale((await params).locale));

  const content = await getMasterPageContent("services");
  const v = (key: string) => content.section(key)?.values ?? {};

  const heroV = v("hero");
  const whyV = v("why");
  const faqV = v("faqs");

  // Enabled practices, in the order the editor arranged them. The hero chips
  // and the alternating band backgrounds are both derived from this list.
  const practices = content.order
    .filter((key) => key.startsWith(PRACTICE_PREFIX))
    .map((key, index) => {
      const pv = v(key);
      return {
        key,
        index,
        n: str(pv, "number") ?? "",
        title: str(pv, "title") ?? "",
        sub: str(pv, "sub") ?? "",
        helpLabel: str(pv, "help_label") ?? "",
        help: chipLines(pv.help),
        stepsLabel: str(pv, "steps_label") ?? "",
        steps: list<{ title?: string; desc?: string }>(pv, "steps")
          .map((s) => [s.title ?? "", s.desc ?? ""] as [string, string])
          .filter(([title]) => title !== ""),
        cta: str(pv, "cta_label") ?? "",
        ctaHref: str(pv, "cta_href") ?? "#",
      };
    });

  const heroTitle = str(heroV, "title") ?? "Five practices,\none bench of";
  const heroEmphasis = str(heroV, "title_emphasis");
  const heroLines = heroTitle.split("\n");
  const whyStats = statPairs(whyV);

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section key="hero" className="px-4 md:px-12 pt-12 md:pt-20 pb-12">
        {str(heroV, "eyebrow") ? (
          <Eyebrow>{str(heroV, "eyebrow")}</Eyebrow>
        ) : null}
        <h1
          className="serif mt-3.5 max-w-[1040px]"
          style={{
            fontSize: fluid(88),
            letterSpacing: "-0.03em",
            lineHeight: 0.97,
          }}
        >
          {heroLines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < heroLines.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
          {heroEmphasis ? (
            <>
              {" "}
              <em className="italic">{heroEmphasis}</em>
            </>
          ) : null}
        </h1>
        {str(heroV, "sub") ? (
          <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[680px] leading-relaxed mt-5">
            {str(heroV, "sub")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 mt-8">
          {practices.map((p) => (
            <span
              key={p.key}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-bz-border bg-bz-surface text-[13.5px]"
            >
              <span className="mono text-bz-accent text-[11px]">{p.n}</span>
              {p.title}
            </span>
          ))}
        </div>
      </section>
    ),

    why: (
      <WhyBand
        key="why"
        eyebrow={str(whyV, "eyebrow") ?? undefined}
        title={
          str(whyV, "title") ?? "Every practice, one senior partner on your file."
        }
        body={
          str(whyV, "body") ??
          "Over 20 years of UAE real estate experience, direct developer and banking relationships, and client-focused guidance — combined so you make confident decisions whether you're buying, selling, renting, managing, or financing."
        }
        stats={whyStats.length > 0 ? whyStats : undefined}
      />
    ),

    faqs: (
      <section key="faqs" className="px-4 md:px-12 py-14 md:py-20">
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow={str(faqV, "eyebrow") ?? undefined}
            title={str(faqV, "heading") ?? ""}
            size={44}
            className="mb-8"
          />
          <Faq items={faqPairs(faqV)} />
        </div>
      </section>
    ),
  };

  for (const p of practices) {
    nodes[p.key] = (
      <section
        key={p.key}
        className={
          "px-4 md:px-12 py-12 md:py-14 border-t border-bz-border " +
          (p.index % 2 ? "bg-bz-surface-2" : "")
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.4fr] gap-10 lg:gap-16 items-start max-w-[1280px]">
          <div>
            <div
              className="serif text-bz-muted-2"
              style={{ fontSize: fluid(60), letterSpacing: "-0.02em", lineHeight: 1 }}
            >
              {p.n}
            </div>
            <h2
              className="serif mt-4"
              style={{ fontSize: fluid(42), letterSpacing: "-0.025em", lineHeight: 1.05 }}
            >
              {p.title}
            </h2>
            <p className="text-[15px] md:text-[16px] text-bz-ink-2 leading-relaxed mt-4 max-w-[420px]">
              {p.sub}
            </p>
            <div className="eyebrow mt-7">{p.helpLabel}</div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {p.help.map((h) => (
                <span
                  key={h}
                  className="px-3 py-1 rounded-full bg-bz-surface border border-bz-border text-[12.5px]"
                >
                  {h}
                </span>
              ))}
            </div>
            {p.cta ? (
              <Button
                asChild
                className="mt-7 bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
              >
                <Link href={p.ctaHref}>
                  {p.cta}
                  <ArrowRight size={15} strokeWidth={1.7} />
                </Link>
              </Button>
            ) : null}
          </div>
          <div>
            <div className="eyebrow mb-2">{p.stepsLabel}</div>
            <StepFlow steps={p.steps} />
          </div>
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

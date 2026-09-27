import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { list, str } from "@/lib/master-pages";
import { LAUNCHES_PATH } from "@/lib/master-pages/sections/launches";
import {
  communityCount,
  orderLaunches,
  type LaunchPick,
} from "@/lib/developments/launch-order";
import { asLocale } from "@/lib/i18n/locales";
import { DevelopmentCard } from "../../_components/marketing/development-card";

/**
 * /off-plan/launches — every published project, and nothing else.
 *
 * Where the "View every launch" link above the New Projects rail leads. The
 * list is live: a project published in the CMS appears here on its own,
 * newest first, behind any the editor has pinned to lead
 * (/admin/pages/master/launches). The words around it are that document's.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → All launches →
  // Search appearance. Unedited, they fall back to MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("launches", asLocale((await params).locale), {
    alternates: { canonical: LAUNCHES_PATH },
  });
}

// The sibling master pages' interval. Saves revalidate on demand; this is what
// picks up a project published or edited elsewhere in the CMS.
export const revalidate = 300;

/*
 * The grid is two columns until `lg` and three from it, with `px-4 md:px-12`
 * gutters and a 12px gap that opens to 24px at `sm`. These are those tracks.
 * A plain `50vw` would hand a phone renders sized for a gutterless screen, and
 * the card's own default (`100vw` below 1024px) would be twice too large on
 * every phone and tablet that opens this page.
 */
const CARD_SIZES = [
  "(min-width: 1024px) calc((100vw - 144px) / 3)",
  "(min-width: 768px) calc((100vw - 120px) / 2)",
  "(min-width: 640px) calc((100vw - 56px) / 2)",
  "calc((100vw - 44px) / 2)",
].join(", ");

/** The first desktop row — and a phone's first row and a half — load at once. */
const EAGER_CARDS = 3;

export default async function LaunchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await, for the reason off-plan/page.tsx gives: the
  // content reads resolve their locale from the request.
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);

  const [content, developments, t] = await Promise.all([
    getMasterPageContent("launches", locale),
    listPublishedDevelopments(),
    getTranslations({ locale, namespace: "pages.launches" }),
  ]);
  const values = (key: string) => content.section(key)?.values ?? {};
  const hero = values("hero");
  const grid = values("grid");
  const closing = values("closing");

  const launches = orderLaunches(
    developments,
    list<LaunchPick>(grid, "pinned"),
  );
  const communities = communityCount(launches);
  const backLabel = str(hero, "back_label");
  const ctaLabel = str(closing, "cta_label");
  const ctaHref = str(closing, "cta_href");

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <header
        key="hero"
        className="px-4 md:px-12 pt-4 md:pt-8 pb-8 md:pb-12 border-b border-bz-border"
      >
        {/* Dropped entirely when an editor clears the label — a bare arrow
            with no words is worse than no link. `min-h-11` is the 44px touch
            floor the mobile geometry gate holds every link to. */}
        {backLabel ? (
          <Link
            href="/off-plan"
            className="inline-flex min-h-11 items-center gap-1.5 text-[12.5px] text-bz-teal hover:text-bz-navy transition-colors"
          >
            <ArrowLeft size={13} strokeWidth={1.8} />
            {backLabel}
          </Link>
        ) : null}
        <div className="mt-3 md:mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-12">
          <div className="max-w-[52rem]">
            {str(hero, "eyebrow") ? (
              <Eyebrow>{str(hero, "eyebrow")}</Eyebrow>
            ) : null}
            <h1
              className="serif mt-3 text-[40px] md:text-[64px] font-normal leading-[1.02]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {str(hero, "title")}
            </h1>
            {str(hero, "sub") ? (
              <p className="mt-5 max-w-[60ch] text-[15px] md:text-[17px] text-bz-ink-2 leading-relaxed">
                {str(hero, "sub")}
              </p>
            ) : null}
          </div>
          {/* Counts are catalogue strings, not CMS copy: Arabic agrees the
              noun with the number across six plural forms, and a text input
              cannot express that. See docs/I18N.md. */}
          {launches.length > 0 ? (
            <p className="shrink-0 text-[13px] text-bz-muted md:pb-2">
              <span className="text-bz-ink">
                {t("projects", { count: launches.length })}
              </span>
              {communities > 0 ? (
                <>
                  <span aria-hidden className="mx-2">
                    ·
                  </span>
                  {t("communities", { count: communities })}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </header>
    ),

    grid: (
      <section key="grid" className="px-4 md:px-12 pt-8 md:pt-12">
        {launches.length === 0 ? (
          <p className="mx-auto max-w-[560px] rounded-lg border border-bz-border bg-bz-surface p-9 text-center text-[15px] text-bz-ink-2 leading-relaxed">
            {str(grid, "empty")}
          </p>
        ) : (
          <>
            {/* The cards are h3s; this is the h2 between them and the h1, so
                the outline doesn't jump a level. */}
            <h2 className="sr-only">
              {t("projects", { count: launches.length })}
            </h2>
            {/*
              Two to a row on a phone, three from `lg`, and one list either
              way — every project is server-rendered once and stays in the
              markup, crawlable. `role="list"` because Safari drops the list
              semantics of a `list-style: none` <ul>. `min-w-0` keeps a long
              unbroken name from blowing a track out past its share.
            */}
            <ul
              role="list"
              data-testid="launches-grid"
              className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-6 lg:grid-cols-3"
            >
              {launches.map((d, i) => (
                <li key={d.id} className="min-w-0">
                  <DevelopmentCard
                    d={d}
                    phoneColumns={2}
                    sizes={CARD_SIZES}
                    eager={i < EAGER_CARDS}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    ),

    closing: str(closing, "heading") ? (
      <section key="closing" className="px-4 md:px-12 pt-10 md:pt-16">
        <div className="flex flex-col gap-6 rounded-xl border border-bz-border bg-bz-surface-2 p-6 md:flex-row md:items-center md:justify-between md:gap-10 md:p-10">
          <div className="max-w-[60ch]">
            <h2
              className="serif text-[28px] md:text-[36px] font-normal leading-[1.1]"
              style={{ letterSpacing: "-0.02em" }}
            >
              {str(closing, "heading")}
            </h2>
            {str(closing, "body") ? (
              <p className="mt-3 text-[15px] text-bz-ink-2 leading-relaxed">
                {str(closing, "body")}
              </p>
            ) : null}
          </div>
          {ctaLabel && ctaHref ? (
            <Button
              asChild
              size="lg"
              className="shrink-0 self-start md:self-auto bg-bz-accent text-bz-accent-fg hover:bg-bz-accent-hover"
            >
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>
    ) : null,
  };

  // Each section carries only its top padding and the page owns the bottom,
  // so the spacing holds in whatever order the sections are arranged.
  return (
    <div className="bg-bz-bg pb-14 md:pb-24">
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}

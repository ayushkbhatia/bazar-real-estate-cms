import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import {
  articleUrl,
  countArticlesByCategory,
  listPublishedArticles,
  type ArticleListRow,
} from "@/lib/queries/articles";
import { listArticleCategories } from "@/lib/queries/article-categories";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str } from "@/lib/master-pages";
import { mediaPublicUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { NewsletterSignup } from "../_components/newsletter-signup";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The Bazar Brief — market reports, field notes, and advisor commentary",
  description:
    "Long-form market analysis, advisor field notes, and the occasional contrarian take on Abu Dhabi real estate. One email every Wednesday.",
};

const PAGE_SIZE = 24;

/**
 * Column count follows the viewport rather than a fixed breakpoint ladder:
 * one card per 280px track, so a wide monitor gets more cards instead of wider
 * ones and there is no width at which the grid stops filling the page. The
 * 280px floor is chosen to reproduce the old 1/2/3-column ladder at its
 * breakpoints (2-up from 640, 3-up from 1024) and keep going past it.
 * `min(280px, 100%)` stops a track outgrowing its container on a narrow phone,
 * which would otherwise push the grid wider than the viewport.
 */
const ARTICLE_GRID_COLUMNS =
  "grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))]";

type PageProps = {
  searchParams: Promise<{ category?: string }>;
};

function ArticleHero({
  row,
  sizes,
}: {
  row: ArticleListRow;
  sizes: string;
}) {
  if (row.hero) {
    return (
      <Image
        src={mediaPublicUrl(row.hero.storage_key)}
        alt={row.hero.alt_text ?? row.title}
        fill
        sizes={sizes}
        className="object-cover"
      />
    );
  }
  return (
    <PlaceholderImage
      label={row.title.toLowerCase().slice(0, 26)}
      className="w-full h-full"
    />
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The empty-state sentence carries the filtered category inline, so it is
 * stored as a template with a `{category}` token. With no filter the token and
 * the space before it both drop out.
 */
function fillCategory(template: string, label: string): string {
  return template.replace(/\s*\{category\}/g, label ? ` ${label}` : "");
}

export default async function InsightsIndexPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [categories, content] = await Promise.all([
    listArticleCategories(),
    getMasterPageContent("insights"),
  ]);
  const category = categories.some((c) => c.slug === params.category)
    ? (params.category as string)
    : null;
  const selectedLabel = category
    ? categories.find((c) => c.slug === category)?.label ?? ""
    : "";

  const [{ rows }, counts] = await Promise.all([
    listPublishedArticles({
      limit: PAGE_SIZE,
      category: category ?? undefined,
    }),
    countArticlesByCategory(),
  ]);

  // Section copy and order come from /admin/pages/master/insights. The
  // articles themselves, the categories and the counts stay live — only the
  // wording around them is editable.
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const featuredV = v("featured");
  const chipsV = v("categories");
  const gridV = v("articles");

  // With the lead-article section switched off, the newest article stays in
  // the grid rather than disappearing with the section that framed it.
  const featuredEnabled = content.order.includes("featured");
  const [newest, ...others] = rows;
  const featured = featuredEnabled ? newest : null;
  const rest = featuredEnabled ? others : rows;

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section key="hero" className="px-4 md:px-12 pt-12 md:pt-20 pb-14">
        <Eyebrow>{str(heroV, "eyebrow") ?? "Insights"}</Eyebrow>
        <h1
          className="serif text-[42px] md:text-[80px] mt-3 font-normal"
          style={{ letterSpacing: "-0.03em", lineHeight: 0.98 }}
        >
          {str(heroV, "heading") ?? "The Bazar Brief."}
        </h1>
        <p className="mt-6 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          {str(heroV, "body") ??
            "Long-form market analysis, advisor field notes, and the occasional contrarian take. One email every Wednesday."}
        </p>
      </section>
    ),

    featured: featured ? (
      <section key="featured" className="px-4 md:px-12 pb-14">
        {/* Past xl the subscribe rail stops growing so the lead article — not
            the newsletter box — absorbs the extra width on a wide monitor. At
            lg there is no spare width to absorb, and capping the rail there
            would flatten the 1.4:1 split into two near-equal columns. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,440px)] gap-10 items-start">
          <Link
            href={articleUrl(featured)}
            className="group block"
            aria-label={featured.title}
          >
            {/* The lead column keeps all the width the aside doesn't take, so
                the image flattens as it widens — at 16:10 a full-width lead on
                a large monitor would push the headline off the first screen.
                Past 2xl the ratio stops being the right control (a 2560px
                column is 850px tall even at 21:9), so height is capped against
                the viewport instead and the crop just gets wider. Note the
                ratio has to be dropped to do that: `aspect-ratio` plus a height
                clamp shrinks the *width* to match and leaves a gap beside it. */}
            <div className="relative aspect-[16/10] lg:aspect-[2/1] xl:aspect-[21/9] 2xl:aspect-auto 2xl:h-[min(52vh,640px)] rounded-lg overflow-hidden bg-bz-surface-2">
              <ArticleHero
                row={featured}
                sizes="(min-width: 1280px) calc(100vw - 576px), (min-width: 1024px) 58vw, 100vw"
              />
            </div>
            <div className="mt-5">
              <Eyebrow>{featured.category_label}</Eyebrow>
              <h2
                className="serif text-[28px] md:text-[40px] mt-3 leading-[1.05] group-hover:text-bz-accent transition-colors"
                style={{ letterSpacing: "-0.025em" }}
              >
                {featured.title}
              </h2>
              {featured.excerpt ? (
                <p className="mt-4 text-[15.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
                  {featured.excerpt}
                </p>
              ) : null}
              <div className="mt-5 text-[12.5px] text-bz-muted flex items-center gap-2">
                {featured.author ? (
                  <>
                    <span>{featured.author.display_name}</span>
                    <span>·</span>
                  </>
                ) : null}
                <span>{formatDate(featured.published_at)}</span>
                {featured.read_minutes ? (
                  <>
                    <span>·</span>
                    <span>{featured.read_minutes} min read</span>
                  </>
                ) : null}
              </div>
            </div>
          </Link>

          <aside className="bg-bz-ink text-white rounded-lg p-8 sticky top-6">
            <div
              className="text-[11px] uppercase tracking-widest"
              style={{ color: "oklch(0.65 0.005 80)" }}
            >
              {str(featuredV, "eyebrow") ?? "Subscribe to the brief"}
            </div>
            <h3
              className="serif text-[26px] mt-4 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              {str(featuredV, "heading") ?? "One email every Wednesday."}
            </h3>
            <p
              className="mt-3 text-[13.5px] leading-relaxed"
              style={{ color: "oklch(0.72 0.005 80)" }}
            >
              {str(featuredV, "body") ??
                "A short briefing on the week's Abu Dhabi deals, advisor commentary, and one chart worth sitting with."}
            </p>
            <div className="mt-5">
              <NewsletterSignup source="insights_header" variant="dark" />
            </div>
          </aside>
        </div>
      </section>
    ) : null,

    categories: (
      <section
        key="categories"
        className="px-4 md:px-12 py-6 border-t border-bz-border"
      >
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/insights"
            className={cn(
              "h-8 px-3 inline-flex items-center rounded text-[12.5px] border transition-colors",
              !category
                ? "bg-bz-navy text-bz-bg border-bz-navy"
                : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
            )}
          >
            {str(chipsV, "all_label") ?? "All"} · {counts.total}
          </Link>
          {categories.map((c) => {
            const count = counts.byCategory[c.slug] ?? 0;
            if (count === 0 && c.slug !== category) return null;
            const active = category === c.slug;
            return (
              <Link
                key={c.slug}
                href={`/insights?category=${c.slug}`}
                className={cn(
                  "h-8 px-3 inline-flex items-center rounded text-[12.5px] border transition-colors",
                  active
                    ? "bg-bz-navy text-bz-bg border-bz-navy"
                    : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                )}
              >
                {c.label} · {count}
              </Link>
            );
          })}
        </div>
      </section>
    ),

    articles: (
      <section key="articles" className="px-4 md:px-12 pt-12 pb-24">
        {rest.length === 0 && !featured ? (
          <div className="py-24 text-center max-w-[40ch] mx-auto">
            <p className="text-[15px] text-bz-ink-2">
              {fillCategory(
                str(gridV, "empty_body") ??
                  "We haven't published any {category} insights yet.",
                selectedLabel ? selectedLabel.toLowerCase() : "",
              )}
            </p>
            {str(gridV, "empty_cta_label") ? (
              <Button asChild variant="outline" className="mt-6">
                <Link href={str(gridV, "empty_cta_href") ?? "/insights"}>
                  {str(gridV, "empty_cta_label")}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={cn("grid gap-9 gap-y-14", ARTICLE_GRID_COLUMNS)}>
            {rest.map((row) => (
              <article key={row.id} className="group">
                <Link href={articleUrl(row)} className="block">
                  <div className="relative aspect-[4/3] rounded overflow-hidden bg-bz-surface-2">
                    <ArticleHero
                      row={row}
                      sizes="(min-width: 640px) 400px, 100vw"
                    />
                  </div>
                  <div className="eyebrow mt-3.5">
                    {row.category_label}
                    {row.read_minutes ? ` · ${row.read_minutes} min` : ""}
                  </div>
                  <h3
                    className="serif text-[22px] mt-2 leading-[1.2] group-hover:text-bz-accent transition-colors"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {row.title}
                  </h3>
                  {row.excerpt ? (
                    <p className="mt-2 text-[13px] text-bz-ink-2 leading-snug line-clamp-3">
                      {row.excerpt}
                    </p>
                  ) : null}
                  <div className="mt-3 text-[11.5px] text-bz-muted">
                    {row.author?.display_name ?? "Bazar"}
                    {row.published_at ? ` · ${formatDate(row.published_at)}` : ""}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    ),
  };

  return (
    <div className="bg-bz-bg">
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}

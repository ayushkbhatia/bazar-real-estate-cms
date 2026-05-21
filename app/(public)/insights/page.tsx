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
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
} from "@/lib/schemas/article";
import { mediaPublicUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The Bazar Brief — market reports, field notes, and advisor commentary",
  description:
    "Long-form market analysis, advisor field notes, and the occasional contrarian take on Abu Dhabi real estate. One email every Wednesday.",
};

const PAGE_SIZE = 24;

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

export default async function InsightsIndexPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = (
    ARTICLE_CATEGORIES as readonly string[]
  ).includes(params.category ?? "")
    ? (params.category as (typeof ARTICLE_CATEGORIES)[number])
    : null;

  const [{ rows }, counts] = await Promise.all([
    listPublishedArticles({
      limit: PAGE_SIZE,
      category: category ?? undefined,
    }),
    countArticlesByCategory(),
  ]);

  const [featured, ...rest] = rows;

  return (
    <div className="bg-bz-bg">
      {/* Header */}
      <section className="px-12 pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>Insights</Eyebrow>
        <h1
          className="serif text-[80px] mt-3 font-normal"
          style={{ letterSpacing: "-0.03em", lineHeight: 0.98 }}
        >
          The Bazar Brief.
        </h1>
        <p className="mt-6 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          Long-form market analysis, advisor field notes, and the occasional
          contrarian take. One email every Wednesday.
        </p>
      </section>

      {/* Featured + editor's pick block */}
      {featured ? (
        <section className="px-12 pb-14 max-w-[1280px]">
          <div className="grid grid-cols-[1.4fr_1fr] gap-10 items-start">
            <Link
              href={articleUrl(featured)}
              className="group block"
              aria-label={featured.title}
            >
              <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-bz-surface-2">
                <ArticleHero
                  row={featured}
                  sizes="(min-width: 1024px) 720px, 100vw"
                />
              </div>
              <div className="mt-5">
                <Eyebrow>
                  {ARTICLE_CATEGORY_LABELS[featured.category]}
                </Eyebrow>
                <h2
                  className="serif text-[40px] mt-3 leading-[1.05] group-hover:text-bz-accent transition-colors"
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
                Subscribe to the brief
              </div>
              <h3
                className="serif text-[26px] mt-4 leading-tight"
                style={{ letterSpacing: "-0.015em" }}
              >
                One email every Wednesday.
              </h3>
              <p
                className="mt-3 text-[13.5px] leading-relaxed"
                style={{ color: "oklch(0.72 0.005 80)" }}
              >
                A short briefing on the week&apos;s Abu Dhabi deals, advisor
                commentary, and one chart worth sitting with.
              </p>
              <p
                className="mt-5 text-[11.5px]"
                style={{ color: "oklch(0.65 0.005 80)" }}
              >
                Newsletter signup arrives shortly — for now, reach us at
                <br />
                <a href="mailto:hello@bazar.ae" className="underline">
                  hello@bazar.ae
                </a>
                .
              </p>
            </aside>
          </div>
        </section>
      ) : null}

      {/* Category chips */}
      <section className="px-12 py-6 border-t border-bz-border">
        <div className="flex gap-2 flex-wrap max-w-[1280px]">
          <Link
            href="/insights"
            className={cn(
              "h-8 px-3 inline-flex items-center rounded text-[12.5px] border transition-colors",
              !category
                ? "bg-bz-ink text-bz-bg border-bz-ink"
                : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
            )}
          >
            All · {counts.total}
          </Link>
          {ARTICLE_CATEGORIES.map((c) => {
            const count = counts.byCategory[c] ?? 0;
            if (count === 0 && c !== category) return null;
            const active = category === c;
            return (
              <Link
                key={c}
                href={`/insights?category=${c}`}
                className={cn(
                  "h-8 px-3 inline-flex items-center rounded text-[12.5px] border transition-colors",
                  active
                    ? "bg-bz-ink text-bz-bg border-bz-ink"
                    : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                )}
              >
                {ARTICLE_CATEGORY_LABELS[c]} · {count}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Grid */}
      <section className="px-12 pt-12 pb-24 max-w-[1280px]">
        {rest.length === 0 && !featured ? (
          <div className="py-24 text-center max-w-[40ch] mx-auto">
            <p className="text-[15px] text-bz-ink-2">
              We haven&apos;t published any{" "}
              {category ? ARTICLE_CATEGORY_LABELS[category].toLowerCase() : ""}{" "}
              insights yet.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/insights">View all categories</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-9 gap-y-14">
            {rest.map((row) => (
              <article key={row.id} className="group">
                <Link href={articleUrl(row)} className="block">
                  <div className="relative aspect-[4/3] rounded overflow-hidden bg-bz-surface-2">
                    <ArticleHero
                      row={row}
                      sizes="(min-width: 1280px) 380px, (min-width: 768px) 33vw, 100vw"
                    />
                  </div>
                  <div className="eyebrow mt-3.5">
                    {ARTICLE_CATEGORY_LABELS[row.category]}
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
    </div>
  );
}

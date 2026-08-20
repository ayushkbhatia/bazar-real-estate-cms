import type { Locale } from "@/lib/i18n/locales";
import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import {
  articleUrl,
  listPublishedArticles,
  type ArticleListRow,
} from "@/lib/queries/articles";
import {
  listArticleCategories,
  resolveArticleCategoryByUrlSlug,
} from "@/lib/queries/article-categories";
import { categoryToUrlSlug } from "@/lib/schemas/article";
import { mediaPublicUrl } from "@/lib/media";

export const revalidate = 300;

/**
 * URL slugs are the hyphenated form of the stored category slug
 * (`off_plan_watch` → `off-plan-watch`), kept SEO-friendly. Resolution is
 * DB-driven so categories added from the CMS get their own archive page.
 */
export async function generateStaticParams() {
  const categories = await listArticleCategories();
  return categories.map((c) => ({ cat: categoryToUrlSlug(c.slug) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>;
}): Promise<Metadata> {
  const { cat } = await params;
  const category = await resolveArticleCategoryByUrlSlug(cat);
  if (!category) return { title: "Category not found" };
  return {
    title: `${category.label} — Bazar insights`,
    description:
      category.description ??
      `Bazar's ${category.label.toLowerCase()} pieces on Abu Dhabi real estate.`,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ArticleHero({ row }: { row: ArticleListRow }) {
  if (row.hero) {
    return (
      <Image
        src={mediaPublicUrl(row.hero.storage_key)}
        alt={row.hero.alt_text ?? row.title}
        fill
        sizes="(min-width: 1280px) 380px, 33vw"
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

export default async function InsightsCategoryPage({
  params,
}: {
  params: Promise<{ cat: string; locale: Locale }>;
}) {
  /*
   * Locale from `params`, never ambient. An ambient `getTranslations` reads
   * `getLocale()`, which falls through to `headers()` and takes the route off
   * prerendering — check:routes caught all five of these at once.
   */
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "editorial" });
  const { cat } = await params;
  const category = await resolveArticleCategoryByUrlSlug(cat);
  if (!category) notFound();

  const { rows } = await listPublishedArticles({
    category: category.slug,
    limit: 48,
  });

  return (
    <div className="bg-bz-bg">
      {/* Crumb */}
      <div className="px-4 md:px-12 pt-10 max-w-[1280px]">
        <Link
          href="/insights"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-teal hover:text-bz-navy transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All insights
        </Link>
      </div>

      {/* Hero */}
      <section className="px-4 md:px-12 pt-8 pb-12 max-w-[1200px]">
        <Eyebrow>{t("eyebrow.category")}</Eyebrow>
        <h1
          className="serif text-[34px] md:text-[64px] mt-3 font-normal leading-[1.02]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {category.label}
        </h1>
        <p className="mt-4 text-[15px] text-bz-muted mono">
          {rows.length} {rows.length === 1 ? "article" : "articles"}
        </p>
      </section>

      {/* Grid */}
      <section className="px-4 md:px-12 pb-24 max-w-[1280px]">
        {rows.length === 0 ? (
          <div className="py-24 text-center max-w-[44ch] mx-auto border border-dashed border-bz-border rounded-md">
            <p className="text-[15px] text-bz-ink-2">
              We haven&apos;t published any {category.label.toLowerCase()}{" "}
              pieces yet.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/insights">View all categories</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-9 gap-y-14">
            {rows.map((row) => (
              <article key={row.id} className="group">
                <Link href={articleUrl(row)} className="block">
                  <div className="relative aspect-[4/3] rounded overflow-hidden bg-bz-surface-2">
                    <ArticleHero row={row} />
                  </div>
                  <div className="eyebrow mt-3.5">
                    {row.category_label}
                    {row.read_minutes ? ` · ${row.read_minutes} min` : ""}
                  </div>
                  <h2
                    className="serif text-[22px] mt-2 leading-[1.2] group-hover:text-bz-accent transition-colors"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {row.title}
                  </h2>
                  {row.excerpt ? (
                    <p className="mt-2 text-[13px] text-bz-ink-2 leading-snug line-clamp-3">
                      {row.excerpt}
                    </p>
                  ) : null}
                  <div className="mt-3 text-[11.5px] text-bz-muted">
                    {row.author?.display_name ?? "Bazar"}
                    {row.published_at
                      ? ` · ${formatDate(row.published_at)}`
                      : ""}
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

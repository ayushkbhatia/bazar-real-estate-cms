import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import {
  articleUrl,
  getPublishedArticleBySlug,
  getRelatedArticles,
} from "@/lib/queries/articles";
import { categoryToUrlSlug } from "@/lib/schemas/article";
import { mediaPublicUrl } from "@/lib/media";
import { articleJsonLd, breadcrumbListJsonLd } from "@/lib/jsonld";
import { env } from "@/lib/env";
import { ChevronRight } from "lucide-react";

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return { title: "Not found · The Bazar Brief" };
  const seo = (article.seo as Record<string, unknown> | null) ?? {};
  const metaTitle = (seo.meta_title as string | null) ?? article.title;
  const metaDescription =
    (seo.meta_description as string | null) ?? article.excerpt ?? undefined;
  return {
    title: `${metaTitle} · The Bazar Brief`,
    description: metaDescription,
    openGraph: {
      title: metaTitle,
      description: metaDescription ?? undefined,
      type: "article",
      publishedTime: article.published_at ?? undefined,
      authors: article.author ? [article.author.display_name] : undefined,
    },
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

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const related = await getRelatedArticles(article.id, article.category, 3);

  const categoryLabel = article.category_label;
  const heroSrc = article.hero ? mediaPublicUrl(article.hero.storage_key) : null;

  // Sprint 5d: JSON-LD + breadcrumb structured data.
  const siteUrl = (
    env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app"
  ).replace(/\/+$/, "");
  const ldArticle = articleJsonLd(
    {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      category: categoryLabel,
      published_at: article.published_at,
      updated_at: article.updated_at,
      read_minutes: article.read_minutes,
      author: article.author
        ? {
            display_name: article.author.display_name,
            slug: article.author.slug,
          }
        : null,
    },
    heroSrc,
  );
  const ldBreadcrumb = breadcrumbListJsonLd([
    { name: "Home", url: `${siteUrl}/` },
    { name: "Insights", url: `${siteUrl}/insights` },
    {
      name: categoryLabel,
      url: `${siteUrl}/insights/category/${categoryToUrlSlug(article.category)}`,
    },
    { name: article.title, url: `${siteUrl}/insights/${article.slug}` },
  ]);

  return (
    <article className="bg-bz-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldArticle) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumb) }}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="px-4 md:px-12 pt-8 max-w-[760px] mx-auto text-[12px] text-bz-muted flex flex-wrap items-center gap-1.5"
      >
        <Link href="/" className="text-bz-teal hover:text-bz-navy">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link href="/insights" className="text-bz-teal hover:text-bz-navy">
          Insights
        </Link>
        <ChevronRight size={12} />
        <Link
          href={`/insights/category/${categoryToUrlSlug(article.category)}`}
          className="text-bz-teal hover:text-bz-navy"
        >
          {categoryLabel}
        </Link>
      </nav>

      <header className="px-4 md:px-12 pt-8 pb-12 max-w-[760px] mx-auto">
        <Eyebrow>
          {categoryLabel}
          {article.read_minutes ? ` · ${article.read_minutes} min read` : ""}
        </Eyebrow>
        <h1
          className="serif text-[32px] md:text-[60px] mt-4 font-normal"
          style={{ letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          {article.title}
        </h1>
        {article.excerpt ? (
          <p className="mt-6 text-[18px] text-bz-ink-2 leading-relaxed">
            {article.excerpt}
          </p>
        ) : null}
        <div className="mt-8 pt-6 border-t border-bz-border flex flex-wrap items-center gap-4">
          {article.author ? (
            <>
              <div className="w-11 h-11 rounded-full bg-bz-surface-3 text-bz-ink flex items-center justify-center text-[13px] font-medium">
                {article.author.display_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <div className="text-[13.5px] font-medium">
                  {article.author.display_name}
                </div>
                <div className="text-[11.5px] text-bz-muted">
                  {article.author.title ?? "Bazar"}
                  {article.published_at
                    ? ` · ${formatDate(article.published_at)}`
                    : ""}
                </div>
              </div>
            </>
          ) : article.published_at ? (
            <div className="text-[12px] text-bz-muted">
              {formatDate(article.published_at)}
            </div>
          ) : null}
        </div>
      </header>

      {/* Same measure as the body below, so the cover and the copy share one column. */}
      <div className="px-4 md:px-12 max-w-[760px] mx-auto">
        <div className="relative aspect-[21/9] rounded overflow-hidden bg-bz-surface-2">
          {heroSrc ? (
            <Image
              src={heroSrc}
              alt={article.hero?.alt_text ?? article.title}
              fill
              sizes="(min-width: 760px) 664px, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <PlaceholderImage
              label={`${categoryLabel.toLowerCase()} · hero`}
              className="w-full h-full"
            />
          )}
        </div>
      </div>

      <div className="px-4 md:px-12 py-16 max-w-[760px] mx-auto">
        <div
          className="bz-prose text-[17.5px] leading-[1.7] text-bz-ink"
          dangerouslySetInnerHTML={{ __html: article.body_html }}
        />
      </div>

      {related.length > 0 ? (
        <section className="border-t border-bz-border px-4 md:px-12 py-12 md:py-20 max-w-[1280px] mx-auto">
          <h3
            className="serif text-[28px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Keep reading
          </h3>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {related.map((row) => (
              <Link key={row.id} href={articleUrl(row)} className="group block">
                <div className="relative aspect-[4/3] rounded overflow-hidden bg-bz-surface-2">
                  {row.hero ? (
                    <Image
                      src={mediaPublicUrl(row.hero.storage_key)}
                      alt={row.hero.alt_text ?? row.title}
                      fill
                      sizes="(min-width: 1280px) 380px, (min-width: 768px) 33vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <PlaceholderImage
                      label={row.title.toLowerCase().slice(0, 22)}
                      className="w-full h-full"
                    />
                  )}
                </div>
                <div className="eyebrow mt-3.5">
                  {row.category_label}
                  {row.read_minutes ? ` · ${row.read_minutes} min` : ""}
                </div>
                <h4
                  className="serif text-[19px] mt-2 leading-[1.25] group-hover:text-bz-accent transition-colors"
                >
                  {row.title}
                </h4>
                <div className="mt-2 text-[11.5px] text-bz-muted">
                  By {row.author?.display_name ?? "Bazar"}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild variant="outline">
              <Link href="/insights">Back to all insights</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </article>
  );
}

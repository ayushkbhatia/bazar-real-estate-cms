import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/locales";
import { authoredTitle } from "@/lib/queries/search-appearance";
import {
  localiseSearchAppearance,
  readSearchAppearance,
} from "@/lib/schemas/seo";
import { getPublishedPageBySlug, listPublishedPageSlugs } from "@/lib/queries/pages";
import { BlockRenderer } from "./_block-renderer";

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string; locale: Locale }> };

export async function generateStaticParams() {
  const slugs = await listPublishedPageSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const page = await getPublishedPageBySlug(slug);
  if (!page) return { title: "Not found" };
  // Same bag, same parser and same fold as every other editable surface, so a
  // page edited in Pages & blocks publishes what its Search appearance card
  // previewed — untemplated, and in the locale being served.
  const seo = localiseSearchAppearance(readSearchAppearance(page.seo), locale);
  const metaTitle = seo.meta_title ?? page.title;
  const metaDescription = seo.meta_description ?? undefined;
  return {
    title: authoredTitle(seo.meta_title, metaTitle),
    description: metaDescription,
    alternates: { canonical: `/pages/${slug}` },
    openGraph: {
      title: metaTitle,
      description: metaDescription ?? undefined,
    },
  };
}

export default async function PublicPagePage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);
  if (!page) notFound();

  return (
    <div className="bg-bz-bg">
      {page.blocks.map((block, idx) => (
        <BlockRenderer key={idx} block={block} />
      ))}
    </div>
  );
}

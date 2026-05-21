import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedPageBySlug, listPublishedPageSlugs } from "@/lib/queries/pages";
import { BlockRenderer } from "./_block-renderer";

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await listPublishedPageSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);
  if (!page) return { title: "Not found" };
  const seo = page.seo ?? {};
  const metaTitle = (seo.meta_title as string | null) ?? page.title;
  const metaDescription = (seo.meta_description as string | null) ?? undefined;
  return {
    title: metaTitle,
    description: metaDescription,
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

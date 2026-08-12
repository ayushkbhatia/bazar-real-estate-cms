import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPublishedLandingBySlug,
  listPublishedLandingSlugs,
} from "@/lib/queries/landing-pages";
import { attachImageUrls } from "@/lib/queries/section-images";
import { resolveDocument } from "@/lib/page-builder";
import {
  DEFAULT_LOCALE,
  isEnabledLocale,
  type Locale,
} from "@/lib/i18n/locales";
import { loadLandingData } from "@/lib/page-builder/data";
import { LandingRenderer } from "./_render";

/**
 * Campaign landing pages, assembled in /admin/page-builder.
 *
 * Two rules this route lives or dies by:
 *
 *  1. Nothing here may read `cookies()`, `headers()`, `searchParams`, or call
 *     `isPhoneRequest()`. Any one of them silently turns the route dynamic,
 *     which drops `revalidate` on the floor — and since a page can hold several
 *     live-inventory sections, that turns a cached fan-out into a per-request
 *     one. Mobile is handled by CSS breakpoints in a single tree, the way the
 *     rest of the site does it.
 *
 *  2. Data is fetched once, up front, by `loadLandingData`. Section components
 *     receive it as props. See lib/page-builder/data.ts.
 */
export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string; locale: string }> };

/**
 * Prerender a bounded window of the most recent campaigns; `dynamicParams`
 * stays at its default `true`, so anything older still resolves on demand.
 * CI runs `npm run build` against the production database in three jobs, so an
 * uncapped list would make every push slower and more expensive as the campaign
 * backlog grows.
 */
export async function generateStaticParams() {
  const slugs = await listPublishedLandingSlugs(20);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedLandingBySlug(slug);
  if (!page) return {};
  const seo = page.seo ?? {};
  const title =
    typeof seo.meta_title === "string" && seo.meta_title.trim() !== ""
      ? seo.meta_title
      : page.title;
  const description =
    typeof seo.meta_description === "string" ? seo.meta_description : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/lp/${page.slug}` },
    robots: page.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, description, url: `/lp/${page.slug}`, type: "website" },
  };
}

export default async function LandingPage({ params }: PageProps) {
  const { slug, locale: rawLocale } = await params;
  const page = await getPublishedLandingBySlug(slug);
  // A draft or deleted page is invisible to the anon client by RLS, so this is
  // the 404 for both.
  if (!page) notFound();

  // Fold to the route's locale. Every adapter and the 16-arm render switch
  // below keep reading `values.title` — they never learn Arabic exists.
  const locale: Locale = isEnabledLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const blocks = resolveDocument(page.blocks, locale);
  // One media query for every picked image on the page, whatever the depth.
  await attachImageUrls(blocks);
  const data = await loadLandingData(blocks);

  return <LandingRenderer blocks={blocks} data={data} />;
}

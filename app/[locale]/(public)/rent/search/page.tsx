import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { asLocale } from "@/lib/i18n/locales";
import { searchHeaderMetadata } from "@/lib/queries/search-headers";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

// A search route: it reads `searchParams`, which makes the whole route
// dynamic, so a `revalidate` here would be silently discarded. Saying
// force-dynamic keeps the config honest about what Next.js actually does.
export const dynamic = "force-dynamic";

/*
 * The snippet is CMS content now — Pages → Sub-pages → Search results → Rent —
 * and it is read per locale. The literal that used to live here is the
 * registry's English default, so an un-edited document publishes exactly what
 * this route published before; `/ar` gains an Arabic snippet, which it never
 * had. See `lib/master-pages/search-headers.ts`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return searchHeaderMetadata("rent", null, locale);
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RentSearchPage({ params, searchParams }: PageProps) {
  // Pinned here as well as in the [locale] layout: a filter click is a
  // client navigation, which re-renders this segment without the layout.
  // See `withLocaleHeader` in proxy.ts for the other half.
  setRequestLocale(asLocale((await params).locale));
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return <SearchList mode="rent" filters={filters} searchParams={raw} />;
}

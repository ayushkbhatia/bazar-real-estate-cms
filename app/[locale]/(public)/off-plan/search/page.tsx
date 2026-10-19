import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { asLocale } from "@/lib/i18n/locales";
import { searchHeaderMetadata } from "@/lib/queries/search-headers";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

export const dynamic = "force-dynamic";

// The snippet is CMS content — see the note on /rent/search.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return searchHeaderMetadata("off_plan", null, locale);
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OffPlanSearchPage({ params, searchParams }: PageProps) {
  // Pinned here as well as in the [locale] layout: a filter click is a
  // client navigation, which re-renders this segment without the layout.
  // See `withLocaleHeader` in proxy.ts for the other half.
  setRequestLocale(asLocale((await params).locale));
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return (
    <SearchList
      mode="off_plan"
      filters={filters}
      searchParams={raw}
    />
  );
}

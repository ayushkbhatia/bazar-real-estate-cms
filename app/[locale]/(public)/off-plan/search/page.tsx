import type { Metadata } from "next";
import { asLocale } from "@/lib/i18n/locales";
import { getSearchHeaderMeta } from "@/lib/queries/search-headers";
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
  const meta = await getSearchHeaderMeta("off_plan", null, locale);
  return { title: meta.title, description: meta.description };
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OffPlanSearchPage({ searchParams }: PageProps) {
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

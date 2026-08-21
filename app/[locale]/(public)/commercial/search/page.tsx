import type { Metadata } from "next";
import { asLocale } from "@/lib/i18n/locales";
import { getSearchHeaderMeta } from "@/lib/queries/search-headers";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

// A search route: it reads `searchParams`, which makes the whole route
// dynamic, so a `revalidate` here would be silently discarded. Saying
// force-dynamic keeps the config honest about what Next.js actually does.
export const dynamic = "force-dynamic";

// The snippet is CMS content — see the note on /rent/search.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const meta = await getSearchHeaderMeta("commercial", null, locale);
  return { title: meta.title, description: meta.description };
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Relocated from `/commercial`, which is now the marketing landing — the same
 * split `/buy`, `/rent` and `/off-plan` already have. Old `/commercial?type=…`
 * deep-links are redirected here by proxy.ts.
 */
export default async function CommercialSearchPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return <SearchList mode="commercial" filters={filters} searchParams={raw} />;
}

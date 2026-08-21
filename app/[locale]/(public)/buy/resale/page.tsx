import type { Metadata } from "next";
import { asLocale } from "@/lib/i18n/locales";
import { getSearchHeaderMeta } from "@/lib/queries/search-headers";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

// A search route: it reads `searchParams`, which makes the whole route
// dynamic, so a `revalidate` here would be silently discarded. Saying
// force-dynamic keeps the config honest about what Next.js actually does.
export const dynamic = "force-dynamic";

/**
 * Resale = previously owned. The seller is the current owner, not the
 * developer. Sibling route to /buy/ready; the two must never share an h1.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  // The snippet is CMS content — see the note on /rent/search. `alternates`
  // is not: a canonical is routing, not copy, and stays with the route.
  const meta = await getSearchHeaderMeta("buy", "resale", locale);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: "/buy/resale" },
  };
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuyResalePage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return (
    <SearchList
      mode="buy"
      form="resale"
      filters={filters}
      searchParams={raw}
    />
  );
}

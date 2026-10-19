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
 * The snippet is CMS content — see the note on /rent/search — and it is the one
 * route whose snippet varies on a query parameter.
 *
 * `?form=` is a real slice of the buy umbrella: the page already gives
 * /buy/search?form=off_plan its own h1 rather than the umbrella's, so a search
 * result that quoted the umbrella's title over that heading would describe a
 * different page. `parseFilters` is reused rather than reading `form` by hand,
 * so the facet this resolves and the facet the page renders cannot diverge.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ locale }, raw] = await Promise.all([params, searchParams]);
  const filters = parseFilters(raw);
  // `segment` resolves the Commercial facet: /commercial/search 307s here, so
  // without it a commercial search publishes the Buy facet's snippet.
  return searchHeaderMetadata(
    "buy",
    filters.form ?? null,
    asLocale(locale),
    filters.segment,
  );
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuySearchPage({ params, searchParams }: PageProps) {
  // Pinned here as well as in the [locale] layout: a filter click is a
  // client navigation, which re-renders this segment without the layout.
  // See `withLocaleHeader` in proxy.ts for the other half.
  setRequestLocale(asLocale((await params).locale));
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return <SearchList mode="buy" filters={filters} searchParams={raw} />;
}

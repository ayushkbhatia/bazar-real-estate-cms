import type { Metadata } from "next";
import { asLocale } from "@/lib/i18n/locales";
import { getSearchHeaderMeta } from "@/lib/queries/search-headers";
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
  const meta = await getSearchHeaderMeta(
    "buy",
    parseFilters(raw).form ?? null,
    asLocale(locale),
  );
  return { title: meta.title, description: meta.description };
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuySearchPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return <SearchList mode="buy" filters={filters} searchParams={raw} />;
}

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
  const meta = await getSearchHeaderMeta("rent", null, locale);
  return { title: meta.title, description: meta.description };
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RentSearchPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return <SearchList mode="rent" filters={filters} searchParams={raw} />;
}

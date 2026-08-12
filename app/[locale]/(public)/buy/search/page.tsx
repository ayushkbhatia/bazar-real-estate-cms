import type { Metadata } from "next";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

// A search route: it reads `searchParams`, which makes the whole route
// dynamic, so a `revalidate` here would be silently discarded. Saying
// force-dynamic keeps the config honest about what Next.js actually does.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Properties for sale",
  description:
    "Curated freehold and leasehold properties for sale across the United Arab Emirates.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuySearchPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return <SearchList mode="buy" filters={filters} searchParams={raw} />;
}

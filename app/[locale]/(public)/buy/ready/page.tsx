import type { Metadata } from "next";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

// A search route: it reads `searchParams`, which makes the whole route
// dynamic, so a `revalidate` here would be silently discarded. Saying
// force-dynamic keeps the config honest about what Next.js actually does.
export const dynamic = "force-dynamic";

/**
 * Ready (new) = the developer's FIRST SALE — completed, handed over, never
 * previously owned. It is provenance, not age: a five-year-old unit the
 * developer never sold is still ready-new. Do not describe it as "recently
 * built".
 */
export function generateMetadata(): Metadata {
  return {
    title: "Ready homes, never lived in",
    description:
      "Completed properties for sale direct from the developer — a first sale with no previous owner on the title, ready to move into.",
    alternates: { canonical: "/buy/ready" },
  };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuyReadyPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return (
    <SearchList
      mode="buy"
      form="ready_new"
      filters={filters}
      searchParams={raw}
    />
  );
}

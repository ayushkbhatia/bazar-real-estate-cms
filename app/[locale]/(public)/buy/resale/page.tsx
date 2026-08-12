import type { Metadata } from "next";
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
export function generateMetadata(): Metadata {
  return {
    title: "Resale homes for sale",
    description:
      "Previously owned properties for sale across the United Arab Emirates — bought from the current owner, in established communities with a known service-charge history.",
    alternates: { canonical: "/buy/resale" },
  };
}

type PageProps = {
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

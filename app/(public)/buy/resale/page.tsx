import type { Metadata } from "next";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";
import type { SearchView } from "../../_components/view-toggle";

export const revalidate = 60;

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

const ALLOWED_VIEWS: readonly SearchView[] = ["grid", "list", "map"];

export default async function BuyResalePage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const v = typeof raw.view === "string" ? raw.view : null;
  const view: SearchView = ALLOWED_VIEWS.includes(v as SearchView)
    ? (v as SearchView)
    : "grid";
  return (
    <SearchList
      mode="buy"
      form="resale"
      filters={filters}
      view={view}
      searchParams={raw}
    />
  );
}

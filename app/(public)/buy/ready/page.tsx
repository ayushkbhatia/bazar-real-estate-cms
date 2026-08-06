import type { Metadata } from "next";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";
import type { SearchView } from "../../_components/view-toggle";

export const revalidate = 60;

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

const ALLOWED_VIEWS: readonly SearchView[] = ["grid", "list", "map"];

export default async function BuyReadyPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const v = typeof raw.view === "string" ? raw.view : null;
  const view: SearchView = ALLOWED_VIEWS.includes(v as SearchView)
    ? (v as SearchView)
    : "grid";
  return (
    <SearchList
      mode="buy"
      form="ready_new"
      filters={filters}
      view={view}
      searchParams={raw}
    />
  );
}

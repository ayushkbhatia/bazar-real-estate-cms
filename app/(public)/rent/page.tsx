import type { Metadata } from "next";
import { SearchList } from "../_components/search-list";
import { parseFilters } from "@/lib/filters/property";
import type { SearchView } from "../_components/view-toggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rent",
  description:
    "Long-let homes from advisor-vetted landlords across the United Arab Emirates.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ALLOWED_VIEWS: readonly SearchView[] = ["grid", "list", "map"];

export default async function RentPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const v = typeof raw.view === "string" ? raw.view : null;
  const view: SearchView = ALLOWED_VIEWS.includes(v as SearchView)
    ? (v as SearchView)
    : "grid";
  return (
    <SearchList
      mode="rent"
      filters={filters}
      view={view}
      searchParams={raw}
    />
  );
}

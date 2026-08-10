import type { Metadata } from "next";
import { SearchList } from "../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commercial",
  description:
    "Office, retail, and industrial leases and freeholds across the United Arab Emirates.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommercialPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return (
    <SearchList
      mode="commercial"
      filters={filters}
      searchParams={raw}
    />
  );
}

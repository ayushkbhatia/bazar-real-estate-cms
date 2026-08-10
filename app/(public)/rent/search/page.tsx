import type { Metadata } from "next";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Properties for rent",
  description:
    "Long-let homes from advisor-vetted landlords across the United Arab Emirates.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RentSearchPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return <SearchList mode="rent" filters={filters} searchParams={raw} />;
}

import type { Metadata } from "next";
import { SearchList } from "../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rent",
  description:
    "Long-let homes from advisor-vetted landlords across the United Arab Emirates.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RentPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return <SearchList mode="rent" filters={filters} />;
}

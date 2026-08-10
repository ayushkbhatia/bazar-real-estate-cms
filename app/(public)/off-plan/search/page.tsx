import type { Metadata } from "next";
import { SearchList } from "../../_components/search-list";
import { parseFilters } from "@/lib/filters/property";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Off-plan developments",
  description:
    "Pre-launch and on-sale developments from Abu Dhabi's leading developers.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OffPlanSearchPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  return (
    <SearchList
      mode="off_plan"
      filters={filters}
      searchParams={raw}
    />
  );
}

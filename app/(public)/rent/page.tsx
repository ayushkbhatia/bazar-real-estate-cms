import type { Metadata } from "next";
import { SearchList } from "../_components/search-list";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Rent",
  description:
    "Long-let homes from advisor-vetted landlords across the United Arab Emirates.",
};

export default function RentPage() {
  return <SearchList mode="rent" />;
}

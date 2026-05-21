import type { Metadata } from "next";
import { SearchList } from "../_components/search-list";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Buy",
  description:
    "Curated freehold and leasehold properties for sale across the United Arab Emirates.",
};

export default function BuyPage() {
  return <SearchList mode="buy" />;
}

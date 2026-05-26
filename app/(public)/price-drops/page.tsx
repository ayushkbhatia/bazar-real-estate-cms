import type { Metadata } from "next";
import { listPriceDrops } from "@/lib/queries/curated-listings";
import { CuratedGrid } from "../_components/curated-grid";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Price drops",
  description:
    "Listings where the asking price has moved down since first listing — sorted by most-recent drop.",
  alternates: { canonical: "/price-drops" },
};

export default async function PriceDropsPage() {
  const rows = await listPriceDrops({ limit: 24 });
  return (
    <CuratedGrid
      eyebrow="Price drops"
      title="Sellers who've moved."
      intro="Listings where the asking price has been reduced since first listing. Useful for buyers tracking a market that's still finding its footing on the resale side. Pair with a saved search and we'll email you the moment a watched listing reprices."
      rows={rows}
      browseAllHref="/buy"
      browseAllLabel="Browse all listings"
    />
  );
}

import type { Metadata } from "next";
import { listExclusiveProperties } from "@/lib/queries/curated-listings";
import { CuratedGrid } from "../_components/curated-grid";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Exclusive listings",
  description:
    "Off-portal listings represented solely by Bazar — properties you won't see on Property Finder, Bayut, or other agencies.",
  alternates: { canonical: "/exclusive" },
};

export default async function ExclusivePage() {
  const rows = await listExclusiveProperties({ limit: 24 });
  return (
    <CuratedGrid
      eyebrow="Exclusive · Bazar only"
      title="Listings nobody else has."
      intro="When a seller wants their property represented quietly — by a single firm, off-portal, with a known buyer pool — they come to us. Below: every Bazar-exclusive listing currently active."
      rows={rows}
      browseAllHref="/buy/search"
      browseAllLabel="Browse all listings"
    />
  );
}

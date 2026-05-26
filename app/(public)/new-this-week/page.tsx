import type { Metadata } from "next";
import { listNewThisWeek } from "@/lib/queries/curated-listings";
import { CuratedGrid } from "../_components/curated-grid";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "New this week",
  description:
    "Every listing published on Bazar in the last seven days — sorted newest first.",
  alternates: { canonical: "/new-this-week" },
};

export default async function NewThisWeekPage() {
  const rows = await listNewThisWeek({ limit: 24 });
  return (
    <CuratedGrid
      eyebrow="New this week"
      title="Listed in the last seven days."
      intro="Fresh stock, including off-market drops that aren't on portals yet. We push these out to our saved-search subscribers first; this page is the public mirror."
      rows={rows}
      browseAllHref="/buy"
      browseAllLabel="Browse all listings"
    />
  );
}

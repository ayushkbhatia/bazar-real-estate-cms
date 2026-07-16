import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";

/**
 * Curated "marquee" order for the index cards — the recognisable lifestyle
 * islands and prime districts, rather than the raw alphabetical cut (which
 * led with free zones like ADGM / KIZAD). Any slug absent from the live set
 * is skipped and backfilled below, so this list can't 404 the grid.
 */
const MARQUEE_SLUGS = [
  "saadiyat-island",
  "yas-island",
  "al-reem-island",
  "hudayriyat-island",
  "al-maryah",
  "al-raha",
  "corniche",
  "khalifa-city",
];

/**
 * Areas index "clickable cards" — the same tile treatment as the home
 * "Location-based browsing" grid (image + gradient scrim + name + live
 * listing count), laid out as a clean 4×2 grid (2-up on mobile) linking
 * into each area's guide. Fetches live counts; falls back to nothing when
 * Supabase is unconfigured and seeds are empty.
 */
export async function AreaCards() {
  const entries = await listAreasWithCounts();
  const bySlug = new Map(entries.map((e) => [e.slug, e]));

  // Marquee order first (only those present in the live set), then backfill
  // from the remaining areas so the grid always renders a full 4×2 even if
  // the seed/DB set shifts.
  const picked = MARQUEE_SLUGS.flatMap((s) => {
    const e = bySlug.get(s);
    return e ? [e] : [];
  });
  const fill = entries.filter((e) => !MARQUEE_SLUGS.includes(e.slug));
  const areas = [...picked, ...fill].slice(0, 8);
  if (areas.length === 0) return null;

  return (
    <section className="px-4 md:px-12 pb-4 md:pb-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {areas.map((c) => (
          <Link
            key={c.id}
            href={`/areas/${c.slug}`}
            className="group relative block h-[220px] overflow-hidden rounded-lg md:h-[240px]"
          >
            <PlaceholderImage
              label={c.slug}
              className="absolute inset-0 h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white md:p-5">
              <div
                className="serif text-[20px] leading-tight md:text-[21px]"
                style={{ letterSpacing: "-0.01em" }}
              >
                {c.name}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/85">
                {c.listing_count.toLocaleString("en-US")} homes for sale{" "}
                <ArrowRight size={12} strokeWidth={1.8} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

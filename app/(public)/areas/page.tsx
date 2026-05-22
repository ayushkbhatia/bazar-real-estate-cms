import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { SEED_AREA_GUIDES } from "@/lib/seeds/areas";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";

export const metadata: Metadata = {
  title: "Areas",
  description:
    "Bazar's guides to Abu Dhabi's residential islands and central districts — Saadiyat, Yas, Reem, Al Raha, Corniche.",
};

export default async function AreasIndexPage() {
  // Real listing counts (when DB data exists) overlay the seed area
  // guides. The seed remains the source of truth for editorial content
  // (hero_label, intro, stats) until Sprint 12 wires DLD ingestion.
  const indexEntries = await listAreasWithCounts();
  const countBySlug = new Map(
    indexEntries.map((e) => [e.slug, e.listing_count]),
  );
  return (
    <div className="bg-bz-bg">
      <section className="px-12 pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>Areas</Eyebrow>
        <h1
          className="serif text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Abu Dhabi,<br />
          neighbourhood by neighbourhood.
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          Each Bazar area guide is written by the advisor who covers it. Median
          prices and DOM stats refreshed quarterly from DLD and ADREC filings.
        </p>
      </section>

      <section className="px-12 pb-24 max-w-[1280px]">
        <div className="grid grid-cols-3 gap-6 gap-y-10">
          {SEED_AREA_GUIDES.map((a) => (
            <Link key={a.slug} href={`/areas/${a.slug}`} className="group block">
              <PlaceholderImage
                label={a.hero_label}
                className="w-full aspect-[4/3] rounded-md"
              />
              <div className="mt-4">
                <h2
                  className="serif text-[24px] leading-tight group-hover:text-bz-accent transition-colors"
                  style={{ letterSpacing: "-0.012em" }}
                >
                  {a.name}
                </h2>
                <p className="mt-2 text-[13px] text-bz-ink-2 leading-snug line-clamp-2">
                  {a.intro}
                </p>
                <div className="mt-3 flex gap-5 text-[11.5px]">
                  <span className="text-bz-muted">
                    Med. apt ·{" "}
                    <span className="mono text-bz-ink">
                      {a.stats.median_apt_aed_per_ft2.toLocaleString()} AED/ft²
                    </span>
                  </span>
                  <span className="text-bz-muted">
                    YoY ·{" "}
                    <span className="mono text-bz-ink">
                      {a.stats.yoy_change_pct > 0 ? "+" : ""}
                      {a.stats.yoy_change_pct}%
                    </span>
                  </span>
                  {countBySlug.has(a.slug) ? (
                    <span className="text-bz-muted">
                      Listings ·{" "}
                      <span className="mono text-bz-ink">
                        {countBySlug.get(a.slug)}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

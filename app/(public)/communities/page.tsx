import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { AreaList, type AreaRow } from "../_components/marketing/area-list";
import { AD_AREAS } from "../_components/marketing/ad-data";

export const metadata: Metadata = {
  title: "Communities in Abu Dhabi",
  description:
    "From waterfront destinations to family-friendly neighbourhoods, discover the Abu Dhabi communities that define living and investing in the capital.",
  alternates: { canonical: "/communities" },
};

export const revalidate = 300;

type CommunityType = {
  name: string;
  tagline: string;
  about: string;
  chips: string[];
  img: string;
};

const COMMUNITY_TYPES: CommunityType[] = [
  {
    name: "Waterfront Communities",
    tagline:
      "Explore communities designed around sea views, canals, promenades, and relaxed waterfront living.",
    about:
      "Designed around views, open spaces, and lifestyle convenience, waterfront communities remain highly desirable.",
    chips: [
      "Mamsha Al Saadiyat",
      "Hidd Al Saadiyat",
      "Al Muneera",
      "Al Bandar",
      "Al Zeina",
      "Yas Acres",
      "Reem Hills",
      "Gardenia Bay",
    ],
    img: "waterfront promenade · canal",
  },
  {
    name: "Gated Communities",
    tagline:
      "Discover private residential communities offering security, comfort, and a more exclusive living environment.",
    about:
      "Gated communities are ideal for families seeking privacy, security, landscaped spaces, and everyday convenience.",
    chips: [
      "Yas Acres",
      "Saadiyat Lagoons",
      "Saadiyat Reserve",
      "Al Raha Gardens",
      "Reem Hills",
      "Al Ghadeer",
      "Bloom Living",
      "Hidd Al Saadiyat",
    ],
    img: "gated villa community · aerial",
  },
  {
    name: "Luxury Communities",
    tagline:
      "Explore Abu Dhabi's most premium addresses, offering high-end residences, exclusive amenities, and prime locations.",
    about:
      "Luxury communities offer premium homes, refined surroundings, privacy, and strong lifestyle appeal.",
    chips: [
      "Mamsha Al Saadiyat",
      "Hidd Al Saadiyat",
      "Saadiyat Lagoons",
      "Saadiyat Reserve",
      "Nurai Island",
      "Nobu Residences",
      "Baccarat Residences Saadiyat",
      "Ramhan Island",
    ],
    img: "luxury residence · beachfront",
  },
  {
    name: "Family-Friendly Communities",
    tagline:
      "Find communities designed around comfort, convenience, space, and everyday family living.",
    about:
      "Family-friendly communities are ideal for those seeking space, convenience, and long-term comfort.",
    chips: [
      "Yas Acres",
      "Al Raha Gardens",
      "Bloom Living",
      "Al Ghadeer",
      "Saadiyat Lagoons",
      "Noya",
      "Noya Viva",
      "Fay Al Reeman",
    ],
    img: "family townhouses · park",
  },
];

export default async function CommunitiesPage() {
  const areaCounts = await listAreasWithCounts();
  const bySlug = new Map(
    areaCounts.map((a) => [a.name, { slug: a.slug, count: a.listing_count }]),
  );
  const areas: AreaRow[] = AD_AREAS.map((a) => {
    const hit = bySlug.get(a.name);
    return {
      ...a,
      count: hit?.count,
      // Real areas link to their community guide; unseeded ones fall back to
      // a filtered search (avoids a /communities/<slug> 404).
      href: hit ? `/communities/${hit.slug}` : "/buy/search",
    };
  });

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-12">
        <Eyebrow>Abu Dhabi Locations</Eyebrow>
        <h1
          className="serif mt-3.5 max-w-[1000px]"
          style={{
            fontSize: fluid(84),
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
          }}
        >
          Explore Abu Dhabi&apos;s
          <br />
          leading <em className="italic">communities.</em>
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[680px] leading-relaxed mt-5">
          From waterfront destinations to family-friendly neighbourhoods,
          discover the areas that define living and investing in the capital.
        </p>
      </section>

      {/* Numbered areas */}
      <section className="px-4 md:px-12 pb-16 md:pb-20">
        <div className="max-w-[1200px]">
          <AreaList areas={areas} />
        </div>
      </section>

      {/* Community types */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-surface-2">
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="Community types"
            title="Find the setting that fits your life."
            sub="Every community has a character. Filter by the way you want to live."
            size={40}
            className="mb-4"
          />
          {COMMUNITY_TYPES.map((t, i) => (
            <div
              key={t.name}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center py-10 md:py-12 border-t border-bz-border"
            >
              <div className={i % 2 ? "lg:order-2" : ""}>
                <div
                  className="relative w-full"
                  style={{ aspectRatio: "16/11" }}
                >
                  <PlaceholderImage
                    label={t.img}
                    className="absolute inset-0 h-full w-full rounded-xl"
                  />
                </div>
              </div>
              <div className={i % 2 ? "lg:order-1" : ""}>
                <div
                  className="serif"
                  style={{
                    fontSize: fluid(38),
                    letterSpacing: "-0.02em",
                    lineHeight: 1.05,
                  }}
                >
                  {t.name}
                </div>
                <p className="text-[15px] md:text-[16px] text-bz-ink-2 leading-relaxed mt-3.5 max-w-[520px]">
                  {t.tagline}
                </p>
                <p className="text-[14px] text-bz-muted leading-relaxed mt-3 max-w-[520px]">
                  {t.about}
                </p>
                <div className="eyebrow mt-6">
                  Popular {t.name.split(" ")[0].toLowerCase()} communities
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {t.chips.map((c) => (
                    <span
                      key={c}
                      className="px-3 py-1.5 rounded-full bg-bz-surface border border-bz-border text-[12.5px]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <Button
                  asChild
                  className="mt-6 bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
                >
                  <Link href="/communities">
                    Explore {t.name.split(" ")[0].toLowerCase()} communities
                    <ArrowRight size={15} strokeWidth={1.7} />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

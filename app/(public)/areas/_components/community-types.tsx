import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "../../_components/marketing/fluid";
import { SectionHead } from "../../_components/marketing/section-head";

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

/**
 * "Community types" — the setting-led cut of the catalogue (waterfront /
 * gated / luxury / family). Repositioned below the spotlights + lead form
 * on the areas index. Full-bleed (no max-width cap) so it fills the desktop
 * width like the rest of the page.
 */
export function CommunityTypes() {
  return (
    <section className="border-t border-bz-border bg-bz-surface-2 px-4 py-14 md:px-12 md:py-20">
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
          className="grid grid-cols-1 items-center gap-8 border-t border-bz-border py-10 lg:grid-cols-2 lg:gap-14 md:py-12"
        >
          <div className={i % 2 ? "lg:order-2" : ""}>
            <div className="relative w-full" style={{ aspectRatio: "16/11" }}>
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
            <p className="mt-3.5 max-w-[520px] text-[15px] leading-relaxed text-bz-ink-2 md:text-[16px]">
              {t.tagline}
            </p>
            <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-bz-muted">
              {t.about}
            </p>
            <div className="eyebrow mt-6">
              Popular {t.name.split(" ")[0].toLowerCase()} communities
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {t.chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-bz-border bg-bz-surface px-3 py-1.5 text-[12.5px]"
                >
                  {c}
                </span>
              ))}
            </div>
            <Button
              asChild
              className="mt-6 bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
            >
              <Link href="/areas">
                Explore {t.name.split(" ")[0].toLowerCase()} communities
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}

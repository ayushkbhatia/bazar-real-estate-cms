import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "../../_components/marketing/fluid";
import { SectionHead } from "../../_components/marketing/section-head";

export type CommunityType = {
  enabled?: boolean;
  name?: string | null;
  tagline?: string | null;
  about?: string | null;
  /** Chip labels, already split from the editor's one-per-line textarea. */
  chips?: string[];
  chipsLabel?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLabel?: string | null;
};

/**
 * "Community types" — the setting-led cut of the catalogue (waterfront /
 * gated / luxury / family). Full-bleed (no max-width cap) so it fills the
 * desktop width like the rest of the page.
 *
 * Content comes from the areas master page. The fallback below keeps the
 * section rendering for any caller that passes nothing; the master-page
 * registry holds the same four types as its defaults.
 */
const FALLBACK: CommunityType[] = [
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
    imageLabel: "waterfront promenade · canal",
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
    imageLabel: "gated villa community · aerial",
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
    imageLabel: "luxury residence · beachfront",
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
    imageLabel: "family townhouses · park",
  },
];

/** "Waterfront Communities" → "waterfront", for the derived chip/CTA copy. */
function firstWord(name: string): string {
  return (name.split(" ")[0] ?? "").toLowerCase();
}

export function CommunityTypes({
  eyebrow = "Community types",
  heading = "Find the setting that fits your life.",
  sub = "Every community has a character. Filter by the way you want to live.",
  items,
}: {
  eyebrow?: string | null;
  heading?: string | null;
  sub?: string | null;
  items?: CommunityType[];
} = {}) {
  const types = (items && items.length > 0 ? items : FALLBACK).filter(
    (t) => t.enabled !== false,
  );
  if (types.length === 0) return null;

  return (
    <section className="border-t border-bz-border bg-bz-surface-2 px-4 py-14 md:px-12 md:py-20">
      <SectionHead
        eyebrow={eyebrow ?? undefined}
        title={heading ?? ""}
        sub={sub ?? undefined}
        size={40}
        className="mb-4"
      />
      {types.map((t, i) => {
        const name = t.name ?? "";
        const chips = t.chips ?? [];
        return (
          <div
            key={`${name || "type"}-${i}`}
            className="grid grid-cols-1 items-center gap-8 border-t border-bz-border py-10 lg:grid-cols-2 lg:gap-14 md:py-12"
          >
            <div className={i % 2 ? "lg:order-2" : ""}>
              <div className="relative w-full" style={{ aspectRatio: "16/11" }}>
                {t.imageUrl ? (
                  <Image
                    src={t.imageUrl}
                    alt={t.imageAlt ?? name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="absolute inset-0 h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <PlaceholderImage
                    label={t.imageLabel ?? name}
                    className="absolute inset-0 h-full w-full rounded-xl"
                  />
                )}
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
                {name}
              </div>
              {t.tagline ? (
                <p className="mt-3.5 max-w-[520px] text-[15px] leading-relaxed text-bz-ink-2 md:text-[16px]">
                  {t.tagline}
                </p>
              ) : null}
              {t.about ? (
                <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-bz-muted">
                  {t.about}
                </p>
              ) : null}
              {chips.length > 0 ? (
                <>
                  <div className="eyebrow mt-6">
                    {t.chipsLabel ?? `Popular ${firstWord(name)} communities`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-bz-border bg-bz-surface px-3 py-1.5 text-[12.5px]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              <Button
                asChild
                className="mt-6 bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
              >
                <Link href={t.ctaHref ?? "/areas"}>
                  {t.ctaLabel ?? `Explore ${firstWord(name)} communities`}
                  <ArrowRight size={15} strokeWidth={1.7} />
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

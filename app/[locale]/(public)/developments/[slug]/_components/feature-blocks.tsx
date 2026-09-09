import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { NamedFeatureBlock } from "@/lib/queries/development-extras";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { FeatureRow } from "./feature-row";

type Props = {
  locale: Locale;
  developmentName: string;
  developmentSlug: string;
  blocks: NamedFeatureBlock[] | null | undefined;
  /** Fallback amenities to synthesise blocks from if `blocks` is empty. */
  amenitiesFallback?: string[];
  /** Sub-page overrides. Blank keeps the built-in copy. */
  eyebrow?: string | null;
  heading?: string | null;
  intro?: string | null;
};

/**
 * Named amenity narrative blocks. Each amenity gets its own image + 1-2
 * sentences of editorial copy. Alternates image-left / image-right for
 * visual rhythm.
 *
 * Source of truth: `development.meta.feature_blocks: NamedFeatureBlock[]`.
 * When the CMS-side picker lands, staff curate these per development. Until
 * then we synthesise gentle defaults from `development.amenities[]` so every
 * detail page has the section.
 */
export async function FeatureBlocks({
  locale,
  developmentName,
  developmentSlug,
  blocks,
  amenitiesFallback,
  eyebrow,
  heading,
  intro,
}: Props) {
  // Explicit locale, never ambient: an ambient `getTranslations` resolves
  // through `headers()` and would take this route off prerendering.
  const t = await getTranslations({ locale, namespace: "development" });
  const items = blocks?.length
    ? blocks
    : synthFromAmenities(
        developmentName,
        amenitiesFallback,
        locale,
        (feature, name) => t("features.synthCopy", { feature, name }),
      );
  if (!items.length) return null;

  return (
    <section className="px-4 md:px-12 py-16 scroll-mt-16 border-t border-bz-border">
      <Eyebrow>{eyebrow ?? `Within ${developmentName}`}</Eyebrow>
      <h2
        className="serif text-[36px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {heading ?? "Named features"}
      </h2>
      {/* The section has never carried a standfirst, so it only appears once
          someone writes one — a blank field leaves the markup as it was. */}
      {intro ? (
        <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          {intro}
        </p>
      ) : null}
      <div className="mt-12 flex flex-col gap-16">
        {items.map((b, i) => (
          <FeatureRow
            key={b.key}
            block={b}
            reverse={i % 2 === 1}
            slug={developmentSlug}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * T3-D: the row component now lives in its own client file (`feature-row.tsx`)
 * so it can hold the IntersectionObserver-driven reveal logic. This server
 * file stays a thin wrapper around the section heading + iteration.
 */

/**
 * Generate narrative-block stubs from the flat `amenities[]` array. Keeps the
 * section visible without curated copy — staff can replace via the meta
 * blob once the admin picker ships.
 */
function synthFromAmenities(
  developmentName: string,
  amenities: string[] | undefined,
  locale: Locale,
  copyFor: (feature: string, name: string) => string,
): NamedFeatureBlock[] {
  if (!amenities?.length) return [];
  return amenities.slice(0, 3).map((a) => {
    /*
     * `amenities[]` stores the English word — that is the contract, and the
     * amenity taxonomy is the only place its Arabic lives (see
     * `/admin/settings/property-fields`). So the title folds through the
     * store, which is where the taxonomy's Arabic and the generated draft
     * both land, and the sentence around it comes from the catalogue rather
     * than from a template literal that only existed in English.
     */
    const english = capitalise(a);
    const title =
      locale === DEFAULT_LOCALE ? english : (arabicFor(english) ?? english);
    return {
      key: a.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title,
      copy: copyFor(title, developmentName),
    };
  });
}

function capitalise(s: string): string {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

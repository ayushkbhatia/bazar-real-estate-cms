import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import type { NamedFeatureBlock } from "@/lib/queries/development-extras";

type Props = {
  developmentName: string;
  developmentSlug: string;
  blocks: NamedFeatureBlock[] | null | undefined;
  /** Fallback amenities to synthesise blocks from if `blocks` is empty. */
  amenitiesFallback?: string[];
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
export function FeatureBlocks({
  developmentName,
  developmentSlug,
  blocks,
  amenitiesFallback,
}: Props) {
  const items = blocks?.length
    ? blocks
    : synthFromAmenities(developmentName, amenitiesFallback);
  if (!items.length) return null;

  return (
    <section className="px-12 py-16 scroll-mt-16 border-t border-bz-border">
      <Eyebrow>Within {developmentName}</Eyebrow>
      <h2
        className="serif text-[36px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        Named features
      </h2>
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

function FeatureRow({
  block,
  reverse,
  slug,
}: {
  block: NamedFeatureBlock;
  reverse: boolean;
  slug: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-center ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}
    >
      <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
        <PlaceholderImage
          label={`${slug}-${block.key}`}
          className="absolute inset-0 w-full h-full"
        />
      </div>
      <div>
        <div className="eyebrow">{block.key.replace(/[-_]/g, " ")}</div>
        <h3
          className="serif text-[32px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          {block.title}
        </h3>
        <p className="mt-4 text-[15.5px] text-bz-ink-2 leading-[1.7] max-w-[52ch]">
          {block.copy}
        </p>
      </div>
    </div>
  );
}

/**
 * Generate narrative-block stubs from the flat `amenities[]` array. Keeps the
 * section visible without curated copy — staff can replace via the meta
 * blob once the admin picker ships.
 */
function synthFromAmenities(
  developmentName: string,
  amenities: string[] | undefined,
): NamedFeatureBlock[] {
  if (!amenities?.length) return [];
  return amenities.slice(0, 3).map((a) => ({
    key: a.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: capitalise(a),
    copy: `${capitalise(a)} at ${developmentName}. Specification, finish, and access details will surface here as the developer releases sales collateral.`,
  }));
}

function capitalise(s: string): string {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

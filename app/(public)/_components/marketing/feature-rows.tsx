import { SectionHead } from "./section-head";
import { FeatureRow } from "../../developments/[slug]/_components/feature-row";
import type { NamedFeatureBlock } from "@/lib/queries/development-extras";

export type FeatureRowItem = {
  kicker: string;
  title: string;
  copy: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

type Props = {
  eyebrow?: string | null;
  heading?: string | null;
  intro?: string | null;
  items: FeatureRowItem[];
};

/**
 * Alternating image-and-copy rows with a scroll reveal.
 *
 * A thin wrapper over the project pages' `FeatureRow`, not a copy of it — the
 * row itself (the stagger ladder, the `prefers-reduced-motion` handling, the
 * 4:3 media box) stays in one place, so the two surfaces cannot drift apart.
 *
 * `FeatureBlocks` — the project pages' own wrapper — was deliberately left
 * alone: it hard-requires a development name and slug and synthesises rows from
 * the project's amenity list, none of which a campaign page has.
 */
export function FeatureRows({ eyebrow, heading, intro, items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      {heading || eyebrow ? (
        <SectionHead
          eyebrow={eyebrow ?? undefined}
          title={heading ?? undefined}
          sub={intro ?? undefined}
          className="mb-10 md:mb-14"
        />
      ) : null}
      <div className="flex flex-col gap-14 md:gap-20 [&>*]:min-w-0">
        {items.map((item, i) => {
          const block: NamedFeatureBlock = {
            key: item.kicker || `row-${i + 1}`,
            title: item.title,
            copy: item.copy,
            image_url: item.imageUrl ?? null,
            alt: item.imageAlt ?? null,
          };
          return (
            <FeatureRow
              key={`${item.title}-${i}`}
              block={block}
              reverse={i % 2 === 1}
              // Only ever used as the placeholder-art caption when no photo is
              // picked, so a generic label is honest here.
              slug="feature"
            />
          );
        })}
      </div>
    </section>
  );
}

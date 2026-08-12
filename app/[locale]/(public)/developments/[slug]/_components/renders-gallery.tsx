import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";

export type RenderTile = {
  url: string;
  alt: string | null;
  caption: string | null;
};

export type RenderColumn = {
  key: "interior" | "exterior";
  heading: string;
  tiles: RenderTile[];
};

/**
 * Renders & inspiration — one section, two halves: interiors on the left,
 * exteriors on the right.
 *
 * A half with no imagery is dropped rather than padded with placeholder art,
 * and the surviving half spans the full width. That matters right now because
 * every project in the catalogue has exterior renders and none has interiors:
 * the split has to read as finished, not as a page with a hole in it, until the
 * interior shots land.
 */
export function RendersGallery({
  eyebrow,
  heading,
  intro,
  interiorHeading,
  exteriorHeading,
  interior,
  exterior,
}: {
  eyebrow: string | null;
  heading: string | null;
  intro: string | null;
  interiorHeading: string | null;
  exteriorHeading: string | null;
  interior: RenderTile[];
  exterior: RenderTile[];
}) {
  const columns: RenderColumn[] = [
    {
      key: "interior",
      heading: interiorHeading ?? "Interior",
      tiles: interior,
    },
    {
      key: "exterior",
      heading: exteriorHeading ?? "Exterior",
      tiles: exterior,
    },
  ].filter((c): c is RenderColumn => c.tiles.length > 0);

  if (columns.length === 0) return null;
  const split = columns.length > 1;

  return (
    <div className="px-4 md:px-12 pb-16">
      <Eyebrow>{eyebrow ?? "The vision"}</Eyebrow>
      <h2 className="serif text-[36px] mt-2" style={{ letterSpacing: "-0.02em" }}>
        {heading ?? "Renders & inspiration"}
      </h2>
      {intro ? (
        <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          {intro}
        </p>
      ) : null}
      <div
        className={cn(
          "grid mt-6 gap-x-6 gap-y-10",
          // `[&>*]:min-w-0` because a grid item defaults to min-width:auto and a
          // wide image would otherwise push the column past its track.
          split && "md:grid-cols-2 [&>*]:min-w-0",
        )}
      >
        {columns.map((column) => (
          <section key={column.key} aria-labelledby={`renders-${column.key}`}>
            <h3
              id={`renders-${column.key}`}
              className="eyebrow pb-2 border-b border-bz-border"
            >
              {column.heading}
            </h3>
            {/* Two tracks inside a half, four across the whole width. Without
                the second case a lone column stretches every tile to page
                width and the section runs to several thousand pixels. */}
            <div
              className={cn(
                "grid gap-3 mt-3 grid-cols-2",
                !split && "md:grid-cols-4",
              )}
            >
              {column.tiles.map((tile, i) => {
                // The first tile leads the column. In a two-track mosaic the
                // last one widens too when the rest would otherwise leave a
                // lone square hanging; four tracks absorb the remainder.
                const lead = i === 0;
                const closer =
                  split &&
                  i === column.tiles.length - 1 &&
                  column.tiles.length % 2 === 0;
                const wide = lead || closer;
                return (
                  <figure
                    key={`${tile.url}-${i}`}
                    className={cn(
                      "min-w-0",
                      wide && "col-span-2",
                      // Full width: the lead tile is a 2×2 block with squares
                      // packed beside it, which is the mosaic this section has
                      // always drawn.
                      lead && !split && "md:row-span-2",
                    )}
                  >
                    <div
                      className={cn(
                        "relative rounded-lg overflow-hidden bg-bz-surface-2",
                        wide ? "aspect-[16/9]" : "aspect-square",
                        lead && !split && "md:aspect-square",
                      )}
                    >
                      <Image
                        src={tile.url}
                        alt={tile.alt ?? ""}
                        fill
                        sizes={sizesFor(wide)}
                        className="object-cover"
                      />
                    </div>
                    {tile.caption ? (
                      <figcaption className="mt-2 text-[11.5px] text-bz-ink-2 leading-snug">
                        {tile.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The same for both layouts, and not a coincidence: a wide tile is two of the
 * half's two tracks or two of the full width's four, which is ~46vw either way.
 * Below `md` the halves stack and each mosaic keeps its two tracks.
 */
function sizesFor(wide: boolean): string {
  return wide
    ? "(min-width: 768px) 46vw, 92vw"
    : "(min-width: 768px) 23vw, 46vw";
}

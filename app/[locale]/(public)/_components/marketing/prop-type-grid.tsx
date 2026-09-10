import Image from "next/image";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

export type PropType = {
  name: string;
  desc: string;
  cta?: string;
  /** Caption for the placeholder art, used when no asset is picked. */
  img?: string;
  href?: string;
  /** Resolved URL of the asset chosen in the master-page editor. */
  imgUrl?: string | null;
  imgAlt?: string | null;
};

type Props = {
  items: PropType[];
  /** Desktop column count (3 or 5 in the handoff). */
  cols?: 3 | 4 | 5;
  /** Media aspect ratio, e.g. "4/3" or "3/4". */
  aspect?: string;
  /**
   * Cards per row below `sm`. One by default, which is what every surface
   * using this grid has always drawn.
   *
   * Two turns the band into the matrix /areas lays its community cards out
   * as — a block you take in at a glance rather than a column you scroll
   * through. On /off-plan the five property-type cards were 629px each with
   * their 3/4 portrait art, 3,432px of a 390px phone to say five words. It is
   * opt-in rather than the new default because it also tightens the card's
   * type and padding to fit a ~175px column, and that is a decision per
   * surface: /buy, /rent and the two service pages keep their full-width
   * cards.
   */
  mobileCols?: 1 | 2;
};

const colClass: Record<NonNullable<Props["cols"]>, string> = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
};

/**
 * What `sizes` tells the browser has to match the slot the card actually
 * occupies, because that is what picks the entry out of `srcset`.
 *
 * It used to be a fixed string ending in `20vw` — right for the five-column
 * grid on /off-plan, and wrong everywhere else. At three columns a card is a
 * third of the row, so /buy and /rent asked for an image sized for a 20vw slot
 * and then stretched it across a 33vw one: the same upload looked sharp on
 * /off-plan and soft on the other two.
 *
 * Deriving it from `cols` and rounding up keeps us on the generous side —
 * these grids sit in a full-bleed container (`wide`), so the real card is
 * `(100vw - padding - gaps) / cols`, always a little under this figure. The
 * cost of being generous is a few KB; the cost of being short is a blurry
 * card.
 */
function sizesFor(
  cols: NonNullable<Props["cols"]>,
  mobileCols: NonNullable<Props["mobileCols"]>,
): string {
  return `(max-width: 640px) ${Math.ceil(100 / mobileCols)}vw, (max-width: 1024px) 50vw, ${Math.ceil(
    100 / cols,
  )}vw`;
}

/**
 * Property-type cards (image + name + description + CTA). Responsive grid
 * (the handoff's `PropTypeGrid`).
 */
export function PropTypeGrid({
  items,
  cols = 3,
  aspect = "4/3",
  mobileCols = 1,
}: Props) {
  const sizes = sizesFor(cols, mobileCols);
  const dense = mobileCols === 2;
  return (
    <div
      className={cn(
        "grid gap-5 md:gap-6",
        dense ? "grid-cols-2 gap-3" : "grid-cols-1",
        colClass[cols],
      )}
    >
      {items.map((p) => {
        const body = (
          <article className="flex flex-col h-full rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
            <div className="relative w-full" style={{ aspectRatio: aspect }}>
              {p.imgUrl ? (
                <Image
                  src={p.imgUrl}
                  alt={p.imgAlt ?? p.name}
                  fill
                  sizes={sizes}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <PlaceholderImage
                  label={p.img ?? p.name.toLowerCase()}
                  className="absolute inset-0 h-full w-full"
                />
              )}
            </div>
            <div className={cn("flex flex-col flex-1 p-5", dense && "p-3.5 md:p-5")}>
              <div
                className={cn(
                  "serif text-[20px] md:text-[24px]",
                  dense && "text-[17px] leading-tight md:text-[24px]",
                )}
                style={{ letterSpacing: "-0.01em" }}
              >
                {p.name}
              </div>
              {/* Clamped rather than dropped in the dense layout: the sentence
                  still introduces the card, but a ~175px column would give it
                  six lines and undo the two-up. Full text from `md`. */}
              <p
                className={cn(
                  "text-[13px] text-bz-ink-2 leading-[1.5] mt-2 flex-1",
                  dense &&
                    "line-clamp-3 text-[12.5px] leading-[1.45] mt-1.5 md:line-clamp-none md:text-[13px] md:leading-[1.5] md:mt-2",
                )}
              >
                {p.desc}
              </p>
              {p.cta ? (
                <div
                  className={cn(
                    "flex items-center gap-2 mt-4 text-[13px] font-medium text-bz-accent",
                    dense && "gap-1.5 mt-3 text-[12px] md:gap-2 md:mt-4 md:text-[13px]",
                  )}
                >
                  {p.cta}
                  <ArrowRight size={14} strokeWidth={1.8} />
                </div>
              ) : null}
            </div>
          </article>
        );
        return p.href ? (
          <Link key={p.name} href={p.href} className="group block">
            {body}
          </Link>
        ) : (
          <div key={p.name}>{body}</div>
        );
      })}
    </div>
  );
}

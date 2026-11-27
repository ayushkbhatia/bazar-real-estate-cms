import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getAreaCardRecords } from "@/lib/queries/area-cards";
import { Tile } from "./location-browsing";
import {
  expertiseGrid,
  resolveExpertiseTiles,
  wantsCounts,
  type ExpertiseCardInput,
} from "./expertise-cards";

/**
 * "Local Expertise" — the communities Bazar knows best, on the home page and on
 * /areas (`lib/master-pages/sections/expertise.ts`).
 *
 * The same tile and header as "Location-based browsing" just above it on the
 * home page, so the two read as one family. The difference is the large tile:
 * there it is an Abu Dhabi overview that a phone drops; here it is the first
 * area, so it stays in the phone's rail with the rest.
 *
 * Desktop: the first card large on the left, the others in a grid beside it
 * (`expertiseGrid`). Mobile: one horizontal snap rail, as above.
 */
export async function ExpertiseAreas({
  eyebrow,
  heading,
  body,
  ctaLabel,
  ctaHref,
  cards,
}: {
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  cards: ExpertiseCardInput[];
}) {
  const t = await getTranslations("area");
  const records = await getAreaCardRecords(
    cards.flatMap((c) => (c.enabled !== false && c.slug ? [c.slug] : [])),
    { withCounts: wantsCounts(cards) },
  );
  const tiles = resolveExpertiseTiles(cards, records, t("cards.exploreHomes"));
  if (tiles.length === 0) return null;

  const grid = expertiseGrid(tiles.length);
  const gridVars = {
    "--expertise-cols": grid.columns,
    "--expertise-rows": grid.rows,
  } as CSSProperties;

  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="mb-8 flex flex-col gap-5 md:mb-11 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          {heading ? (
            <h2 className="serif mt-2 text-[28px] md:text-[44px] font-normal leading-[1.05] tracking-tight">
              {heading}
            </h2>
          ) : null}
          {body ? (
            <p className="mt-4 max-w-[52ch] text-[14.5px] md:text-[15.5px] text-bz-ink-2 leading-relaxed">
              {body}
            </p>
          ) : null}
        </div>
        {ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1.5 self-start text-[13.5px] text-bz-ink-2 hover:text-bz-accent transition-colors"
          >
            {ctaLabel} <ArrowRight size={14} strokeWidth={1.7} />
          </Link>
        ) : null}
      </div>

      <div
        style={gridVars}
        className={[
          // Phone: the snap rail "Location-based browsing" uses — see the
          // notes on `scroll-px-4` there.
          "flex gap-4 overflow-x-auto -mx-4 px-4 snap-x snap-mandatory scroll-px-4",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[&>*]:shrink-0 [&>*]:snap-start [&>*]:w-[68%]",
          // Desktop: one grid, the first tile spanning every row.
          "md:mx-0 md:px-0 md:scroll-px-0 md:grid md:h-[520px] md:overflow-visible md:snap-none",
          "md:[grid-template-columns:var(--expertise-cols)] md:[grid-template-rows:var(--expertise-rows)]",
          "md:[&>*]:w-auto",
        ].join(" ")}
      >
        {tiles.map((tile, i) => (
          <Tile
            key={tile.key}
            href={tile.href}
            name={tile.name}
            countLabel={tile.countLabel}
            imgLabel={tile.imgLabel}
            imgUrl={tile.imgUrl}
            imgAlt={tile.imgAlt}
            big={i === 0}
            className={
              i === 0
                ? "h-[220px] md:h-full md:[grid-row:1/-1]"
                : "h-[220px] md:h-auto"
            }
            sizes={
              i === 0
                ? "(max-width: 768px) 68vw, 40vw"
                : "(max-width: 768px) 68vw, 22vw"
            }
          />
        ))}
      </div>
    </section>
  );
}

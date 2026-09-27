import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import {
  developmentUrl,
  type listPublishedDevelopments,
} from "@/lib/queries/developments";
import { handoverQuarter, quarterArgs } from "@/lib/developments/handover";
import { PriceText } from "../area-text";
import { getCardLabelResolver } from "@/lib/queries/card-labels";
import type { ResolvedCardLabel } from "@/lib/card-labels";
import { cn } from "@/lib/utils";

/**
 * The same five chip styles `components/brand/listing-card.tsx` draws, so a
 * label looks the same over a development render as it does over a property
 * photograph. Duplicated rather than exported from the card, because the card
 * is a shared brand component and this is a page-level composition — importing
 * a style map across that line is the kind of coupling that makes the shared
 * component harder to change later.
 */
const DEV_LABEL_STYLES: Record<ResolvedCardLabel["kind"], string> = {
  ink: "bg-bz-navy text-bz-bg",
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

type Development = Awaited<
  ReturnType<typeof listPublishedDevelopments>
>[number];

/**
 * How many of these cards share a row on a phone.
 *
 * One — the default — is every surface that shipped with the card: the map
 * rail, the launches band, the area and developer pages. The card is ~300px
 * or wider there at every breakpoint, so it is laid out once.
 *
 * Two is the /off-plan/launches grid, where a 390px phone leaves each card
 * ~170px. That is too narrow for three facts side by side — ~40px tracks,
 * which `narrowTracks` in e2e/mobile-geometry.spec.ts fails at anything under
 * 60 — and for a 26px name. So below `sm` that card compacts: a square render,
 * one line of chips, a smaller name, and the price and handover as a two-row
 * list, with bedrooms left to the project page. From `sm` up it is the default
 * card again, so the desktop grid matches the rail it was opened from.
 */
export type PhoneColumns = 1 | 2;

type Layout = {
  link: string;
  media: string;
  chips: string;
  chip: string;
  body: string;
  developer: string;
  name: string;
  area: string;
  facts: string;
  /** Unset on the default card, which has always rendered a bare `<div>`. */
  fact?: string;
  factLabel: string;
  factValue: string;
};

/*
 * Every difference between the two densities, in one place. The one-up entry
 * is the card's original classes verbatim — adding the two-up variant changed
 * nothing about it — and the two-up entry is the same card with its phone
 * values first and its original values restored from `sm`.
 */
const LAYOUT: Record<PhoneColumns, Layout> = {
  1: {
    link: "group block rounded-xl overflow-hidden border border-bz-border bg-bz-surface hover:border-bz-ink-2 transition-colors",
    media: "relative aspect-[16/11] overflow-hidden",
    chips:
      "absolute top-3.5 start-3.5 z-10 flex max-w-[calc(100%-4rem)] flex-wrap items-start gap-1.5",
    chip: "inline-flex items-center h-[24px] px-2.5 rounded-full text-[11px] font-medium",
    body: "p-6",
    developer: "eyebrow flex items-center gap-2",
    name: "serif text-[26px] mt-1.5 leading-tight",
    area: "text-[13px] text-bz-muted mt-1",
    facts: "mt-5 pt-4 border-t border-bz-border grid grid-cols-3 gap-3",
    factLabel: "text-[10.5px] uppercase tracking-wide text-bz-muted",
    factValue: "mono text-[13px] mt-1",
  },
  2: {
    // A flex column filling its grid cell, so `mt-auto` below can pin the
    // facts to the bottom and they line up across a row of cards whatever
    // length each name runs to.
    link: "group flex h-full flex-col rounded-xl overflow-hidden border border-bz-border bg-bz-surface hover:border-bz-ink-2 transition-colors",
    media: "relative aspect-square shrink-0 overflow-hidden sm:aspect-[16/11]",
    chips:
      "absolute top-2 start-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1 sm:top-3.5 sm:start-3.5 sm:max-w-[calc(100%-4rem)] sm:gap-1.5",
    chip: "inline-flex max-w-full items-center h-5 px-2 rounded-full text-[10px] font-medium sm:h-[24px] sm:px-2.5 sm:text-[11px]",
    body: "flex flex-1 flex-col p-3 sm:p-6",
    /*
     * `line-clamp`, never `truncate`. Both give one line and an ellipsis, but
     * `truncate` does it with `white-space: nowrap`, so the element's
     * scrollWidth runs past its box — and the geometry gate reports exactly
     * that, under an `overflow: hidden` ancestor, as clipped content. A clamp
     * wraps first and hides the extra LINES, which is what a reader sees
     * anyway.
     */
    developer: "eyebrow line-clamp-1 max-sm:text-[10px]",
    name: "serif line-clamp-2 text-[17px] mt-1 leading-[1.2] sm:text-[26px] sm:mt-1.5 sm:leading-tight",
    area: "line-clamp-1 text-[12px] text-bz-muted mt-0.5 sm:text-[13px] sm:mt-1",
    facts:
      "pt-3 border-t border-bz-border grid grid-cols-1 gap-1.5 sm:pt-4 sm:grid-cols-3 sm:gap-3",
    // A label/value row on a phone; the stacked column the default card
    // draws from `sm`. `flex-wrap` rather than a clamp, so a long Arabic
    // quarter name drops under its label instead of being cut off.
    fact: "flex flex-wrap items-baseline justify-between gap-x-2 sm:block",
    factLabel: "text-[10px] uppercase tracking-wide text-bz-muted sm:text-[10.5px]",
    factValue: "mono text-[12px] sm:mt-1 sm:text-[13px]",
  },
};

/** The two chips a compact card keeps: label or tagline, whichever lead. */
const COMPACT_CHIP_LIMIT = 2;

/**
 * Featured off-plan development card for the New Projects master page. Mirrors
 * the card on /developments so the two surfaces stay visually consistent.
 */
export async function DevelopmentCard({
  d,
  phoneColumns = 1,
  sizes = "(max-width: 1024px) 100vw, 33vw",
  eager = false,
}: {
  d: Development;
  /** See `PhoneColumns`. */
  phoneColumns?: PhoneColumns;
  /**
   * The render's `sizes` hint. The default suits a rail or a three-up grid; a
   * page laying the card out any other way should state its own track widths.
   */
  sizes?: string;
  /** Above the fold: load the render at once rather than lazily. */
  eager?: boolean;
}) {
  const tc = await getTranslations("development.card");
  const resolve = await getCardLabelResolver();
  const cardLabels = resolve({ labels: d.card_labels });
  const handover = handoverQuarter(d.handover_date);
  const twoUp = phoneColumns === 2;
  const s = LAYOUT[phoneColumns];
  const chips = [
    ...cardLabels.map((l) => ({
      key: l.id,
      text: l.label,
      tone: DEV_LABEL_STYLES[l.kind],
    })),
    ...(d.tagline
      ? [{ key: "__tagline", text: d.tagline, tone: "bg-bz-navy text-bz-bg" }]
      : []),
  ];
  const facts = (
    <div className={s.facts}>
      {(
        [
          ["from", tc("from"), <PriceText key="from" aed={d.starting_price} />],
          ["bedrooms", tc("bedrooms"), d.bedrooms_text ?? "—"],
          [
            "handover",
            tc("handoverLabel"),
            handover ? tc("quarter", quarterArgs(handover)) : "—",
          ],
        ] as [string, string, React.ReactNode][]
      ).map(([id, label, value]) => (
        <div
          key={label}
          className={
            twoUp && id === "bedrooms" ? cn(s.fact, "max-sm:hidden") : s.fact
          }
        >
          <div className={s.factLabel}>{label}</div>
          <div className={s.factValue}>{value}</div>
        </div>
      ))}
    </div>
  );
  return (
    <Link href={developmentUrl(d)} className={s.link}>
      <div className={s.media}>
        {d.hero ? (
          <Image
            src={mediaPublicUrl(d.hero.storage_key)}
            alt={d.hero.alt_text ?? d.name}
            fill
            sizes={sizes}
            loading={eager ? "eager" : undefined}
            fetchPriority={eager ? "high" : undefined}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <PlaceholderImage
            label={`${d.slug} · render`}
            dark
            className="absolute inset-0"
          />
        )}
        {/*
          Card labels, then the tagline.

          Both, not one or the other: the tagline is this development's own
          sentence and a label is the client's vocabulary applied to it, so a
          project can be "Launching Q4" AND carry "New launch". They share one
          wrapping row so a long tagline pushes the chips down rather than
          under the card's other corner.
        */}
        {chips.length ? (
          <div className={s.chips}>
            {chips.map((chip, i) => (
              <span
                key={chip.key}
                className={cn(
                  s.chip,
                  chip.tone,
                  twoUp && i >= COMPACT_CHIP_LIMIT && "max-sm:hidden",
                )}
              >
                {twoUp ? (
                  <span className="line-clamp-1">{chip.text}</span>
                ) : (
                  chip.text
                )}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={s.body}>
        <div className={s.developer}>
          {d.developer ? <span>{d.developer.name}</span> : null}
        </div>
        <h3 className={s.name} style={{ letterSpacing: "-0.015em" }}>
          {d.name}
        </h3>
        {d.area ? <div className={s.area}>{d.area.name}</div> : null}
        {/* Pinned to the bottom of a two-up card; see `LAYOUT[2].link`. */}
        {twoUp ? <div className="mt-auto pt-3 sm:pt-5">{facts}</div> : facts}
      </div>
    </Link>
  );
}

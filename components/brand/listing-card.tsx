import { useTranslations } from "next-intl";
import Image from "next/image";
import { BedDouble, Bath, Maximize2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceholderImage } from "./placeholder-image";
import { CompareButton } from "./compare-button";

export type ListingCardVariant = "default" | "editorial" | "row";

/** Sprint 4b: corner diff badges surfaced from saved-search + recently-viewed
 * diffs. Sprint 9 will populate via real `last_alert_at` deltas. */
export type ListingCardDiff = {
  kind: "price-drop" | "just-listed" | "saved";
  label: string;
};

export type ListingCardProps = {
  price: string;
  title: string;
  location: string;
  beds: number | string;
  baths: number | string;
  area: number | string;
  /**
   * Unit glyph rendered after `area`. Defaults to "ft²" — the schema unit —
   * so every existing call site is unchanged. Client wrappers
   * (`ListingCardPriced`, `SimilarCard`) pass "m²" along with a converted
   * `area` when the visitor has picked metric.
   */
  areaUnit?: string;
  /**
   * The chips drawn over the top-start corner of the media.
   *
   * A LIST since the card-label vocabulary moved into the CMS: a listing can
   * be both exclusive and vacant on transfer, and before this it showed only
   * whichever the resolver happened to check first. The container was already
   * `flex gap-1.5` — it was drawn for this and had never been given more than
   * one thing to hold.
   *
   * `badge` / `badgeKind` remain as the single-chip shorthand. They are not
   * deprecated: plenty of surfaces have exactly one word to say and a two-prop
   * call is clearer there than a one-element array. When both are given,
   * `badges` wins and the shorthand is ignored, which `listing-card.test.tsx`
   * pins.
   */
  badges?: ListingCardBadge[];
  badge?: string;
  badgeKind?: ListingCardBadgeKind;
  imgLabel?: string;
  mediaDark?: boolean;
  /** Public URL of the hero image. If set, replaces the striped placeholder. */
  heroSrc?: string | null;
  /** Alt text for the hero image (filename, alt_text, or human label). */
  heroAlt?: string;
  /** Identifies the listing for the shortlist/compare set. Passing this is
   *  all a surface needs to do — the shortlist button renders itself. */
  propertyId?: string;
  /** Sprint 4b: surfaces a Bazar-Verified badge in the bottom-left of media. */
  verified?: boolean;
  /**
   * Shortlist ("Save to shortlist") button on the media. Defaults to **on**
   * wherever `propertyId` is set, so every listing surface — existing or
   * added later — carries it without opting in. Pass `false` only for a
   * surface where saving makes no sense (e.g. the compare table's own
   * cards, which already have their own remove control).
   */
  shortlistEnabled?: boolean;
  /** Sprint 4b: top-right corner status pill — price-drop, just-listed, etc. */
  diff?: ListingCardDiff;
  /** Hint Next/Image to preload this hero — pass true for the first card
   *  on a search results / featured row to improve LCP. */
  priority?: boolean;
  variant?: ListingCardVariant;
  href?: string;
  className?: string;
};

/**
 * `sizes` per variant. This is paid in bytes, not pixels: the browser picks a
 * srcset candidate from this string long before it knows how the card laid
 * out, so a wrong number is downloaded in full and then scaled away.
 *
 * ROW was the wrong one, and it is the expensive one — list is the DEFAULT
 * view on a phone and pages 24 cards. Its media column is 116px below `sm`
 * and 200px below `md` (`ROW_CARD_RESPONSIVE` in search-list.tsx, the only
 * surface that renders this variant; the 280px below is the component's own
 * desktop column). All three shared the string kept on `default` — so a
 * 116px slot asked for `100vw`, i.e. 390 CSS px, ~11x the pixel area, before
 * DPR multiplies both sides of that.
 *
 * Written as min-width/px rather than max-width/vw for two reasons. The
 * min-widths line up exactly with the Tailwind breakpoints that set the
 * column, so the two cannot drift apart by a fractional pixel. And Next
 * trims its srcset to `>= deviceSizes[0] * smallest-vw-in-the-string`
 * (next/dist/shared/lib/get-img-props.js:59) — the `33vw` below floors the
 * ladder at 256px, while a string with no `vw` in it at all keeps the whole
 * ladder, including the 128/256/384 entries a 116px slot wants.
 *
 * DEFAULT and EDITORIAL keep the old string on purpose. Their slot is set by
 * whichever grid the call site drops the card into — 1-up on phones, 2-up
 * beside the search map, 3-up on the curated grid, 4-up in a featured row —
 * which is nothing this file can measure. `100vw` on a phone over-asks by the
 * container gutter (~32px of 390) and no more.
 */
export type ListingCardBadgeKind =
  "ink" | "accent" | "success" | "warn" | "danger";

export type ListingCardBadge = { label: string; kind: ListingCardBadgeKind };

/**
 * Fold the two prop shapes into the one the renderer draws.
 *
 * One place, so the media overlay and the row variant's own chip row cannot
 * disagree about precedence — which is the bug this card would otherwise grow
 * the moment someone passed both.
 */
function resolveBadges(
  badges: ListingCardBadge[] | undefined,
  badge: string | undefined,
  badgeKind: ListingCardBadgeKind,
): ListingCardBadge[] {
  if (badges?.length) return badges;
  return badge ? [{ label: badge, kind: badgeKind }] : [];
}

const MEDIA_SIZES: Record<ListingCardVariant, string> = {
  default: "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw",
  editorial: "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw",
  row: "(min-width: 768px) 280px, (min-width: 640px) 200px, 116px",
};

const badgeStyles: Record<ListingCardBadgeKind, string> = {
  ink: "bg-bz-navy text-bz-bg",
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

function Media({
  imgLabel,
  mediaDark,
  badges,
  badge,
  badgeKind = "ink",
  aspect,
  sizes,
  heroSrc,
  heroAlt,
  priority,
  propertyId,
  verified,
  shortlistEnabled = true,
  diff,
}: {
  imgLabel?: string;
  mediaDark?: boolean;
  badges?: ListingCardBadge[];
  badge?: string;
  badgeKind?: ListingCardBadgeKind;
  aspect: "4/3" | "5/4" | "auto";
  /** From `MEDIA_SIZES` — the variant's real slot width, see the note there. */
  sizes: string;
  heroSrc?: string | null;
  heroAlt?: string;
  priority?: boolean;
  propertyId?: string;
  verified?: boolean;
  shortlistEnabled?: boolean;
  diff?: ListingCardDiff;
}) {
  const t = useTranslations("listing");
  const aspectClass = cn(
    "w-full",
    aspect === "4/3" && "aspect-[4/3]",
    aspect === "5/4" && "aspect-[5/4]",
    aspect === "auto" && "aspect-auto h-full",
  );

  const mediaBadges = resolveBadges(badges, badge, badgeKind);

  const overlays = (
    <>
      {/* Top-start: the card's labels, from `site_settings.card_labels`.
          `flex-wrap` and `max-w` because the words are the client's now: two
          long ones would otherwise run under the save button opposite, and the
          row thumbnail is 116px wide. Wrapping is the honest failure — the
          chips stack, nothing is hidden, and whoever typed the label sees why
          it was too long. */}
      {mediaBadges.length ? (
        <div className="absolute top-3 start-3 z-10 flex max-w-[calc(100%-4rem)] flex-wrap gap-1.5">
          {mediaBadges.map((b) => (
            <span
              key={`${b.kind}:${b.label}`}
              className={cn(
                "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-medium",
                badgeStyles[b.kind],
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* Top-right: diff badge above save/compare actions (price drop, etc.) */}
      {diff ? (
        <div className="absolute top-3 end-3 z-20">
          <span
            className={cn(
              "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
              diff.kind === "price-drop"
                ? "bg-bz-accent text-bz-accent-fg"
                : diff.kind === "just-listed"
                  ? "bg-bz-navy text-bz-bg"
                  : "bg-white/92 text-bz-ink",
            )}
          >
            {diff.label}
          </span>
        </div>
      ) : null}

      {/* Right column: shortlist button. Rendered on every card that knows
          its property id — no per-surface opt-in, so a page added later
          inherits it.

          The 6px pull-in on coarse pointers is the other half of the
          shortlist button's touch target: its box goes 32 → 44px there while
          its circle stays 32px (compare-button.tsx), and the growth is
          centred, so moving the anchor from 12px to 6px lands the circle back
          on the same 12px inset the badges use. Without it the circle would
          drift inward on phones and sit lower than the badge opposite it. The
          44px box overhangs into the corner of the photo, which is empty. */}
      {shortlistEnabled && propertyId ? (
        <div
          className={cn(
            "absolute end-3 pointer-coarse:end-1.5 z-10 flex flex-col gap-2",
            diff
              ? "top-[48px] pointer-coarse:top-[42px]"
              : "top-3 pointer-coarse:top-1.5",
          )}
        >
          <CompareButton propertyId={propertyId} />
        </div>
      ) : null}

      {/* Bottom-left: Bazar Verified pill */}
      {verified ? (
        <div className="absolute bottom-3 start-3 z-10">
          <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-medium bg-white/92 text-bz-accent">
            <ShieldCheck size={11} strokeWidth={2.2} />
            {t("verified")}
          </span>
        </div>
      ) : null}
    </>
  );

  if (heroSrc) {
    return (
      <div className={cn("relative overflow-hidden", aspectClass)}>
        <Image
          src={heroSrc}
          alt={heroAlt ?? imgLabel ?? "Property hero"}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
        {overlays}
      </div>
    );
  }

  return (
    <PlaceholderImage
      label={imgLabel ?? "property"}
      dark={mediaDark}
      className={aspectClass}
    >
      {overlays}
    </PlaceholderImage>
  );
}

export function ListingCard({
  price,
  title,
  location,
  beds,
  baths,
  area,
  areaUnit = "ft²",
  badges,
  badge,
  badgeKind = "ink",
  imgLabel,
  mediaDark,
  heroSrc,
  heroAlt,
  propertyId,
  verified,
  shortlistEnabled,
  diff,
  priority,
  variant = "default",
  className,
}: ListingCardProps) {
  // `useTranslations`, not `getTranslations`: three Client Components render
  // this (area-text, listing-card-priced, similar-card), so it cannot be
  // async. The hook form works in both trees.
  const t = useTranslations("listing");
  // The row variant draws its chips in the body rather than over the media, so
  // it folds the two prop shapes for itself. Same helper, so the two rows can
  // never disagree about which shape wins.
  const rowBadges = resolveBadges(badges, badge, badgeKind);

  if (variant === "editorial") {
    return (
      <article className={cn("flex flex-col", className)}>
        <div className="rounded-[4px] overflow-hidden">
          <Media
            imgLabel={imgLabel}
            mediaDark={mediaDark}
            badges={badges}
            badge={badge}
            badgeKind={badgeKind}
            aspect="5/4"
            sizes={MEDIA_SIZES.editorial}
            heroSrc={heroSrc}
            heroAlt={heroAlt}
            priority={priority}
            propertyId={propertyId}
            verified={verified}
            shortlistEnabled={shortlistEnabled}
            diff={diff}
          />
        </div>
        <div className="py-3.5 flex flex-col gap-1.5">
          <div className="eyebrow -mb-0.5">{location}</div>
          <h3 className="serif text-[22px] leading-tight text-bz-ink">
            {title}
          </h3>
          <div className="flex justify-between items-baseline mt-1.5">
            <div className="text-[19px] font-medium tracking-tight text-bz-navy">
              {price}
            </div>
            <div className="flex gap-3 text-[12px] text-bz-muted">
              <span>
                {beds} {t("bedsShort")}
              </span>
              <span>
                {baths} {t("bathsShort")}
              </span>
              <span>
                {area} {areaUnit}
              </span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "row") {
    return (
      <article
        className={cn(
          "flex flex-row bg-bz-surface border border-bz-border rounded-lg overflow-hidden",
          className,
        )}
      >
        <div className="w-[280px] flex-shrink-0">
          {/*
            No labels on the media here, and this is a fix rather than an
            omission: the row variant has always passed `badge` into `Media`
            AND rendered its own chip beside the price, so every row card drew
            the same word twice — once over a thumbnail that is 116px wide on a
            phone. Invisible while there was one badge and one word; with a
            list it would have been four chips. The body chip is the row's
            presentation and it is the one that survives.
          */}
          <Media
            imgLabel={imgLabel}
            mediaDark={mediaDark}
            aspect="auto"
            sizes={MEDIA_SIZES.row}
            heroSrc={heroSrc}
            heroAlt={heroAlt}
            priority={priority}
            propertyId={propertyId}
            verified={verified}
            shortlistEnabled={shortlistEnabled}
            diff={diff}
          />
        </div>
        <div className="flex flex-col gap-2 px-[22px] py-[18px] flex-1">
          {rowBadges.length ? (
            <div className="flex flex-wrap gap-1.5">
              {rowBadges.map((b) => (
                <span
                  key={`${b.kind}:${b.label}`}
                  className={cn(
                    "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                    badgeStyles[b.kind],
                  )}
                >
                  {b.label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="text-[19px] font-medium tracking-tight text-bz-navy">
            {price}
          </div>
          <div className="text-[14px] text-bz-ink-2">{title}</div>
          <div className="text-[12px] text-bz-muted">{location}</div>
          <div className="flex gap-3 mt-2 text-[12px] text-bz-muted">
            <span>{t("bedrooms", { count: beds })}</span>
            <span>{t("bathrooms", { count: baths })}</span>
            <span>
              {area} {areaUnit}
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "flex flex-col bg-bz-surface border border-bz-border rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* `priority` is forwarded here, not dropped. This variant is the one
          that goes one-per-row on a phone, which makes the first card's hero
          the LCP element on every search and landing page — and it was the
          only variant of the three not passing the prop through, so the flag
          the call sites were setting did nothing.

          Safe to forward because no call site hands it to more than the
          first card or two — `index === 0` (curated-grid, area band, home),
          `index < 2` (search grid, developers), `i === 0` (featured row).
          Preloading all 24 would be worse than preloading none. */}
      <Media
        imgLabel={imgLabel}
        mediaDark={mediaDark}
        badges={badges}
        badge={badge}
        badgeKind={badgeKind}
        aspect="4/3"
        sizes={MEDIA_SIZES.default}
        heroSrc={heroSrc}
        heroAlt={heroAlt}
        priority={priority}
        propertyId={propertyId}
        verified={verified}
        shortlistEnabled={shortlistEnabled}
        diff={diff}
      />
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="text-[19px] font-medium tracking-tight text-bz-navy">
          {price}
        </div>
        <div className="text-[14px] text-bz-ink-2">{title}</div>
        <div className="text-[12px] text-bz-muted">{location}</div>
        <div className="flex gap-4 mt-auto pt-3 border-t border-bz-border text-bz-muted text-[12px]">
          <span className="flex items-center gap-1">
            <BedDouble size={14} strokeWidth={1.6} /> {beds}
          </span>
          <span className="flex items-center gap-1">
            <Bath size={14} strokeWidth={1.6} /> {baths}
          </span>
          <span className="flex items-center gap-1">
            <Maximize2 size={14} strokeWidth={1.6} /> {area} {areaUnit}
          </span>
        </div>
      </div>
    </article>
  );
}

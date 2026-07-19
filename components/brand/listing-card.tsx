import Image from "next/image";
import { BedDouble, Bath, Maximize2, Heart, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceholderImage } from "./placeholder-image";
import { SaveButton } from "./save-button";
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
  badge?: string;
  badgeKind?: "ink" | "accent" | "success" | "warn" | "danger";
  imgLabel?: string;
  mediaDark?: boolean;
  /** Public URL of the hero image. If set, replaces the striped placeholder. */
  heroSrc?: string | null;
  /** Alt text for the hero image (filename, alt_text, or human label). */
  heroAlt?: string;
  /** When provided, renders a functional SaveButton instead of a static heart. */
  propertyId?: string;
  /** Whether the current user has saved this property (for SaveButton). */
  initialSaved?: boolean;
  /** Whether the current user is signed in (for SaveButton). */
  isAuthed?: boolean;
  /** Sprint 4b: surfaces a Bazar-Verified badge in the bottom-left of media. */
  verified?: boolean;
  /** Sprint 4b: render an "Add to compare" button next to SaveButton. */
  compareEnabled?: boolean;
  /** Sprint 4b: top-right corner status pill — price-drop, just-listed, etc. */
  diff?: ListingCardDiff;
  /** Hint Next/Image to preload this hero — pass true for the first card
   *  on a search results / featured row to improve LCP. */
  priority?: boolean;
  variant?: ListingCardVariant;
  href?: string;
  className?: string;
};

const badgeStyles: Record<NonNullable<ListingCardProps["badgeKind"]>, string> = {
  ink: "bg-bz-navy text-bz-bg",
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

function Media({
  imgLabel,
  mediaDark,
  badge,
  badgeKind = "ink",
  aspect,
  heroSrc,
  heroAlt,
  priority,
  propertyId,
  initialSaved,
  isAuthed,
  verified,
  compareEnabled,
  diff,
}: {
  imgLabel?: string;
  mediaDark?: boolean;
  badge?: string;
  badgeKind?: NonNullable<ListingCardProps["badgeKind"]>;
  aspect: "4/3" | "5/4" | "auto";
  heroSrc?: string | null;
  heroAlt?: string;
  priority?: boolean;
  propertyId?: string;
  initialSaved?: boolean;
  isAuthed?: boolean;
  verified?: boolean;
  compareEnabled?: boolean;
  diff?: ListingCardDiff;
}) {
  const aspectClass = cn(
    "w-full",
    aspect === "4/3" && "aspect-[4/3]",
    aspect === "5/4" && "aspect-[5/4]",
    aspect === "auto" && "aspect-auto h-full",
  );

  const overlays = (
    <>
      {/* Top-left: status badge (Exclusive, Vacant on transfer, etc.) */}
      {badge ? (
        <div className="absolute top-3 left-3 z-10 flex gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-medium",
              badgeStyles[badgeKind],
            )}
          >
            {badge}
          </span>
        </div>
      ) : null}

      {/* Top-right: diff badge above save/compare actions (price drop, etc.) */}
      {diff ? (
        <div className="absolute top-3 right-3 z-20">
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

      {/* Right column: save + compare buttons */}
      <div
        className={cn(
          "absolute right-3 z-10 flex flex-col gap-2",
          diff ? "top-[48px]" : "top-3",
        )}
      >
        {propertyId ? (
          <SaveButton
            propertyId={propertyId}
            initialSaved={initialSaved ?? false}
            isAuthed={isAuthed ?? false}
          />
        ) : (
          <span
            aria-hidden
            className="w-8 h-8 rounded-full bg-white/92 flex items-center justify-center text-bz-ink-2"
          >
            <Heart size={16} strokeWidth={1.6} />
          </span>
        )}
        {compareEnabled && propertyId ? (
          <CompareButton propertyId={propertyId} />
        ) : null}
      </div>

      {/* Bottom-left: Bazar Verified pill */}
      {verified ? (
        <div className="absolute bottom-3 left-3 z-10">
          <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-medium bg-white/92 text-bz-accent">
            <ShieldCheck size={11} strokeWidth={2.2} />
            Bazar Verified
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
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
  badge,
  badgeKind = "ink",
  imgLabel,
  mediaDark,
  heroSrc,
  heroAlt,
  propertyId,
  initialSaved,
  isAuthed,
  verified,
  compareEnabled,
  diff,
  priority,
  variant = "default",
  className,
}: ListingCardProps) {
  if (variant === "editorial") {
    return (
      <article className={cn("flex flex-col", className)}>
        <div className="rounded-[4px] overflow-hidden">
          <Media
            imgLabel={imgLabel}
            mediaDark={mediaDark}
            badge={badge}
            badgeKind={badgeKind}
            aspect="5/4"
            heroSrc={heroSrc}
            heroAlt={heroAlt}
            priority={priority}
            propertyId={propertyId}
            initialSaved={initialSaved}
            isAuthed={isAuthed}
            verified={verified}
            compareEnabled={compareEnabled}
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
              <span>{beds} bd</span>
              <span>{baths} ba</span>
              <span>{area} ft²</span>
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
          <Media
            imgLabel={imgLabel}
            mediaDark={mediaDark}
            badge={badge}
            badgeKind={badgeKind}
            aspect="auto"
            heroSrc={heroSrc}
            heroAlt={heroAlt}
            priority={priority}
            propertyId={propertyId}
            initialSaved={initialSaved}
            isAuthed={isAuthed}
            verified={verified}
            compareEnabled={compareEnabled}
            diff={diff}
          />
        </div>
        <div className="flex flex-col gap-2 px-[22px] py-[18px] flex-1">
          {badge ? (
            <div className="flex gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                  badgeStyles[badgeKind],
                )}
              >
                {badge}
              </span>
            </div>
          ) : null}
          <div className="text-[19px] font-medium tracking-tight text-bz-navy">{price}</div>
          <div className="text-[14px] text-bz-ink-2">{title}</div>
          <div className="text-[12px] text-bz-muted">{location}</div>
          <div className="flex gap-3 mt-2 text-[12px] text-bz-muted">
            <span>{beds} bedrooms</span>
            <span>{baths} bathrooms</span>
            <span>{area} ft²</span>
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
      <Media
        imgLabel={imgLabel}
        mediaDark={mediaDark}
        badge={badge}
        badgeKind={badgeKind}
        aspect="4/3"
        heroSrc={heroSrc}
        heroAlt={heroAlt}
        propertyId={propertyId}
        initialSaved={initialSaved}
        isAuthed={isAuthed}
        verified={verified}
        compareEnabled={compareEnabled}
        diff={diff}
      />
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="text-[19px] font-medium tracking-tight text-bz-navy">{price}</div>
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
            <Maximize2 size={14} strokeWidth={1.6} /> {area} ft²
          </span>
        </div>
      </div>
    </article>
  );
}

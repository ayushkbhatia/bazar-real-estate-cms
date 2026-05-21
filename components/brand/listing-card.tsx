import Image from "next/image";
import { BedDouble, Bath, Maximize2, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceholderImage } from "./placeholder-image";
import { SaveButton } from "./save-button";

export type ListingCardVariant = "default" | "editorial" | "row";

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
  variant?: ListingCardVariant;
  href?: string;
  className?: string;
};

const badgeStyles: Record<NonNullable<ListingCardProps["badgeKind"]>, string> = {
  ink: "bg-bz-ink text-bz-bg",
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
  propertyId,
  initialSaved,
  isAuthed,
}: {
  imgLabel?: string;
  mediaDark?: boolean;
  badge?: string;
  badgeKind?: NonNullable<ListingCardProps["badgeKind"]>;
  aspect: "4/3" | "5/4" | "auto";
  heroSrc?: string | null;
  heroAlt?: string;
  propertyId?: string;
  initialSaved?: boolean;
  isAuthed?: boolean;
}) {
  const aspectClass = cn(
    "w-full",
    aspect === "4/3" && "aspect-[4/3]",
    aspect === "5/4" && "aspect-[5/4]",
    aspect === "auto" && "aspect-auto h-full",
  );

  const overlays = (
    <>
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
      {propertyId ? (
        <SaveButton
          propertyId={propertyId}
          initialSaved={initialSaved ?? false}
          isAuthed={isAuthed ?? false}
        />
      ) : (
        <span
          aria-hidden
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/92 flex items-center justify-center text-bz-ink-2"
        >
          <Heart size={16} strokeWidth={1.6} />
        </span>
      )}
    </>
  );

  if (heroSrc) {
    return (
      <div className={cn("relative overflow-hidden", aspectClass)}>
        <Image
          src={heroSrc}
          alt={heroAlt ?? imgLabel ?? "Property hero"}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
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
            propertyId={propertyId}
            initialSaved={initialSaved}
            isAuthed={isAuthed}
          />
        </div>
        <div className="py-3.5 flex flex-col gap-1.5">
          <div className="eyebrow -mb-0.5">{location}</div>
          <h3 className="serif text-[22px] leading-tight text-bz-ink">
            {title}
          </h3>
          <div className="flex justify-between items-baseline mt-1.5">
            <div className="text-[19px] font-medium tracking-tight">
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
            propertyId={propertyId}
            initialSaved={initialSaved}
            isAuthed={isAuthed}
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
          <div className="text-[19px] font-medium tracking-tight">{price}</div>
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
      />
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="text-[19px] font-medium tracking-tight">{price}</div>
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

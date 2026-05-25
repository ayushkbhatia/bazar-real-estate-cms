"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MegamenuFeaturedTile,
  MegamenuTileVariant,
} from "@/lib/schemas/megamenu";

/**
 * Featured tile inside the megamenu panel. Modeled directly on the Bazar
 * mockup tiles — dark or light card, badge pill (with green dot by
 * default), serif italic headline, arrow-in-circle in the bottom right.
 *
 * No real photography yet → falls back to the .bz-img-dark / .bz-img
 * diagonal-line utility classes from app/globals.css. When a media asset
 * is wired in (PR after media-picker lands) the `image` variant resolves
 * via supabase storage.
 */

type Props = {
  tile: MegamenuFeaturedTile;
  className?: string;
};

const variantClasses: Record<MegamenuTileVariant, string> = {
  dark: "bz-img-dark text-white",
  light: "bz-img text-bz-ink",
  // PR will add the resolved-image case; safe default for now.
  image: "bz-img-dark text-white",
};

const badgeClasses: Record<MegamenuTileVariant, string> = {
  dark: "bg-white/95 text-bz-ink",
  light: "bg-bz-accent-soft text-bz-accent",
  image: "bg-white/95 text-bz-ink",
};

const dotClasses: Record<MegamenuTileVariant, string> = {
  dark: "bg-bz-success",
  light: "bg-bz-accent",
  image: "bg-bz-success",
};

const arrowBtnClasses: Record<MegamenuTileVariant, string> = {
  dark: "bg-white/95 text-bz-ink",
  light: "bg-bz-ink/90 text-white",
  image: "bg-white/95 text-bz-ink",
};

export function MegamenuTile({ tile, className }: Props) {
  const hasBadge = Boolean(tile.badge_label);

  return (
    <Link
      href={tile.href}
      className={cn(
        // aspect-square keeps the tile a true square regardless of column
        // width — matches the design mockups where featured tiles read as
        // image cards rather than wide banners.
        "group relative flex flex-col justify-between aspect-square w-full rounded-xl overflow-hidden p-5 transition-transform hover:scale-[1.005]",
        variantClasses[tile.variant],
        className,
      )}
    >
      {/* Soft scrim so text remains readable against the diagonal pattern */}
      {tile.variant === "dark" ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/30 to-black/55"
        />
      ) : null}

      <div className="relative flex justify-between">
        {hasBadge ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
              badgeClasses[tile.variant],
            )}
          >
            {tile.badge_kind === "dot" ? (
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tile.variant])}
              />
            ) : null}
            {tile.badge_label}
          </span>
        ) : (
          <span />
        )}
      </div>

      <div className="relative">
        <h3
          className="serif italic text-[26px] leading-tight max-w-[260px]"
          style={{ letterSpacing: "-0.015em" }}
        >
          {tile.headline}
        </h3>

        <div className="mt-5 flex items-center justify-between">
          {tile.cta_label ? (
            <span
              className={cn(
                "text-[12.5px]",
                tile.variant === "light" ? "text-bz-ink-2" : "text-white/85",
              )}
            >
              {tile.cta_label}
            </span>
          ) : (
            <span />
          )}
          <span
            aria-hidden
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5",
              arrowBtnClasses[tile.variant],
            )}
          >
            <ArrowRight size={16} strokeWidth={1.7} />
          </span>
        </div>
      </div>
    </Link>
  );
}

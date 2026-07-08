"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Compass,
  KeyRound,
  Landmark,
  Search,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MegamenuTile } from "./megamenu-tile";
import type {
  MegamenuColumn,
  MegamenuItem,
  MegamenuTab,
} from "@/lib/schemas/megamenu";

/**
 * The dropdown panel content for a single megamenu tab. Layout mirrors the
 * Bazar mockups:
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │  Left columns  │  Featured tiles (1-2)  │  Right cols  │
 *   └────────────────────────────────────────────────────────┘
 *
 * Any zone can be empty — when the right zone has no columns we drop the
 * third grid track and let the featured tiles span wider; when there are
 * no tiles we drop the middle track.
 */

type Props = {
  tab: MegamenuTab;
};

const badgeVariantClasses = {
  default: "bg-bz-surface-2 text-bz-muted",
  hot: "bg-[oklch(0.96_0.045_45)] text-[oklch(0.5_0.18_45)]",
  luxury: "bg-bz-accent-soft text-bz-accent",
  new: "bg-bz-info/10 text-bz-info",
  trending: "bg-bz-warning/10 text-bz-warning",
  partner: "bg-bz-accent-soft text-bz-accent",
} as const;

function ItemBadge({ item }: { item: MegamenuItem }) {
  if (!item.badge_label) return null;
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        badgeVariantClasses[item.badge_variant],
      )}
    >
      {item.badge_label}
    </span>
  );
}

function ColumnBlock({ column }: { column: MegamenuColumn }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[170px]">
      {column.heading ? (
        <div className="eyebrow pb-1">{column.heading}</div>
      ) : null}
      <ul className="flex flex-col gap-1">
        {column.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="block py-1 text-[13.5px] text-bz-ink-2 hover:text-bz-ink transition-colors"
            >
              {item.label}
              <ItemBadge item={item} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Icons for the card ("lead magnet") layout, keyed on the item's `icon`
// string so the mapping stays data-driven rather than hardcoded per tab.
const CARD_ICONS: Record<string, LucideIcon> = {
  search: Search,
  tag: Tag,
  "key-round": KeyRound,
  "clipboard-list": ClipboardList,
  "building-2": Building2,
  landmark: Landmark,
};

/**
 * Card treatment for a dense left zone — one column becomes one card:
 * icon chip + heading (as the title) + its single item (as the blurb),
 * linking to that item's href. Used for the Services "lead magnet" grid so
 * the panel reads as a structured block instead of a sparse text list.
 */
function ServiceCard({ column }: { column: MegamenuColumn }) {
  const item = column.items[0];
  const Icon = (item?.icon && CARD_ICONS[item.icon]) || Compass;
  return (
    <Link
      href={item?.href ?? "#"}
      className="group flex h-full flex-col gap-3 rounded-xl border border-bz-border bg-bz-surface p-5 transition-all hover:border-bz-ink/20 hover:bg-bz-surface-2 hover:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.3)]"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-bz-accent-soft text-bz-accent">
        <Icon size={18} strokeWidth={1.6} />
      </span>
      <div className="mt-auto flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[15px] font-medium text-bz-ink">
          {column.heading}
          <ArrowRight
            size={14}
            strokeWidth={1.8}
            className="text-bz-accent opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
          />
        </div>
        {item ? (
          <p className="text-[13px] leading-relaxed text-bz-ink-2">
            {item.label}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function MegamenuPanel({ tab }: Props) {
  const hasLeft = tab.columns.left.length > 0;
  const hasRight = tab.columns.right.length > 0;
  const hasFeatured = tab.featured.length > 0;

  // A single-column left zone (e.g. Rent's "Property Types") sizes to its
  // content instead of claiming an even fraction, so the featured tiles slide
  // left toward it rather than sitting dead-centre. Multi-column left zones
  // (e.g. Buy) keep the balanced 1fr track.
  const leftCount = tab.columns.left.length;
  const leftIsNarrow = leftCount <= 1;
  // A dense left zone (e.g. Services' six single-item "lead magnet" columns)
  // renders as a 3-up card grid so it reads as a structured block that fills
  // the panel rather than a sparse text list.
  const leftIsCards = leftCount >= 5;
  const leftGridClass = leftCount <= 1 ? "grid-cols-1" : "grid-cols-2";

  // Grid layout. Each present zone gets a track.
  const gridCols = [
    hasLeft ? (leftIsNarrow ? "minmax(0, max-content)" : "minmax(0, 1fr)") : null,
    hasFeatured ? "minmax(0, 1.1fr)" : null,
    hasRight ? "minmax(0, 0.85fr)" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    // No w-screen — the NavigationMenuContent override (in public-mega-nav)
    // anchors this panel to the full-width `relative` header, so taking the
    // wrapper's intrinsic width is enough. w-screen here would re-introduce
    // the right-edge bleed on every panel.
    <div className="bg-bz-bg border-b border-bz-border w-full">
      <div
        // px-12 matches the homepage section gutter so the panel content
        // tracks the same width as the rest of the site. min-h keeps every
        // panel visually the same size regardless of column/tile count.
        className="px-12 py-10 grid gap-12 min-h-[460px]"
        style={{ gridTemplateColumns: gridCols || "1fr" }}
      >
        {/* LEFT — title + columns */}
        {hasLeft ? (
          <div className="flex flex-col gap-7">
            {tab.panel_title ? (
              <Link
                href={tab.panel_title_href ?? "#"}
                className="group inline-flex items-center gap-2 text-bz-ink"
              >
                <span
                  className="serif italic text-[26px] leading-tight"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {tab.panel_title}
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bz-surface-2 text-bz-ink-2 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight size={14} strokeWidth={1.7} />
                </span>
              </Link>
            ) : null}
            {leftIsCards ? (
              <div className="grid flex-1 grid-cols-3 gap-4">
                {tab.columns.left.map((column) => (
                  <ServiceCard key={column.id} column={column} />
                ))}
              </div>
            ) : (
              <div className={cn("grid gap-x-10 gap-y-7", leftGridClass)}>
                {tab.columns.left.map((column) => (
                  <ColumnBlock key={column.id} column={column} />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* MIDDLE — featured tiles. Constrain the 1-tile case so the lone
            tile stays square-ish instead of stretching the whole track.
            `w-full max-w-…` (not just max-w) is needed: with grid-cols-1
            and an `aspect-square` child, the container would otherwise
            shrink to the child's intrinsic content width. */}
        {hasFeatured ? (
          <div
            className={cn(
              "grid gap-4 self-start w-full",
              tab.featured.length === 2
                ? "grid-cols-2"
                : "grid-cols-1 max-w-[320px] justify-self-center",
            )}
          >
            {tab.featured.map((tile) => (
              <MegamenuTile key={tile.id} tile={tile} />
            ))}
          </div>
        ) : null}

        {/* RIGHT — sub-locations / sub-markets. Title uses the same size +
            gap as the left zone's panel_title so the two zones' column
            sub-headings sit on the same baseline. */}
        {hasRight ? (
          <div className="flex flex-col gap-7">
            {tab.right_column_title ? (
              <h4
                className="serif italic text-[26px] leading-tight"
                style={{ letterSpacing: "-0.015em" }}
              >
                {tab.right_column_title}
              </h4>
            ) : null}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {tab.columns.right.map((column) => (
                <ColumnBlock key={column.id} column={column} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

export function MegamenuPanel({ tab }: Props) {
  const hasLeft = tab.columns.left.length > 0;
  const hasRight = tab.columns.right.length > 0;
  const hasFeatured = tab.featured.length > 0;

  // Grid layout. Each present zone gets a track.
  const gridCols = [
    hasLeft ? "minmax(0, 1fr)" : null,
    hasFeatured ? "minmax(0, 1.1fr)" : null,
    hasRight ? "minmax(0, 0.85fr)" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="bg-bz-bg border-b border-bz-border w-screen">
      <div
        className="mx-auto max-w-[1320px] px-12 py-10 grid gap-12"
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
            <div className="grid grid-cols-2 gap-x-10 gap-y-7">
              {tab.columns.left.map((column) => (
                <ColumnBlock key={column.id} column={column} />
              ))}
            </div>
          </div>
        ) : null}

        {/* MIDDLE — featured tiles */}
        {hasFeatured ? (
          <div
            className={cn(
              "grid gap-4",
              tab.featured.length === 2 ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            {tab.featured.map((tile) => (
              <MegamenuTile key={tile.id} tile={tile} />
            ))}
          </div>
        ) : null}

        {/* RIGHT — sub-locations / sub-markets */}
        {hasRight ? (
          <div className="flex flex-col gap-5">
            {tab.right_column_title ? (
              <h4
                className="serif italic text-[22px] leading-tight"
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

"use client";

import Link from "@/components/i18n/link";
import {
  ArrowRight,
  Building2,
  ChevronRight,
  ClipboardList,
  Compass,
  KeyRound,
  Landmark,
  Search,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type { MegamenuColumn, MegamenuTab } from "@/lib/schemas/megamenu";

/**
 * The "lead magnet" card treatment for a dense left zone — one column becomes
 * one card: icon chip + the column heading as the title + its single item as
 * the blurb, linking to that item's href. Services uses it for its six
 * service cards.
 *
 * Lives here rather than inside `megamenu-panel.tsx` because BOTH renderers
 * need it and they are separate trees: the desktop dropdown panel and the
 * mobile drawer's level-2 view. Before this file the drawer fell back to the
 * generic column renderer, so Services arrived on a phone as six uppercase
 * eyebrows each followed by a loose sentence — the same data with none of the
 * design.
 *
 * The desktop and mobile cards are siblings, not one component with
 * breakpoint variants: the desktop card stacks (icon over title over blurb)
 * inside a 3-up grid and reveals its arrow on hover, while the phone has no
 * hover and wants the row shape a touch list is read as. Sharing the icon map
 * and the `panelUsesCards` predicate is what actually keeps them from
 * drifting; sharing the flexbox would not.
 */

/**
 * Keyed on the item's `icon` string so the mapping stays data-driven rather
 * than hardcoded per tab (`0048_services_megamenu_icons.sql` sets them).
 *
 * Both cards look the glyph up inline — `(icon && MEGAMENU_CARD_ICONS[icon]) ||
 * MEGAMENU_CARD_ICON_FALLBACK` — rather than through a `getIcon(column)`
 * helper. A helper reads better but `react-hooks/static-components` rejects it:
 * a function returning a component type, called in a render body, is a
 * component created during render as far as that rule can tell. The map itself
 * is the part worth sharing anyway; the two-token lookup is not where the
 * renderers would drift.
 */
export const MEGAMENU_CARD_ICONS: Record<string, LucideIcon> = {
  search: Search,
  tag: Tag,
  "key-round": KeyRound,
  "clipboard-list": ClipboardList,
  "building-2": Building2,
  landmark: Landmark,
};

/** Shown when a column names no icon, or names one this map does not carry. */
export const MEGAMENU_CARD_ICON_FALLBACK: LucideIcon = Compass;

/**
 * Whether a tab's left zone renders as cards rather than as link columns.
 *
 * A column-count heuristic, deliberately — never a slug test. Any tab whose
 * left zone is this dense is a set of single-item columns (six headings with
 * one sentence each), which reads as a sparse text list in the generic
 * renderer and as a structured block here. Slug-hardcoding would freeze the
 * treatment to Services and quietly skip the next tab shaped like it.
 *
 * Exported so the desktop panel and the mobile drawer decide identically off
 * one line; when they each carried their own answer, only one of them had one.
 */
export function panelUsesCards(tab: MegamenuTab): boolean {
  return tab.columns.left.length >= 5;
}

/** Desktop: a stacked card sized by the 3-up grid it sits in. */
export function MegamenuServiceCard({ column }: { column: MegamenuColumn }) {
  const item = column.items[0];
  const Icon =
    (item?.icon && MEGAMENU_CARD_ICONS[item.icon]) ||
    MEGAMENU_CARD_ICON_FALLBACK;
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
            // translate-x has no logical form, so the nudge needs an explicit pair:
            // the chevron slides toward the reading direction, which is
            // rightward in English and leftward in Arabic.
            className="text-bz-accent opacity-0 ltr:-translate-x-1 rtl:translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
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

/**
 * Mobile: the same card linearised into a row — icon chip, then title over
 * blurb, then a trailing chevron.
 *
 * A row rather than the desktop stack because the blurb is a full sentence:
 * two-up on a 390px viewport leaves ~165px of text column and turns each
 * sentence into six lines, while the desktop card's own stack repeated
 * full-width wastes the width the icon chip could be occupying.
 *
 * The chevron is a bare `ChevronRight` on purpose — app/globals.css mirrors
 * that glyph under `[dir="rtl"]`, so it points into the reading direction on
 * /ar without a variant here. The card clears the 44px touch floor on its own
 * padding and two lines of blurb, so it carries no explicit height.
 */
export function MegamenuServiceCardMobile({
  column,
}: {
  column: MegamenuColumn;
}) {
  const item = column.items[0];
  const Icon =
    (item?.icon && MEGAMENU_CARD_ICONS[item.icon]) ||
    MEGAMENU_CARD_ICON_FALLBACK;
  return (
    <Link
      href={item?.href ?? "#"}
      className="flex items-center gap-3.5 rounded-xl border border-bz-border bg-bz-surface p-4 transition-colors active:bg-bz-surface-2"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-bz-accent-soft text-bz-accent">
        <Icon size={18} strokeWidth={1.6} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-[15px] font-medium leading-snug text-bz-ink">
          {column.heading}
        </div>
        {item ? (
          <p className="text-[12.5px] leading-relaxed text-bz-ink-2">
            {item.label}
          </p>
        ) : null}
      </div>
      <ChevronRight
        size={16}
        strokeWidth={1.6}
        className="shrink-0 text-bz-muted"
      />
    </Link>
  );
}

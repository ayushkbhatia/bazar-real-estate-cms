"use client";

import Link from "@/components/i18n/link";
import { ChevronRight } from "lucide-react";
import type { MegamenuColumn, MegamenuTab } from "@/lib/schemas/megamenu";

/**
 * The "grouped collection" treatment for a right zone that carries several
 * titled groups — Areas' four "Communities by Lifestyle" blocks (Waterfront /
 * Gated / Luxury / Family-Friendly, two developments each).
 *
 * The generic column renderer draws each of those as an 11px muted uppercase
 * eyebrow over its links, in one continuous stack. On a phone the gap inside a
 * group and the gap between two groups end up the same height, every row is
 * the same 15px ink, and nothing is drawn around anything — so four lifestyle
 * collections read as one twelve-line list. Which lifestyle you are looking at
 * is carried entirely by a label smaller and fainter than the links under it.
 *
 * This is the same failure the Services panel had before the card treatment
 * landed, arriving from the other direction. Services was a set of columns
 * holding ONE item each, so the fix was to promote each column into a card
 * whose blurb is that item. These columns hold SEVERAL items, so promoting
 * them the same way would throw the items away. The card here is a container
 * instead of a summary: a titled header over the group's own links.
 *
 * Like `megamenu-service-card.tsx`, the desktop and mobile cards are siblings
 * rather than one component with breakpoint variants — the desktop card sits
 * in a 2-up grid inside an already-narrow panel track and shows its links as
 * text, while the phone has the full width to spend and wants the divided,
 * chevroned rows a touch list is read as. What keeps them from drifting is the
 * shared `panelUsesGroupCards` predicate, not shared flexbox.
 */

/**
 * Whether a tab's right zone renders as group cards rather than as bare link
 * columns.
 *
 * A shape heuristic, deliberately — never a slug test, matching the rule
 * `panelUsesCards` follows. "Three or more groups, every one of them titled"
 * is the shape that stops reading as a list of links and starts reading as a
 * taxonomy, and a taxonomy needs its divisions drawn. Two titled groups still
 * read fine unaided; an untitled column has no group name to put in a header,
 * so a card around it would be an empty frame.
 *
 * Today that is Areas alone. Rent has two titled right columns and stays on
 * the generic renderer; Buy and New Projects have untitled ones and do too.
 * A tab that grows a third titled group picks this up without a code change,
 * and Areas would drop back out if its taxonomy shrank — which is the point of
 * asking about shape rather than about the slug.
 *
 * Exported so the desktop panel and the mobile drawer decide identically off
 * one line. When each tree carried its own answer for the Services zone, only
 * one of them had one.
 */
export function panelUsesGroupCards(tab: MegamenuTab): boolean {
  const groups = tab.columns.right;
  return groups.length >= 3 && groups.every((c) => Boolean(c.heading));
}

/**
 * The accent tick that opens every group header. Purely a rhythm marker: it
 * gives the header row a fixed left anchor so four stacked cards scan down a
 * single edge, and it is the one piece of brand colour in an otherwise
 * monochrome block.
 *
 * `w-[3px] h-3.5` rather than a border utility because `border-l`/`border-r`
 * are banned repo-wide (they do not flip for Arabic) and `border-s` on an
 * empty span would need a width anyway. As a sized element it sits at the
 * start of a flex row, so RTL moves it for free.
 */
function GroupTick() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-[3px] shrink-0 rounded-full bg-bz-accent"
    />
  );
}

/**
 * Desktop: a bordered card per group inside the right zone's 2-up grid.
 *
 * The header is deliberately NOT `.eyebrow`, here or on the phone. An eyebrow
 * is 11px uppercase in `--bz-eyebrow` taupe — smaller and fainter than the
 * links beneath it — which is exactly the inversion that made the zone read as
 * one list. A group name that governs its own contents outranks them, so it
 * gets ink and weight and the rule under it does the "this is a header" work
 * the uppercasing was being asked to do alone.
 *
 * `h-full` so all four cards in the 2x2 match height regardless of item count.
 */
export function MegamenuGroupCard({ column }: { column: MegamenuColumn }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-bz-border bg-bz-surface">
      {/* Wraps rather than truncates. Cards in this 2-up grid run ~150px at
          1280 and ~195px at 1440, and three of Areas' four names are wider
          than that at some point in the range — clipping the group name
          defeats the card, since the name is the only thing distinguishing one
          from the next.

          `min-h` is what keeps wrapping from going ragged. It reserves two
          lines on EVERY header (13px at leading-snug ≈ 18px a line, plus
          py-2.5 and the rule), so a one-line name and a two-line name occupy
          the same strip and all four cards in the 2x2 start their items on the
          same baseline. A per-card height would only float them apart, which
          is the failure mode a grid of cards has and a list does not. */}
      <div className="flex min-h-[58px] items-center gap-2 border-b border-bz-border px-4 py-2.5">
        <GroupTick />
        <h4 className="min-w-0 text-[13px] font-medium leading-snug text-bz-ink">
          {column.heading}
        </h4>
      </div>
      <ul className="flex flex-col gap-0.5 px-4 py-3">
        {column.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="block py-1 text-[13.5px] text-bz-ink-2 transition-colors hover:text-bz-accent"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Mobile: the same card, full width, with the group's links as divided rows.
 *
 * Rows rather than the desktop's loose list because on a phone the thing that
 * failed was the absence of edges — a divider between two links inside a group
 * and a card boundary between two groups are what tell the eye where one
 * lifestyle stops. `min-h-11` puts every row over the 44px touch floor on its
 * own, without a `pointer-coarse:` variant: this drawer is the only surface
 * these rows appear on and it is a touch surface at every width it renders.
 *
 * The chevron is a bare `ChevronRight` — app/globals.css mirrors `.lucide-
 * chevron-right` under `[dir="rtl"]`, so it points into the reading direction
 * on /ar with no variant here.
 */
export function MegamenuGroupCardMobile({
  column,
}: {
  column: MegamenuColumn;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-bz-border bg-bz-surface">
      {/* Two things differ from the desktop strip, both because these cards
          stack rather than grid. The tint: on desktop each card sits in its
          own cell with air around it, while in a drawer they meet at a 10px
          gap and need a stronger cue than a hairline that the next header has
          started — a filled strip reads at a glance where a border does not.
          And the height floor is one line, not two: nothing here has to line
          up with a card beside it, so a short group name should not pay for
          the longest one's second line down the whole scroll. */}
      <div className="flex min-h-[46px] items-center gap-2 border-b border-bz-border bg-bz-surface-2 px-4 py-2.5">
        <GroupTick />
        <h4 className="min-w-0 text-[13px] font-medium leading-snug text-bz-ink">
          {column.heading}
        </h4>
      </div>
      <ul className="flex flex-col divide-y divide-bz-border">
        {column.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-[14.5px] text-bz-ink transition-colors active:bg-bz-surface-2"
            >
              <span className="min-w-0 truncate">
                {item.label}
                {item.badge_label ? (
                  <span className="ms-2 text-[10.5px] uppercase tracking-wider text-bz-muted">
                    {item.badge_label}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                size={15}
                strokeWidth={1.6}
                className="shrink-0 text-bz-muted"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

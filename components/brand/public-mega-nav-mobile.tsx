"use client";

import Link from "@/components/i18n/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Wordmark, type BrandLogo } from "./wordmark";
import type { HeaderCta } from "./public-mega-nav";
import { MegamenuTile } from "./megamenu-tile";
import { cn } from "@/lib/utils";
import type {
  Megamenu,
  MegamenuColumn,
  MegamenuTab,
} from "@/lib/schemas/megamenu";

/**
 * Push-to-sub-view mobile drawer.
 *
 *   Level 1: list of 10 tabs. Tap → push to L2.
 *   Level 2: full tab panel (left cols + tiles + right cols) stacked
 *            vertically. Back button returns to L1.
 *
 * Tabs without panels (Insights, About) navigate directly on tap and
 * close the drawer. Pinned bottom row has Saved + List CTA + a
 * session-aware entry: "Sign in" when signed out, "Sign out" (with the
 * current email) when signed in.
 */

type Props = {
  data: Megamenu;
  /** CMS-uploaded brand logo, mirrored from the desktop header. */
  logo?: BrandLogo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered in the L1 footer above the Saved / List / Sign-in CTAs. */
  footerSlot?: React.ReactNode;
  /**
   * The header's CMS-editable call-to-action, threaded down from
   * `PublicMegaNav`. Null falls back to `nav.listProperty` — which is what the
   * pinned button SHOULD have read all along. It was the English literal
   * `List Your Property`, so on /ar it sat under an otherwise Arabic drawer.
   */
  cta?: HeaderCta | null;
};

/**
 * The drawer's only dismiss control used to be the `sr-only` SheetHeader — a
 * 0x0 box — plus the scrim. That was already thin at 75% width (a 95px strip
 * of a 390px viewport); now the panel is full-bleed below md there is no
 * scrim left to tap at all, so this button is the sole way out on a phone
 * apart from the hardware back gesture.
 *
 * 36px at rest so it sits level with the L2 back arrow it mirrors, 44px under
 * `(pointer: coarse)` — the same media query app/globals.css uses for the
 * button primitive, which cannot reach a hand-rolled <button> like this one.
 * A width breakpoint would be the wrong axis: this drawer is shown all the
 * way up to xl, so `md:` would hand a fine-pointer laptop at 1000px
 * thumb-sized chrome.
 */
function DrawerCloseButton({ onClose }: { onClose: () => void }) {
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("closeMenu")}
      className="size-9 pointer-coarse:size-11 shrink-0 inline-flex items-center justify-center rounded-md text-bz-ink hover:bg-bz-surface-2"
    >
      <X size={20} strokeWidth={1.6} />
    </button>
  );
}

function MobileColumn({ column }: { column: MegamenuColumn }) {
  return (
    <div className="flex flex-col gap-1.5">
      {column.heading ? (
        <div className="eyebrow pt-2">{column.heading}</div>
      ) : null}
      <ul className="flex flex-col">
        {column.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center justify-between py-2.5 text-[15px] text-bz-ink"
            >
              <span>
                {item.label}
                {item.badge_label ? (
                  <span className="ms-2 text-[10.5px] uppercase tracking-wider text-bz-muted">
                    {item.badge_label}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabPanel({
  tab,
  onClose,
  onBack,
}: {
  tab: MegamenuTab;
  onClose: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("nav");
  return (
    <div className="flex flex-col h-full">
      <div className="h-[60px] px-4 flex items-center gap-2 border-b border-bz-border bg-bz-bg shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className="size-9 pointer-coarse:size-11 shrink-0 inline-flex items-center justify-center rounded-md text-bz-ink hover:bg-bz-surface-2"
        >
          <ArrowLeft size={18} strokeWidth={1.7} />
        </button>
        {/* min-w-0 alongside flex-1 so the title yields to its two 44px
            neighbours instead of pushing them out of the 60px row. */}
        <h2
          className="serif italic text-[18px] leading-none truncate min-w-0 flex-1"
          style={{ letterSpacing: "-0.015em" }}
        >
          {tab.panel_title ?? tab.label}
        </h2>
        <DrawerCloseButton onClose={onClose} />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-5 flex flex-col gap-7" onClick={onClose}>
          {tab.columns.left.map((column) => (
            <MobileColumn key={column.id} column={column} />
          ))}

          {tab.featured.length > 0 ? (
            <div className="flex flex-col gap-3 pt-2">
              {tab.featured.map((tile) => (
                <MegamenuTile key={tile.id} tile={tile} />
              ))}
            </div>
          ) : null}

          {tab.columns.right.length > 0 ? (
            <div className="flex flex-col gap-4 pt-2 border-t border-bz-border">
              {tab.right_column_title ? (
                <h3
                  className="serif italic text-[20px] leading-tight pt-3"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {tab.right_column_title}
                </h3>
              ) : null}
              {tab.columns.right.map((column) => (
                <MobileColumn key={column.id} column={column} />
              ))}
            </div>
          ) : null}

          {tab.panel_title_href ? (
            <Link
              href={tab.panel_title_href}
              className="mt-2 inline-flex items-center justify-center py-3 rounded-md bg-bz-accent text-bz-accent-fg hover:bg-bz-accent-hover text-[14px]"
            >
              {/* The tab label arrives already folded to the locale, so the
                  only English left here was the frame around it. `toLowerCase`
                  is a no-op on Arabic script, which has no case — harmless,
                  and kept so the English reads as it always has. */}
              {t("viewAll", { label: tab.label.toLowerCase() })}
            </Link>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function TabsList({
  data,
  logo,
  onPick,
  onClose,
  footerSlot,
  cta,
}: {
  data: Megamenu;
  logo?: BrandLogo | null;
  onPick: (tab: MegamenuTab) => void;
  onClose: () => void;
  footerSlot?: React.ReactNode;
  cta?: HeaderCta | null;
}) {
  const t = useTranslations("nav");
  return (
    <div className="flex flex-col h-full">
      {/* pe-3 rather than px-5: the close button's 44px box wants to sit
          closer to the edge than the wordmark's optical margin does. */}
      <div className="h-[60px] ps-5 pe-3 flex items-center justify-between gap-2 border-b border-bz-border bg-bz-bg shrink-0">
        <Wordmark logo={logo} />
        <DrawerCloseButton onClose={onClose} />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <ul className="flex flex-col">
          {data.tabs.map((tab) => {
            const Inner = (
              <span className="flex items-center justify-between w-full">
                <span className="text-[17px] text-bz-ink">{tab.label}</span>
                {tab.has_panel ? (
                  <ChevronRight
                    size={18}
                    strokeWidth={1.6}
                    className="text-bz-muted"
                  />
                ) : null}
              </span>
            );
            return (
              <li key={tab.id} className="border-b border-bz-border">
                {tab.has_panel ? (
                  <button
                    type="button"
                    onClick={() => onPick(tab)}
                    className="w-full px-5 py-4 text-start hover:bg-bz-surface-2"
                  >
                    {Inner}
                  </button>
                ) : (
                  <Link
                    href={tab.href ?? "#"}
                    onClick={onClose}
                    className="block w-full px-5 py-4 hover:bg-bz-surface-2"
                  >
                    {Inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>

      {/* `pt-3 pb-bar-safe`, not `py-3 pb-bar-safe`: both set padding-bottom,
          both land in Tailwind's utilities layer at equal specificity, and
          which one won would come down to emission order. The bottom inset is
          `max(env(safe-area-inset-bottom), 18px)` — a floor, so this reads as
          12/18 rather than 12/12 even on a device with no home indicator.

          The CTA below carries no height class on purpose. It is a
          `data-slot="button"`, so app/globals.css's `(pointer: coarse)` block
          already clamps it with `min-height: 44px` — and min-height beats the
          variant's `h-7` outright, they are different properties. An explicit
          `h-11` here would either duplicate that rule or, if written as
          `h-11 md:h-7`, hand 44px to a fine-pointer desktop window narrower
          than 768px, which that block deliberately does not do. */}
      <div className="border-t border-bz-border bg-bz-surface px-4 pt-3 pb-bar-safe flex flex-col gap-2 shrink-0">
        {footerSlot}
        <Button asChild size="sm">
          <Link href={cta?.href ?? "/services/sell"} onClick={onClose}>
            {cta?.label || t("listProperty")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function PublicMegaNavMobile({
  data,
  logo = null,
  open,
  onOpenChange,
  footerSlot,
  cta = null,
}: Props) {
  const t = useTranslations("nav");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Reset to L1 whenever the drawer closes so the next open is a fresh start.
  const handleOpenChange = (next: boolean) => {
    if (!next) setActiveTabId(null);
    onOpenChange(next);
  };

  const activeTab =
    activeTabId !== null ? data.tabs.find((t) => t.id === activeTabId) : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        // Logical, not physical: the hamburger that opens this sits at
        // `ms-auto`, so under /ar it is on the physical LEFT while
        // `side="right"` flew the panel in from the physical right.
        side="end"
        // We render our own close/back controls in each header. Was
        // `[&>button.absolute]:hidden`, which styled the primitive's markup
        // from outside and broke silently if that button lost `absolute`.
        showCloseButton={false}
        className={cn(
          "p-0 gap-0",
          // Full-bleed below md. The `w-full` this carried before never
          // applied: `data-[side=…]:w-3/4` in the primitive is (0,2,0)
          // against its (0,1,0), so the drawer rendered 295px of a 390px
          // viewport with the page still legible beside it. Matching the
          // primitive's modifiers exactly means tailwind-merge deletes its
          // pair rather than leaving two rules for the cascade to settle.
          //
          // md+ holds at max-w-sm (384px) — what this renders TODAY, not the
          // 448px its old `sm:max-w-md` claimed and never won.
          "data-[side=end]:w-full data-[side=end]:sm:max-w-none data-[side=end]:md:max-w-sm",
        )}
      >
        {/* `sr-only`, and English until now — which is the kind of string
            that stays broken longest, because the only people it reaches are
            the ones least able to report it. */}
        <SheetHeader className="sr-only">
          <SheetTitle>{t("primary")}</SheetTitle>
          <SheetDescription>{t("drawerDescription")}</SheetDescription>
        </SheetHeader>
        {/* `handleOpenChange`, not `onOpenChange`: Radix only fires its own
            handler for interactions it owns (ESC, scrim), never for the parent
            setting `open={false}`. Closing from in here used to keep
            `activeTabId`, so the next open landed back on the sub-view — which
            the visible close button makes obvious in a way a link tap did
            not. */}
        {activeTab ? (
          <TabPanel
            tab={activeTab}
            onClose={() => handleOpenChange(false)}
            onBack={() => setActiveTabId(null)}
          />
        ) : (
          <TabsList
            data={data}
            logo={logo}
            onPick={(tab) => setActiveTabId(tab.id)}
            onClose={() => handleOpenChange(false)}
            footerSlot={footerSlot}
            cta={cta}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

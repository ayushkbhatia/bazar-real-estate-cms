"use client";

import { useTranslations } from "next-intl";

import Link from "@/components/i18n/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { Wordmark, type BrandLogo } from "./wordmark";
import { MegamenuPanel } from "./megamenu-panel";
import { PublicMegaNavMobile } from "./public-mega-nav-mobile";
import { cn } from "@/lib/utils";
import type { Megamenu, MegamenuTab } from "@/lib/schemas/megamenu";

/**
 * Public-site top bar with CMS-editable megamenu.
 *
 * Drop-in replacement for PublicNav — the (public)/layout.tsx passes the
 * prefetched, RLS-published menu tree in via `data`. Tabs with `has_panel`
 * render a Radix NavigationMenu dropdown using MegamenuPanel; direct-link
 * tabs (Insights, About) render as plain links.
 *
 * Renders a hamburger trigger at < xl that hands off to
 * PublicMegaNavMobile (Sheet drawer).
 */

type Props = {
  data: Megamenu;
  /**
   * CMS-uploaded brand logo (/admin/settings/brand), resolved by the
   * (public) layout. Null keeps the type-only wordmark.
   */
  logo?: BrandLogo | null;
  /**
   * Optional node rendered in the mobile drawer footer (e.g. the
   * currency/area-unit preferences entry). Injected by the (public)
   * layout so this brand component stays free of app-level imports.
   */
  footerSlot?: React.ReactNode;
  /**
   * The header's call-to-action, resolved by the (public) layout from
   * `/admin/megamenu/header-cta`. The label arrives already folded to the
   * request's locale, and is the same string at every width.
   *
   * Optional, and every read below falls back to `nav.*` — this component is
   * mounted in tests and stories with no data layer behind it, and the
   * fallback is also what renders if the document read ever fails.
   */
  cta?: HeaderCta | null;
};

/** Mirrors `HeaderCta` in `lib/queries/header-cta.ts`, without importing it —
 * `components/brand/*` stays free of app-level data modules. */
export type HeaderCta = {
  label: string;
  href: string;
};

function isActive(pathname: string | null, tab: MegamenuTab): boolean {
  if (!pathname) return false;
  const href = tab.has_panel ? tab.panel_title_href : tab.href;
  if (!href) return false;
  const base = href.split("?")[0]!;
  if (base === "/") return pathname === "/";
  return pathname.startsWith(base);
}

// Override class for NavigationMenuContent so each panel spans the full
// viewport width regardless of where the trigger sits. `position: fixed`
// (with !) overrides shadcn's `md:absolute` and bypasses the Radix-internal
// `position:relative` wrapper around the NavigationMenu root that would
// otherwise constrain the panel to the trigger row's width.
//
// `top-[72px]` matches the sticky header height so the panel docks
// directly under it. `z-30` puts the panel above page content but below
// the header (z-40), which keeps the trigger row clickable when open.
const PANEL_CONTENT_CLASS =
  "fixed! left-0! right-0! top-[72px]! w-auto! mt-0! z-30! " +
  "rounded-none! ring-0! bg-bz-bg! p-0! overflow-visible! " +
  "shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]!";

/**
 * True once the document has scrolled past `offset` px. rAF-coalesced so a
 * fling doesn't queue a setState per scroll event, and seeded on mount so a
 * restored scroll position (back/forward nav, anchor link) starts correct.
 */
function useScrolled(offset: number): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > offset);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [offset]);

  return scrolled;
}

export function PublicMegaNav({
  data,
  logo = null,
  footerSlot,
  cta = null,
}: Props) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);
  // Controlled Radix value — we only need "is a panel open", but the
  // header's opacity depends on it, so the state has to live up here.
  const [openTab, setOpenTab] = useState("");
  const scrolled = useScrolled(8);

  // Opaque whenever something is docked to the bar: the megamenu panel
  // and the mobile drawer are solid `bg-bz-bg`, so a see-through header
  // above them reads as a seam rather than an effect.
  const solid = openTab !== "" || mobileOpen;

  return (
    <>
      <header
        className={cn(
          // No `relative` alongside `sticky` — cn()'s tailwind-merge treats
          // them as the same conflict group and would drop one. Sticky is
          // itself a positioned element, so it anchors the blur layer.
          "sticky top-0 z-40 h-[72px] px-6 md:px-12 flex items-center gap-6",
          "border-b transition-[border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          // Nothing to separate from at the very top of the document —
          // the rule and the lift fade in once content slides under.
          scrolled || solid ? "border-bz-border" : "border-transparent",
          scrolled &&
            !solid &&
            "shadow-[0_1px_20px_-10px_color-mix(in_oklab,var(--bz-ink)_45%,transparent)]",
        )}
      >
        {/*
          The frosted pane is a child rather than a class on <header>
          on purpose: `backdrop-filter` establishes a containing block
          for fixed-position descendants, and the megamenu panel is a
          `position: fixed` descendant that must stay full-bleed against
          the viewport (see PANEL_CONTENT_CLASS). Blurring in a sibling
          layer keeps that escape hatch intact.

          Blur stays mounted in both states and only the alpha animates —
          transitioning `backdrop-filter` itself is janky, and at full
          opacity the blur is invisible anyway.
        */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 -z-10 pointer-events-none bg-bz-bg",
            "transition-colors duration-200 ease-out motion-reduce:transition-none",
            "supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150",
            !solid && "supports-[backdrop-filter]:bg-bz-bg/72",
          )}
        />

        {/* `xl:shrink-0` so the logo keeps its box when the trigger row is
            wide — without it the flex row steals width from the brand first,
            and at xl the row it competes with is the centred megamenu.

            Below xl it deliberately does shrink, and that is new. The phone
            bar now carries the full "List Your Property" label rather than
            "List", so the cluster on the right went from 96px to 179px at
            375px. With the shipped 44px square mark there is still ~120px to
            spare, but `logoOnlyHeightMap` lets an uploaded lockup draw up to
            190px, and 190 + 179 + gutters overflows a 390px viewport — a
            horizontal scrollbar on every page, and a blocking failure of
            e2e/mobile-geometry.spec.ts's `overflow` check.

            `min-w-0` down the chain plus `[&_img]:shrink` is what makes the
            mark yield instead: the lockup is a flex item that Wordmark pins
            with `shrink-0`, and a descendant selector out-specifies it. The
            image keeps its own `min-w-11` floor, so it can never shrink past
            the 44px square the site ships today — the width the bar has
            always had room for — and `object-contain` scales the art rather
            than cropping it. The text wordmark carries no <img> and is
            narrower than the cluster leaves free, so neither class reaches
            it. */}
        <Link
          href="/"
          aria-label={t("home")}
          className="flex items-center min-w-0 xl:shrink-0 [&_img]:shrink"
        >
          <Wordmark logo={logo} className="min-w-0" />
        </Link>

        {/* Desktop nav — hidden below xl, replaced by hamburger.
            Gated at xl (not md) because the trigger row is intrinsically
            ~766px wide: alongside the wordmark, right cluster and px-12
            gutters the header needs ~1205px, so md and lg both overflow
            the viewport. */}
        <div className="hidden xl:flex flex-1 justify-center">
          <NavigationMenu
            viewport={false}
            value={openTab}
            onValueChange={setOpenTab}
          >
            <NavigationMenuList className="gap-1">
              {data.tabs.map((tab) => {
                const active = isActive(pathname, tab);

                if (!tab.has_panel) {
                  return (
                    <NavigationMenuItem key={tab.id}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={tab.href ?? "#"}
                          className={cn(
                            "px-3 py-2 text-[13.5px] rounded-md transition-colors hover:bg-bz-surface-2",
                            active
                              ? "text-bz-teal"
                              : "text-bz-ink-2 hover:text-bz-ink",
                          )}
                        >
                          {tab.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  );
                }

                return (
                  // `static` releases the absolute-positioning anchor so
                  // the panel resolves against the sticky header above.
                  // `value` is explicit because the root is controlled —
                  // Radix's auto-generated ids would still work, but the
                  // tab id keeps the open state readable and stable.
                  <NavigationMenuItem
                    key={tab.id}
                    value={tab.id}
                    className="static"
                  >
                    <NavigationMenuTrigger
                      className={cn(
                        "h-9 px-3 text-[13.5px] font-normal bg-transparent hover:bg-bz-surface-2 data-[state=open]:bg-bz-surface-2",
                        active ? "text-bz-teal" : "text-bz-ink-2",
                      )}
                    >
                      {tab.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className={PANEL_CONTENT_CLASS}>
                      <MegamenuPanel tab={tab} />
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Right cluster */}
        <div className="hidden xl:flex gap-2 items-center">
          <Button asChild size="sm">
            <Link href={cta?.href ?? "/services/sell"}>
              {cta?.label || t("listProperty")}
            </Link>
          </Button>
        </div>

        {/* Mobile right cluster — just the hamburger + CTA.

            `shrink-0`: this cluster carries the full CTA label now, so it is
            the widest it has ever been, and it is the half of the bar that
            must not be squeezed — the brand link above gives up width first
            (see the `min-w-0` there). Without it flex would take the
            difference out of whichever item happened to be more compressible,
            which on a wide uploaded lockup is the button. */}
        <div className="xl:hidden ms-auto flex shrink-0 items-center gap-2">
          {/* Deliberately no height override. `size="sm"` is 28px, but Slot
              forwards `data-slot="button"` onto the rendered <a>, so the
              `(pointer: coarse)` block in app/globals.css already clamps this
              to 44px through min-height — which `h-7` cannot undo, being a
              different property. The audit's 28px reading predates that block;
              adding `h-11 md:h-7` here would only widen the target on
              fine-pointer windows under 768px, which that block declines to
              do on purpose.

              What that block does NOT give it is width, and a touch target is
              judged on both axes. `pointer-coarse:min-w-11` is what closed
              that axis back when the label here was the four-character "List"
              and measured 43x44. The full label clears 44px on its own —
              127px at 375px — but the floor stays: an editor is free to save
              a one-word label, and this is the only thing standing between
              that and a 30px-wide target. */}
          <Button
            asChild
            size="sm"
            className="pointer-coarse:min-w-11 whitespace-nowrap"
          >
            <Link href={cta?.href ?? "/services/sell"}>
              {/* The same label the desktop pill renders. It was `List` — a
                  literal, so English on /ar — and then `cta.shortLabel`, an
                  abbreviation nobody asked for: read cold beside a menu icon
                  "List" is as easily the noun (one of the search layouts) as
                  the verb. The bar has room for the whole phrase, so it says
                  the whole phrase. */}
              {cta?.label || t("listProperty")}
            </Link>
          </Button>
          {/*
            40px at rest, 44px on a touchscreen. None of app/globals.css's
            `(pointer: coarse)` floors reach this element: it is a hand-rolled
            <button> with no `data-slot`, and it is not a `sheet-trigger`
            either — the drawer is controlled from `mobileOpen` up here, so
            Radix never renders a trigger for it.

            `pointer-coarse:` and not a width breakpoint, matching that block's
            reasoning: this cluster is visible to 1279px, so `md:` would
            enlarge the button on a fine-pointer laptop that has no need of it.
          */}
          <button
            type="button"
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((s) => !s)}
            className="size-10 pointer-coarse:size-11 inline-flex items-center justify-center rounded-md text-bz-ink hover:bg-bz-surface-2"
          >
            {mobileOpen ? (
              <X size={20} strokeWidth={1.6} />
            ) : (
              <Menu size={20} strokeWidth={1.6} />
            )}
          </button>
        </div>
      </header>

      <PublicMegaNavMobile
        data={data}
        logo={logo}
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        footerSlot={footerSlot}
        cta={cta}
      />
    </>
  );
}

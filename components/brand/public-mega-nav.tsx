"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Heart, Menu, X } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { Wordmark } from "./wordmark";
import { AccountMenu } from "./account-menu";
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
   * Optional node rendered in the mobile drawer footer (e.g. the
   * currency/area-unit preferences entry). Injected by the (public)
   * layout so this brand component stays free of app-level imports.
   */
  footerSlot?: React.ReactNode;
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

export function PublicMegaNav({ data, footerSlot }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 h-[72px] px-6 md:px-12 flex items-center gap-6 border-b border-bz-border bg-bz-bg relative">
        <Link href="/" className="flex items-center">
          <Wordmark />
        </Link>

        {/* Desktop nav — hidden below xl, replaced by hamburger.
            Gated at xl (not md) because the trigger row is intrinsically
            ~766px wide: alongside the wordmark, right cluster and px-12
            gutters the header needs ~1205px, so md and lg both overflow
            the viewport. */}
        <div className="hidden xl:flex flex-1 justify-center">
          <NavigationMenu viewport={false}>
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
                              ? "text-bz-ink"
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
                  // the panel resolves against the `relative` header above.
                  <NavigationMenuItem key={tab.id} className="static">
                    <NavigationMenuTrigger
                      className={cn(
                        "h-9 px-3 text-[13.5px] font-normal bg-transparent hover:bg-bz-surface-2 data-[state=open]:bg-bz-surface-2",
                        active ? "text-bz-ink" : "text-bz-ink-2",
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
          <Button asChild variant="ghost" size="sm">
            <Link href="/account/saved">
              <Heart size={14} strokeWidth={1.6} />
              Saved
            </Link>
          </Button>
          <AccountMenu />
          <Button asChild size="sm">
            <Link href="/services/sell">List a property</Link>
          </Button>
        </div>

        {/* Mobile right cluster — just the hamburger + CTA */}
        <div className="xl:hidden ml-auto flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/services/sell">List</Link>
          </Button>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((s) => !s)}
            className="h-10 w-10 inline-flex items-center justify-center rounded-md text-bz-ink hover:bg-bz-surface-2"
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
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        footerSlot={footerSlot}
      />
    </>
  );
}

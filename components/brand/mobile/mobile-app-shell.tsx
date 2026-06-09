"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppBar } from "./app-bar";
import { MobileTabBar, type TabItem } from "./mobile-tab-bar";

/**
 * Mobile internal-app frame (handoff `MAppShell`) for the CMS: a 56px
 * app bar, a scrollable content area, an optional FAB / sticky footer,
 * and the bottom tab bar. Content is padded to clear the fixed tab bar.
 *
 * Used by `cms-shell.tsx` under `md`; the desktop 240px-sidebar shell
 * renders at/above `md`. The same page `children` flow into whichever
 * shell is visible — never duplicated.
 */
export function MobileAppShell({
  brand,
  title,
  back,
  actions,
  tabs,
  homeHref,
  fab,
  sticky,
  className,
  children,
}: {
  brand?: string;
  title?: ReactNode;
  back?: string;
  actions?: ReactNode;
  tabs: TabItem[];
  homeHref?: string;
  fab?: ReactNode;
  sticky?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-h-dvh-safe flex-col bg-bz-bg", className)}>
      <AppBar
        brand={brand}
        title={title}
        back={back}
        actions={actions}
        homeHref={homeHref}
      />
      <div className="flex-1 overflow-x-hidden pb-[calc(var(--bz-tabbar-h)+12px)]">
        {children}
      </div>
      {fab}
      {sticky}
      <MobileTabBar tabs={tabs} />
    </div>
  );
}

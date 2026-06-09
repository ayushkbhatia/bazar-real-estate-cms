"use client";

import type { ElementType } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = {
  key: string;
  label: string;
  icon: ElementType;
  /** Destination for navigational tabs. */
  href?: string;
  /** Handler for action tabs (e.g. "More" opens a sheet). */
  onClick?: () => void;
  isActive: boolean;
};

/**
 * Bottom tab bar (handoff `.bzm-tabbar`) for the mobile CMS shell. Five
 * thumb-reachable tabs replacing the 240px desktop sidebar. The active
 * tab gets the ink "pill" icon. Carries the bottom safe-area inset
 * itself (`pb-safe`) since it is the bottommost fixed chrome.
 */
export function MobileTabBar({
  tabs,
  className,
}: {
  tabs: TabItem[];
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-bz-border bg-bz-surface px-2 pt-1.5 pb-safe",
        className,
      )}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const content = (
          <>
            <span
              className={cn(
                "flex h-[26px] w-10 items-center justify-center rounded-full transition-colors",
                t.isActive ? "bg-bz-ink text-bz-bg" : "text-bz-muted",
              )}
            >
              <Icon className="size-[18px]" />
            </span>
            <span
              className={cn(
                "text-[10px] font-medium",
                t.isActive ? "text-bz-ink" : "text-bz-muted",
              )}
            >
              {t.label}
            </span>
          </>
        );
        const cls =
          "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5";
        return t.href ? (
          <Link key={t.key} href={t.href} className={cls}>
            {content}
          </Link>
        ) : (
          <button key={t.key} type="button" onClick={t.onClick} className={cls}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}

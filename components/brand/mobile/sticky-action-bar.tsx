import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky bottom CTA bar (handoff pattern 7) — the page's one primary
 * action (property: Enquire; off-plan: Book viewing; edit forms:
 * Publish). Fixed to the viewport bottom with a blurred surface and the
 * home-indicator safe area baked in via `pb-bar-safe`.
 *
 * Stacking: this sits at z-30, above content and the FAB (z-20) but
 * below the CMS bottom tab bar (z-40) and modal sheets (z-50). On a
 * public page (no tab bar) it is the bottommost element, so it carries
 * the safe-area inset itself. Inside MobileAppShell, pass `offsetTabBar`
 * so it floats just above the 56px tab bar and drops the inset (the tab
 * bar already owns it — don't double-count).
 *
 * The host page must reserve bottom space (e.g. a spacer or content
 * `pb-[calc(64px+var(--bz-bar-safe))]`) so the bar doesn't cover the
 * last content row.
 */
export function StickyActionBar({
  blur = true,
  offsetTabBar = false,
  className,
  children,
}: {
  blur?: boolean;
  offsetTabBar?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 flex items-center gap-3 border-t border-bz-border bg-bz-surface px-4 pt-3",
        offsetTabBar ? "bottom-[var(--bz-tabbar-h)] pb-3" : "bottom-0 pb-bar-safe",
        blur &&
          "supports-[backdrop-filter]:bg-bz-surface/85 supports-[backdrop-filter]:backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

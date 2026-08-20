import type { ReactNode } from "react";
import Link from "@/components/i18n/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "../wordmark";

/**
 * 56px top app bar for the mobile internal-app shell (handoff
 * `.bzm-appbar`). Shows either a back link (detail screens) or the
 * brand wordmark, a centred truncated title, and a right-aligned
 * actions cluster. The bar extends under the status-bar notch via
 * `pt-safe` while keeping the 56px control row intact.
 */
export function AppBar({
  brand,
  title,
  back,
  actions,
  homeHref = "/admin",
  className,
}: {
  brand?: string;
  title?: ReactNode;
  back?: string;
  actions?: ReactNode;
  homeHref?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-bz-border bg-bz-surface pt-safe",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 px-2">
        {back ? (
          <Link
            href={back}
            aria-label="Back"
            className="flex size-11 items-center justify-center rounded-lg text-bz-ink-2 active:bg-bz-surface-2"
          >
            <ArrowLeft className="size-5" />
          </Link>
        ) : brand ? (
          <Link href={homeHref} className="flex items-center px-2">
            <Wordmark sublabel={brand} size="sm" />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        {title != null && (
          <div className="min-w-0 flex-1 truncate px-1 text-center text-[16px] font-medium text-bz-ink">
            {title}
          </div>
        )}
        {/* min-w-0 + overflow lets a wide actions cluster (some admin
            pages pass view toggles + a primary CTA) scroll within the
            bar instead of pushing the page past the viewport. */}
        <div className="flex items-center gap-1 min-w-0 shrink overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {actions}
        </div>
      </div>
    </header>
  );
}

"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "buy", label: "Buy", path: "/buy/search" },
  { value: "rent", label: "Rent", path: "/rent/search" },
  { value: "off_plan", label: "Off-plan", path: "/off-plan/search" },
  { value: "commercial", label: "Commercial", path: "/commercial/search" },
] as const;

/**
 * Which pill owns the current pathname.
 *
 * Buy also owns its completion-form sub-routes (/buy/ready, /buy/resale):
 * those are still the Buy transaction mode, narrowed on a second axis. An
 * exact `pathname === path` test left the whole strip with nothing selected
 * and nothing aria-checked on those routes.
 *
 * Deliberately no Ready/Resale pills here — this strip is the transaction
 * mode axis, and putting completion forms in it re-conflates the two.
 */
function isActivePath(pathname: string, path: string): boolean {
  if (pathname === path) return true;
  if (path === "/buy/search") return pathname.startsWith("/buy/");
  return false;
}

/**
 * Sprint 4 (backfilled): mode segmented control rendered inside the filter bar
 * on the four search routes. Switches between modes while preserving every
 * other filter in the querystring.
 *
 * Every pill points at a `…/search` route. Commercial used to point at
 * `/commercial`, which became the marketing landing — leaving it there would
 * have sent each mode switch through a 307 and left `isActivePath` unable to
 * mark Commercial selected once you were on it.
 */
export function ModeSegmented() {
  const router = useRouter();
  const pathname = usePathname() ?? "/buy/search";

  function go(path: string) {
    if (path === pathname) return;
    const qs = typeof window !== "undefined" ? window.location.search : "";
    router.push(`${path}${qs}`);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Search mode"
      className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {MODES.map(({ value, label, path }) => {
        const active = isActivePath(pathname, path);
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => go(path)}
            className={cn(
              // 44px tall on a phone, back to 32px from `md` up. Hand-rolled
              // <button>s again, so the data-slot `(pointer: coarse)` floor in
              // globals.css cannot reach them. px-3.5 rather than px-3 on the
              // same breakpoint because the gate checks width *and* height:
              // "Buy" is the narrowest pill by some margin and the extra 4px
              // keeps it clear of the 44px floor on the other axis.
              "h-11 px-3.5 md:h-8 md:px-3 rounded text-[12.5px] transition-colors",
              active
                ? "bg-bz-navy text-bz-bg font-medium"
                : "text-bz-ink-2 hover:text-bz-ink",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

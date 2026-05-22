"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "buy", label: "Buy", path: "/buy" },
  { value: "rent", label: "Rent", path: "/rent" },
  { value: "off_plan", label: "Off-plan", path: "/off-plan" },
  { value: "commercial", label: "Commercial", path: "/commercial" },
] as const;

/**
 * Sprint 4 (backfilled): mode segmented control rendered inside the
 * filter bar on /buy /rent /off-plan /commercial. Switches between modes
 * while preserving every other filter in the querystring.
 */
export function ModeSegmented() {
  const router = useRouter();
  const pathname = usePathname() ?? "/buy";

  function go(path: string) {
    if (path === pathname) return;
    const qs =
      typeof window !== "undefined" ? window.location.search : "";
    router.push(`${path}${qs}`);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Search mode"
      className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {MODES.map(({ value, label, path }) => {
        const active = pathname === path;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => go(path)}
            className={cn(
              "h-8 px-3 rounded text-[12.5px] transition-colors",
              active
                ? "bg-bz-ink text-bz-bg font-medium"
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

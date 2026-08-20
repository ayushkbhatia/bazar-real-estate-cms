import type { ComponentProps, ReactNode } from "react";
import Link from "@/components/i18n/link";
import { cn } from "@/lib/utils";

const chipClass = (active: boolean | undefined, className?: string) =>
  cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[14px] border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
    active
      ? "border-bz-navy bg-bz-navy text-bz-bg"
      : "border-bz-border bg-bz-surface text-bz-ink-2 hover:border-bz-border-strong",
    className,
  );

/**
 * Filter pill / tag. 36px tall (sits in a 44px hit row via ChipGroup
 * padding). `active` inverts to the ink fill. Renders a Next `Link`
 * when `href` is set (nav chips) else a `<button>` (filter chips). No
 * "use client" — any onClick is supplied by the (client) consumer.
 */
export function Chip({
  active,
  href,
  className,
  children,
  ...props
}:
  | (ComponentProps<"button"> & { active?: boolean; href?: undefined })
  | (ComponentProps<typeof Link> & { active?: boolean; href: string })) {
  if (typeof href === "string") {
    const linkProps = props as Omit<ComponentProps<typeof Link>, "href">;
    return (
      <Link
        href={href}
        data-active={active || undefined}
        className={chipClass(active, className)}
        {...linkProps}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      data-active={active || undefined}
      className={chipClass(active, className)}
      {...(props as ComponentProps<"button">)}
    >
      {children}
    </button>
  );
}

/**
 * Horizontal scroller of Chips. Uses the flush rail (no edge bleed) so
 * it can drop into already-padded contexts (filter rows, status tabs).
 */
export function ChipGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("bz-rail bz-rail--flush items-center !gap-2 py-1", className)}>
      {children}
    </div>
  );
}

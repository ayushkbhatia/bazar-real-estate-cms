import type { ReactNode } from "react";
import Link from "@/components/i18n/link";
import { cn } from "@/lib/utils";

/**
 * Table-row → card (handoff pattern 4). Desktop CMS tables collapse to a
 * stack of these on mobile: a leading thumbnail/avatar, a title +
 * subtitle column, and a trailing slot (badge, chevron, overflow menu).
 * Renders as a Link when `href` is set, a button when `onClick` is set,
 * else a plain div. No "use client" — any handler comes from the
 * consumer.
 */
export function RowCard({
  href,
  onClick,
  leading,
  title,
  subtitle,
  meta,
  trailing,
  className,
}: {
  href?: string;
  onClick?: () => void;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      {leading != null && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-bz-ink">
          {title}
        </div>
        {subtitle != null && (
          <div className="mt-0.5 truncate text-[11.5px] text-bz-muted">
            {subtitle}
          </div>
        )}
        {meta != null && (
          <div className="mt-1 flex items-center gap-2 text-[12px] text-bz-ink-2">
            {meta}
          </div>
        )}
      </div>
      {trailing != null && (
        <div className="flex shrink-0 items-center">{trailing}</div>
      )}
    </>
  );

  const base =
    "flex w-full items-center gap-3 border-b border-bz-border py-3.5 text-start last:border-b-0";

  if (href) {
    return (
      <Link href={href} className={cn(base, "active:bg-bz-surface-2", className)}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, "active:bg-bz-surface-2", className)}
      >
        {inner}
      </button>
    );
  }
  return <div className={cn(base, className)}>{inner}</div>;
}

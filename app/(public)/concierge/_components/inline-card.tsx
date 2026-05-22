import Link from "next/link";
import { ArrowRight } from "lucide-react";

type CardKind = "property" | "article" | "development";

/**
 * Sprint 5c (backfilled): inline result card rendered inside a concierge
 * chat bubble. Compact 2-line layout so 2-3 cards fit per message.
 */
export function InlineCard({
  kind,
  title,
  subtitle,
  href,
  price,
}: {
  kind: CardKind;
  title: string;
  subtitle: string;
  href: string;
  price?: string;
}) {
  const KIND_LABEL: Record<CardKind, string> = {
    property: "Listing",
    article: "Article",
    development: "Development",
  };

  return (
    <Link
      href={href}
      target={kind === "article" ? "_self" : "_blank"}
      className="group block rounded-md border border-bz-border bg-bz-bg p-3 hover:border-bz-border-strong transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-wider text-bz-accent">
            {KIND_LABEL[kind]}
          </div>
          <div className="text-[13.5px] mt-0.5 text-bz-ink leading-snug truncate font-medium">
            {title}
          </div>
          <div className="text-[11.5px] text-bz-muted mt-0.5 truncate">
            {subtitle}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {price ? (
            <div className="mono text-[12px] text-bz-ink">{price}</div>
          ) : null}
          <ArrowRight
            size={12}
            strokeWidth={1.8}
            className="text-bz-muted group-hover:text-bz-ink"
          />
        </div>
      </div>
    </Link>
  );
}

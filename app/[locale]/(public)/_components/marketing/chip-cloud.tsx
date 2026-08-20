import Link from "@/components/i18n/link";
import { MapPin, ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Chip = string | { label: string; href?: string };

type Props = {
  chips: Chip[];
  icon?: LucideIcon | null;
  cta?: string;
  ctaHref?: string;
};

/**
 * Pill / chip cloud — areas, property types, community names. Optional leading
 * icon per pill and a trailing CTA (the handoff's `AreaChips`).
 */
export function ChipCloud({ chips, icon = MapPin, cta, ctaHref }: Props) {
  const Icon = icon;
  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {chips.map((c) => {
          const label = typeof c === "string" ? c : c.label;
          const href = typeof c === "string" ? undefined : c.href;
          const inner = (
            <>
              {Icon ? (
                <span className="text-bz-accent inline-flex">
                  <Icon size={15} strokeWidth={1.7} />
                </span>
              ) : null}
              {label}
            </>
          );
          const cls =
            "inline-flex items-center gap-2 h-10 px-4 rounded-full bg-bz-surface border border-bz-border text-[14px] hover:border-bz-teal transition-colors";
          return href ? (
            <Link key={label} href={href} className={cls}>
              {inner}
            </Link>
          ) : (
            <span key={label} className={cls}>
              {inner}
            </span>
          );
        })}
      </div>
      {cta ? (
        <Button
          asChild
          size="lg"
          className="mt-7 bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
        >
          <Link href={ctaHref ?? "/areas"}>
            {cta}
            <ArrowRight size={15} strokeWidth={1.7} />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

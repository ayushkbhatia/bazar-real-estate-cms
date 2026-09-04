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
          // h-11 on a phone, the original h-10 (40px) from `md` up. The
          // linked chips are <Link>s with no data-slot, so the
          // `(pointer: coarse)` 44px floor in globals.css never applied — and
          // 40px misses it by 4. The unlinked <span> variant shares `cls` and
          // grows with it: `href` is per-chip, so the two shapes can sit in the
          // same row and splitting the class would make that row ragged.
          const cls =
            "inline-flex items-center gap-2 h-11 md:h-10 px-4 rounded-full bg-bz-surface border border-bz-border text-[14px] hover:border-bz-teal transition-colors";
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
          className="mt-7 bg-bz-accent text-bz-accent-fg hover:bg-bz-accent-hover"
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

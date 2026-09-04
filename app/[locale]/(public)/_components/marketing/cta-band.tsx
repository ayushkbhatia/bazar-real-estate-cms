import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import { fluid } from "./fluid";

export type CtaVariant = "ink" | "accent" | "soft";

type Props = {
  eyebrow?: string | null;
  title: string;
  body?: string | null;
  ctaLabel: string;
  ctaHref: string;
  cta2Label?: string | null;
  cta2Href?: string | null;
  variant?: CtaVariant;
};

/**
 * Closing call to action.
 *
 * The three variants are a closed set on purpose. Each one pairs a surface with
 * the type colours that pass contrast against it, so there is no combination an
 * editor can pick that produces unreadable copy — which is why the publish gate
 * doesn't need a contrast check.
 *
 * Written from scratch rather than adapted from the unused
 * `_components/cta-banner.tsx`: that one imports the valuation tool's
 * `ValuationLeadGate`, and a generic catalogue block must not drag a stateful
 * feature component behind it.
 */
const SURFACE: Record<CtaVariant, string> = {
  ink: "bg-bz-navy text-white",
  accent: "bg-bz-accent-soft text-bz-ink",
  soft: "bg-bz-surface-2 text-bz-ink border-y border-bz-border",
};

const BODY: Record<CtaVariant, string> = {
  ink: "text-white/75",
  accent: "text-bz-ink-2",
  soft: "text-bz-ink-2",
};

const PRIMARY: Record<CtaVariant, string> = {
  ink: "bg-white text-bz-navy hover:bg-white/90",
  accent: "bg-bz-accent text-bz-accent-fg hover:bg-bz-accent-hover",
  soft: "bg-bz-accent text-bz-accent-fg hover:bg-bz-accent-hover",
};

const SECONDARY: Record<CtaVariant, string> = {
  ink: "border border-white/40 text-white hover:bg-white/10",
  accent: "border border-bz-ink/25 text-bz-ink hover:bg-bz-ink/5",
  soft: "border border-bz-border text-bz-ink hover:bg-bz-surface",
};

export function CtaBand({
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaHref,
  cta2Label,
  cta2Href,
  variant = "ink",
}: Props) {
  return (
    <section className={cn("px-4 md:px-12 py-14 md:py-20", SURFACE[variant])}>
      <div className="max-w-[1200px] grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-end [&>*]:min-w-0">
        <div>
          {eyebrow ? (
            <Eyebrow className={variant === "ink" ? "text-bz-taupe-light" : undefined}>
              {eyebrow}
            </Eyebrow>
          ) : null}
          <h2
            className="serif mt-3 max-w-[20ch]"
            style={{
              fontSize: fluid(44),
              letterSpacing: "-0.025em",
              lineHeight: 1.08,
            }}
          >
            {title}
          </h2>
          {body ? (
            <p
              className={cn(
                "mt-4 max-w-[54ch] text-[15px] md:text-[16px] leading-[1.7]",
                BODY[variant],
              )}
            >
              {body}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 md:justify-end">
          <Link
            href={ctaHref}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-md px-6 text-[14px] font-medium transition-colors",
              PRIMARY[variant],
            )}
          >
            {ctaLabel}
            <ArrowRight size={15} strokeWidth={1.8} />
          </Link>
          {cta2Label && cta2Href ? (
            <Link
              href={cta2Href}
              className={cn(
                "inline-flex h-12 items-center rounded-md px-6 text-[14px] font-medium transition-colors",
                SECONDARY[variant],
              )}
            >
              {cta2Label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

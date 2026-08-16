"use client";

import * as React from "react";
import { SectionHead } from "../../../_components/marketing/section-head";
import { cn } from "@/lib/utils";
import type { Preferences } from "@/lib/preferences";
import { formatMoneyValue } from "@/lib/preferences";

/**
 * What every section of the tool is handed, and what none of them own.
 *
 * The sections are presentational on purpose. One component upstream holds the
 * scenario — price, deposit, rate, term, type, status, income — because the
 * editor can put these in any order, and a section that owned part of the
 * scenario would take it off the page the moment someone switched that section
 * off. Compare would stop working because Amortization was hidden.
 */
export type SectionCopy = {
  eyebrow: string | null;
  title: string | null;
  intro: string | null;
};

/** The chrome every section shares: a rule, the head, and the page gutter. */
export function ToolSection({
  copy,
  children,
  className,
  surface,
  id,
  testId,
}: {
  copy: SectionCopy;
  children: React.ReactNode;
  className?: string;
  /** Tints the band, so consecutive sections don't read as one long column. */
  surface?: boolean;
  id?: string;
  testId?: string;
}) {
  return (
    <section
      id={id}
      data-testid={testId}
      className={cn(
        "px-4 md:px-12 py-12 md:py-16 border-t border-bz-border scroll-mt-24",
        surface && "bg-bz-surface",
        className,
      )}
    >
      <SectionHead
        eyebrow={copy.eyebrow ?? undefined}
        title={copy.title}
        sub={copy.intro ?? undefined}
        size={36}
      />
      <div className="mt-8 md:mt-10">{children}</div>
    </section>
  );
}

/** A figure in the visitor's currency. Non-finite input reads as zero. */
export function money(n: number, prefs: Preferences): string {
  return formatMoneyValue(Number.isFinite(n) ? n : 0, prefs);
}

/**
 * A fraction as a percentage, trimmed to one decimal.
 *
 * Kept here rather than in `lib/mortgage.ts` because it is a display rule, not
 * arithmetic: the model's own `pct()` formats to two decimals for the closing
 * table's fee schedule, where 0.25% is a real and different number from 0.3%.
 */
export function formatPct(p: number): string {
  if (!Number.isFinite(p)) return "0%";
  const v = p * 100;
  if (Math.abs(v - Math.round(v)) < 0.05) return `${Math.round(v)}%`;
  return `${v.toFixed(1)}%`;
}

/** Strip grouping and currency glyphs from a typed figure. */
export function parseMoneyInput(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * `{years}` in an editor's string, filled with the selected term.
 *
 * The amortization eyebrow reads "Amortization · 25 years" and the term is the
 * visitor's, so the stored string is a template. An editor who deletes the
 * token gets their sentence verbatim rather than an error — the same posture
 * as the `{category}` token on /insights.
 */
export function fillYears(template: string | null, years: number): string | null {
  if (!template) return null;
  return template.replaceAll("{years}", String(years));
}

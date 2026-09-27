"use client";

import { useTranslations } from "next-intl";
import { formatPrice, usePreferences } from "@/lib/preferences";
import { quarterArgs, type HandoverQuarter } from "@/lib/developments/handover";
import { SectionHead } from "./section-head";
import { fluid } from "./fluid";

export type ProjectFactsBandProps = {
  eyebrow: string | null;
  heading: string | null;
  intro: string | null;
  /** AED. Formatted here, in the visitor's currency. */
  startingPrice: number | null;
  /** The record's own range — "Studios, 1 - 3". */
  bedrooms: string | null;
  totalUnits: number | null;
  handover: HandoverQuarter | null;
  /** The plan's ratio — "60/40". */
  paymentPlan: string | null;
  /** `development.facts` entries, already ordered and whitelisted. */
  facts: { key: string; value: string }[];
};

/**
 * A project's headline figures, as a light band.
 *
 * The same five numbers the project page's hero carries — starting price,
 * bedrooms, total units, handover, payment plan — read from the record, so a
 * price change in Developments reaches the campaign without anyone retyping
 * it. Those five are required to publish a project, which is why this is the
 * one project section that always has something to say.
 *
 * Client-side for the same reason `PriceText` is: the price follows the
 * visitor's currency, which a server component cannot read without cookies()
 * and losing the page's ISR. The labels come from `development`, the one
 * project namespace that already crosses to the browser.
 *
 * Laid out like the area guides' statistics band: figure over label, a rule
 * above each, two across on a phone.
 */
export function ProjectFactsBand({
  eyebrow,
  heading,
  intro,
  startingPrice,
  bedrooms,
  totalUnits,
  handover,
  paymentPlan,
  facts,
}: ProjectFactsBandProps) {
  const t = useTranslations("development");
  const { prefs } = usePreferences();

  const figures = [
    startingPrice
      ? { key: "price", label: t("figures.startingPrice"), value: formatPrice(startingPrice, prefs) }
      : null,
    bedrooms ? { key: "beds", label: t("figures.bedrooms"), value: bedrooms } : null,
    totalUnits
      ? { key: "units", label: t("figures.totalUnits"), value: totalUnits.toLocaleString("en-US") }
      : null,
    handover
      ? { key: "handover", label: t("figures.handover"), value: t("card.quarter", quarterArgs(handover)) }
      : null,
    paymentPlan
      ? { key: "plan", label: t("figures.paymentPlan"), value: paymentPlan }
      : null,
  ].filter((f): f is { key: string; label: string; value: string } => f !== null);

  if (figures.length === 0 && facts.length === 0) return null;

  return (
    <section className="border-y border-bz-border bg-bz-surface px-4 md:px-12 py-12 md:py-20">
      <SectionHead
        eyebrow={eyebrow ?? undefined}
        title={heading ?? undefined}
        sub={intro ?? undefined}
        size={40}
      />
      {figures.length > 0 ? (
        <dl className="mt-8 md:mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-8 [&>*]:min-w-0">
          {figures.map((f) => (
            // Label first in the DOM so a screen reader hears "Handover, Q4
            // 2029"; the figure is drawn above it, as the stats bands do.
            <div
              key={f.key}
              className="flex flex-col-reverse gap-2.5 border-t border-bz-border pt-4"
            >
              <dt className="text-[11.5px] uppercase tracking-wider text-bz-muted leading-snug">
                {f.label}
              </dt>
              <dd
                className="serif leading-none text-bz-ink break-words"
                style={{ fontSize: fluid(34), letterSpacing: "-0.018em" }}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {facts.length > 0 ? (
        <dl className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {facts.map((f) => (
            <div
              key={f.key}
              className="p-[18px] bg-bz-surface-2 rounded-lg border border-bz-border"
            >
              <dt className="eyebrow">{t(`facts.${f.key}`)}</dt>
              <dd className="text-[16px] font-medium mt-1.5">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

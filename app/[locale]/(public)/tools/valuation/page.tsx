import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getForm } from "@/lib/queries/forms";
import { Check } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { listAreaOptions } from "@/lib/queries/areas";
import { asLocale } from "@/lib/i18n/locales";
import { ValuationWizard } from "./valuation-wizard";
import { ValuationLeadGate } from "./_components/lead-gate";

export const metadata: Metadata = {
  title: "Get a valuation",
  description:
    "An instant data-backed range from our model, then a senior advisor reviews and sends you a refined valuation within 24 hours. Free, no obligation.",
};

/**
 * The wizard and the lead gate are both client components, and the only
 * server-side read is the area list — cookie-free and slow-moving. The
 * `force-dynamic` this replaces dated from the tool's first sprint and nothing
 * on the page required it; it made this the slowest route on the site, at
 * ~5s TTFB, for content that is identical for every visitor.
 */
export const revalidate = 3600;

export default async function ValuationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  // Explicit locale, not the ambient one: an ambient `getTranslations` resolves
  // through `headers()`, which takes the route dynamic and silently discards
  // the `revalidate` above — the exact regression this page already paid for
  // once as a 5s TTFB.
  const t = await getTranslations({ locale, namespace: "tools" });

  const [areas, gateForm] = await Promise.all([
    listAreaOptions(),
    getForm("valuation_report_gate"),
  ]);

  const badges = [
    { h: t("valuation.badgeDmt"), s: t("valuation.badgeDmtSub") },
    { h: t("valuation.badgeReviewed"), s: t("valuation.badgeReviewedSub") },
    { h: t("valuation.badgeFree"), s: t("valuation.badgeFreeSub") },
  ];

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-8">
        <Eyebrow>{t("valuation.eyebrow")}</Eyebrow>
        <h1
          className="serif text-[36px] md:text-[64px] font-normal mt-3 leading-[1.0] max-w-[18ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {t("valuation.headingLead")}{" "}
          <em className="italic">{t("valuation.headingEmphasis")}</em>
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] text-bz-ink-2 leading-relaxed">
          {t("valuation.intro")}
        </p>

        <ul className="mt-7 flex flex-wrap gap-6 text-[13px] text-bz-muted">
          {badges.map((item) => (
            <li key={item.h} className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-bz-accent-soft text-bz-accent inline-flex items-center justify-center">
                <Check size={14} strokeWidth={2} />
              </span>
              <div>
                <div className="text-bz-ink font-medium text-[13.5px]">
                  {item.h}
                </div>
                <div className="text-[11.5px]">{item.s}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* T1-E shortcut CTA: skip the wizard, just request the advisor
            report directly. The wizard still runs the instant estimate for
            anyone who wants the dopamine first. */}
        <div className="mt-8 inline-flex gap-3 items-center">
          {gateForm.enabled ? (
            <ValuationLeadGate
              form={gateForm}
              triggerLabel={t("valuation.skipTrigger")}
            />
          ) : null}
          <span className="text-[12.5px] text-bz-muted">
            {t("valuation.skipNote")}
          </span>
        </div>
      </section>

      <ValuationWizard areas={areas} />
    </div>
  );
}

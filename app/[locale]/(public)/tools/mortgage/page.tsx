import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getForm } from "@/lib/queries/forms";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str } from "@/lib/master-pages";
import {
  getPublicMortgageSettings,
  toMortgageAssumptions,
} from "@/lib/queries/site-settings";
import { asLocale } from "@/lib/i18n/locales";
import { MortgageCalculator } from "./mortgage-calculator";

export const metadata: Metadata = {
  title: "Mortgage calculator",
  description:
    "All-in mortgage maths for Abu Dhabi: monthly payment, true cash to close (DLD, trustee, valuation, advisory), affordability check against Central Bank UAE DBR rules, and side-by-side scenario compare.",
};

export default async function MortgagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);

  // Resolved here rather than inside the calculator because all three are
  // server reads and the calculator is a client component — a `ResolvedForm`,
  // a folded `SectionValues` bag and the assumptions object are all plain JSON
  // and cross the boundary intact, the same way the dialogs do it.
  const [preApprovalForm, content, mortgage] = await Promise.all([
    getForm("mortgage_preapproval"),
    getMasterPageContent("mortgage", locale),
    getPublicMortgageSettings(),
  ]);

  const hero = content.section("hero")?.values ?? {};
  const band = content.section("pre_approval")?.values ?? {};

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-6">
        {str(hero, "eyebrow") ? <Eyebrow>{str(hero, "eyebrow")}</Eyebrow> : null}
        <h1
          className="serif text-[36px] md:text-[64px] font-normal mt-3 leading-[1.0] max-w-[16ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {/*
            Lead plus emphasis, the same two-field shape `service-hero.tsx` and
            `master-content.tsx` already use for their DB-authored headings. It
            pins the italic run to the end of the sentence, which is a real
            constraint in Arabic — but it is the constraint the CMS-authored
            heroes already carry, so the translator meets one convention rather
            than two.
          */}
          {str(hero, "title")}{" "}
          {str(hero, "title_emphasis") ? (
            <em className="italic">{str(hero, "title_emphasis")}</em>
          ) : null}
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] text-bz-ink-2 leading-relaxed">
          {str(hero, "intro")}
        </p>
      </section>

      <MortgageCalculator
        preApprovalForm={preApprovalForm}
        assumptions={toMortgageAssumptions(mortgage)}
        opening={{
          priceAed: mortgage.default_price_aed,
          downPaymentPct: mortgage.default_down_payment_pct / 100,
          ratePct: mortgage.default_rate_pct,
          termYears: mortgage.default_term_years,
          annualIncomeAed: mortgage.default_annual_income_aed,
        }}
        // The whole band is one section, so it travels as one object rather
        // than nine props — a field added to it in the registry reaches the
        // component without a signature change.
        band={{
          enabled: content.section("pre_approval")?.enabled ?? true,
          eyebrow: str(band, "eyebrow"),
          title: str(band, "title"),
          sub: str(band, "sub"),
          scenarioLabel: str(band, "scenario_label"),
          scenarioNote: str(band, "scenario_note"),
          talkLabel: str(band, "talk_label"),
          advisorCtaLabel: str(band, "advisor_cta_label"),
          advisorCtaHref: str(band, "advisor_cta_href") ?? "/contact",
          whatsappCtaLabel: str(band, "whatsapp_cta_label"),
          fallbackCtaLabel: str(band, "fallback_cta_label"),
        }}
      />
    </div>
  );
}

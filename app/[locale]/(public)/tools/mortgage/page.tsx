import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getForm } from "@/lib/queries/forms";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { img, str } from "@/lib/master-pages";
import {
  getPublicMortgageSettings,
  toMortgageAssumptions,
} from "@/lib/queries/site-settings";
import { asLocale } from "@/lib/i18n/locales";
import type { SectionValues } from "@/lib/master-pages";
import { MortgageCalculator } from "./mortgage-calculator";

export const metadata: Metadata = {
  title: "Mortgage calculator",
  description:
    "All-in mortgage maths for Abu Dhabi: monthly payment, true cash to close (DLD, trustee, valuation, advisory), affordability check against Central Bank UAE DBR rules, and side-by-side scenario compare.",
};

/** The three fields every output section carries. */
function head(v: SectionValues) {
  return {
    eyebrow: str(v, "eyebrow"),
    title: str(v, "title"),
    intro: str(v, "intro"),
  };
}

export default async function MortgagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);

  // All three are server reads and the tool is a client component — a
  // `ResolvedForm`, a folded `SectionValues` bag and the assumptions object
  // are plain JSON and cross the boundary intact, the same way the dialogs
  // do it.
  const [preApprovalForm, content, mortgage] = await Promise.all([
    getForm("mortgage_preapproval"),
    getMasterPageContent("mortgage", locale),
    getPublicMortgageSettings(),
  ]);

  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const bandV = v("pre_approval");
  const heroImage = img(heroV, "image");

  return (
    <div className="bg-bz-bg">
      {/*
        Every section — the hero included — is rendered by the client component
        rather than assembled here. The pre-approval form carries the visitor's
        live scenario as submit context, and the hero is one of the two places
        it can be drawn, so the hero has to sit inside the component that holds
        the scenario. Splitting it would mean lifting that state to a provider
        for the sake of one heading.
      */}
      <MortgageCalculator
        order={content.order}
        hero={{
          eyebrow: str(heroV, "eyebrow"),
          title: str(heroV, "title"),
          titleEmphasis: str(heroV, "title_emphasis"),
          sub: str(heroV, "sub"),
          imageUrl: heroImage?.url ?? null,
          imageAlt: heroImage?.alt ?? null,
          showForm: heroV.show_form !== false,
        }}
        scenario={head(v("scenario"))}
        affordabilityCopy={head(v("affordability"))}
        compare={head(v("compare"))}
        amortization={head(v("amortization"))}
        cashToCloseCopy={head(v("cash_to_close"))}
        preApproval={{
          eyebrow: str(bandV, "eyebrow"),
          title: str(bandV, "title"),
          sub: str(bandV, "sub"),
          scenarioLabel: str(bandV, "scenario_label"),
          scenarioNote: str(bandV, "scenario_note"),
          talkLabel: str(bandV, "talk_label"),
          advisorCtaLabel: str(bandV, "advisor_cta_label"),
          advisorCtaHref: str(bandV, "advisor_cta_href") ?? "/contact",
          whatsappCtaLabel: str(bandV, "whatsapp_cta_label"),
          fallbackCtaLabel: str(bandV, "fallback_cta_label"),
          jumpCtaLabel: str(bandV, "jump_cta_label"),
        }}
        preApprovalForm={preApprovalForm}
        assumptions={toMortgageAssumptions(mortgage)}
        opening={{
          priceAed: mortgage.default_price_aed,
          downPaymentPct: mortgage.default_down_payment_pct / 100,
          ratePct: mortgage.default_rate_pct,
          termYears: mortgage.default_term_years,
          annualIncomeAed: mortgage.default_annual_income_aed,
        }}
      />
    </div>
  );
}

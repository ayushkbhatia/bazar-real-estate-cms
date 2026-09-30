import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getForm } from "@/lib/queries/forms";
import { isMortgageFlowPublic, MORTGAGE_ENTRY_LINKS } from "@/lib/queries/mortgage-flow";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { img, str } from "@/lib/master-pages";
import {
  getPublicMortgageSettings,
  toMortgageAssumptions,
} from "@/lib/queries/site-settings";
import { asLocale } from "@/lib/i18n/locales";
import type { SectionValues } from "@/lib/master-pages";
import { MortgageCalculator } from "./mortgage-calculator";
import { masterPageMetadata } from "@/lib/queries/search-appearance";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → this page →
  // Search appearance. Unedited, they fall back to the strings that used
  // to be the literal here, now in MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("mortgage", asLocale((await params).locale));
}

/** The three fields every output section carries. */
/**
 * "Talk to advisor": the link an editor set wins; the shipped default
 * (/contact, which ignores what the visitor came for) gives way to the
 * consultancy flow once it's open (SPEC §4.1 "Mortgage calculator · Talk to
 * advisor").
 */
function advisorHref(stored: string | null, flowOpen: boolean): string {
  if (flowOpen && (!stored || stored === "/contact")) return MORTGAGE_ENTRY_LINKS.calculatorAdvisor;
  return stored ?? "/contact";
}

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
  const [storedForm, content, mortgage, flowOpen] = await Promise.all([
    getForm("mortgage_preapproval"),
    getMasterPageContent("mortgage", locale),
    getPublicMortgageSettings(),
    isMortgageFlowPublic(),
  ]);
  // Once the mortgage application flow is open (docs/mortgage, D25), its
  // buttons replace the old pre-approval form, which filed an enquiry and
  // nothing more: the form stops drawing here and in the hero.
  const preApprovalForm = flowOpen ? { ...storedForm, enabled: false } : storedForm;

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
          advisorCtaHref: advisorHref(str(bandV, "advisor_cta_href"), flowOpen),
          flowHref: flowOpen ? MORTGAGE_ENTRY_LINKS.calculatorPreApproval : null,
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

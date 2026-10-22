import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { RouteMessages } from "@/lib/i18n/route-messages";
import { asLocale } from "@/lib/i18n/locales";
import { getPublicBranding } from "@/lib/queries/site-settings";
import { getMortgageMessages, getMortgageTranslator, getMortgageWizardOverlay } from "@/lib/queries/wizards";
import { WizardFlowProvider } from "./_components/wizard-flow";
import { FlowFooter, FlowTopBar } from "./_components/shell";
import "./mortgage.css";

/**
 * The mortgage application flow (docs/mortgage, W1–W8): its own route group,
 * so it gets a quiet shell of its own instead of the marketplace chrome.
 *
 * The application itself is behind the `mortgage_requests` flag
 * (apply/layout.tsx). The secure links under /mortgages/r/ are not: each is
 * sent by the team to one applicant already in the system, and switching
 * intake off mustn't strand them. The group is dynamic and never prerendered.
 *
 * In English and Arabic (D12; Arabic since 22 Oct 2026): `/ar/mortgages/…`
 * is the same flow, right to left, in the words of `messages/ar/mortgage.json`
 * with the Arabic an editor wrote in Pages & blocks → Wizards laid over them.
 * `[locale]/layout.tsx` sets `lang` and `dir` on the document.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getMortgageTranslator(locale);
  return {
    title: t("shell.section"),
    // An application form has no business in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function MortgageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);

  // The words and switches an editor set in Pages & blocks → Wizards, laid over the catalogue.
  const [branding, overlay, messages] = await Promise.all([
    getPublicBranding(locale),
    getMortgageWizardOverlay(locale),
    getMortgageMessages(locale),
  ]);
  const logo = branding.logo_url
    ? { url: branding.logo_url, style: branding.logo_style, name: branding.brand_name }
    : null;

  return (
    <RouteMessages locale={locale} namespaces={["mortgage"]} overrides={{ mortgage: messages }}>
      <WizardFlowProvider flow={overlay.flow} docArt={overlay.docArt}>
        <div className="mrq flex min-h-dvh flex-1 flex-col bg-bz-bg text-bz-ink">
          <FlowTopBar locale={locale} logo={logo} />
          {children}
          <FlowFooter locale={locale} />
        </div>
      </WizardFlowProvider>
    </RouteMessages>
  );
}

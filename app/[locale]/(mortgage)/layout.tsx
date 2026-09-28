import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RouteMessages } from "@/lib/i18n/route-messages";
import { asLocale, DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getPublicBranding } from "@/lib/queries/site-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerIsStaff, readFlag } from "@/lib/mortgage-requests/server/http";
import { FlowFooter, FlowTopBar } from "./_components/shell";
import "./mortgage.css";

/**
 * The mortgage application flow (docs/mortgage, W1–W8): its own route group,
 * so it gets a quiet shell of its own instead of the marketplace chrome.
 *
 * Behind the `mortgage_requests` flag (SPEC §4.1; `mortgage_settings.flag`):
 * off, every route here is a 404; staff, only signed-in staff see it; public,
 * everyone. Read per request, so flipping it in the CMS needs no deploy —
 * which is also why the group is dynamic and never prerendered.
 *
 * English only for now (D12): proxy.ts sends `/ar/mortgages/…` back to
 * English, and this refuses to render a non-English tree in case anything
 * reaches it another way.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "mortgage" });
  return {
    title: t("shell.section"),
    // An application form has no business in a search index.
    robots: { index: false, follow: false },
  };
}

async function flowOpen(): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const flag = await readFlag(db);
  if (flag === "public") return true;
  return flag === "staff" && (await callerIsStaff(db));
}

export default async function MortgageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  if (locale !== DEFAULT_LOCALE) notFound();
  setRequestLocale(locale);
  if (!(await flowOpen())) notFound();

  const branding = await getPublicBranding(locale);
  const logo = branding.logo_url
    ? { url: branding.logo_url, style: branding.logo_style, name: branding.brand_name }
    : null;

  return (
    <RouteMessages locale={locale} namespaces={["mortgage"]}>
      <div className="mrq flex min-h-dvh flex-1 flex-col bg-bz-bg text-bz-ink">
        <FlowTopBar locale={locale} logo={logo} />
        {children}
        <FlowFooter locale={locale} />
      </div>
    </RouteMessages>
  );
}

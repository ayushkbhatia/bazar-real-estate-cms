import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { DirectionProvider } from "./_direction-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/lib/posthog";
import { PreferencesProvider } from "@/lib/preferences";
import { ConsentProvider } from "@/app/_consent/consent-provider";
import { CookieBanner } from "@/app/_consent/cookie-banner";
import { VercelAnalyticsGate } from "@/app/_consent/analytics-gate";
import { organizationJsonLd } from "@/lib/jsonld";
import { getPublicBranding } from "@/lib/queries/site-settings";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  LOCALES,
  LOCALE_DIR,
  isEnabledLocale,
  type Locale,
} from "@/lib/i18n/locales";
import "../globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Every canonical, OG and Twitter URL on the site resolves against this. It was
 * hardcoded to the project's original vercel.app host, which no longer resolves
 * — production is www.bazarrealestate.ae — so the live site was publishing
 * canonicals and share cards pointing at a 404. Read the same env var that
 * robots.ts, sitemap.ts and the transactional emails already use, so there is
 * one place to change the host.
 */
const SITE_URL = env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae";

/** Shipped fallback, served from /public. Used whenever the CMS has no icon. */
const DEFAULT_FAVICON = "/favicon.ico";

/**
 * `generateMetadata`, not a static `metadata` export, because the favicon is
 * CMS-editable (/admin/settings/brand) and therefore a database read.
 *
 * The icon links are declared here rather than through the `app/favicon.ico`
 * file convention — that convention emits its own `<link rel="icon">` which
 * cannot be turned off, so the CMS icon and the shipped default would both be
 * in the head with the winner left to browser heuristics. The .ico now lives
 * in /public: still served at /favicon.ico for the implicit request browsers
 * make anyway, but no longer injecting a tag that competes with this one.
 *
 * `getPublicBranding` uses the cookie-free anon client, so this does not opt
 * routes into dynamic rendering — the value is baked at build and busted by
 * the `revalidatePath("/", "layout")` in the brand settings action.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { favicon_url } = await getPublicBranding();
  const icon = favicon_url ?? DEFAULT_FAVICON;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "Bazar Real Estate — Abu Dhabi, properly understood",
      template: "%s · Bazar",
    },
    description:
      "Bespoke real estate advisory and a curated marketplace for buyers, sellers, and investors across the United Arab Emirates.",
    openGraph: {
      type: "website",
      locale: "en_AE",
      siteName: "Bazar Real Estate",
    },
    icons: {
      icon,
      shortcut: icon,
      // Home-screen bookmarks want a bigger square than a tab strip does. We
      // only have one uploaded file, so it serves both; iOS scales it.
      apple: icon,
    },
  };
}

// `viewport-fit=cover` is required for env(safe-area-inset-*) to report
// non-zero on notched / home-indicator devices — the mobile sticky bars
// and CMS bottom tab bar rely on it (see globals.css --bz-bar-safe).
/**
 * Prerender one tree per served locale.
 *
 * `LOCALES` is the *served* list, not every locale the code knows — Arabic is
 * written and reviewable but not served until P3, so nothing under `/ar` is
 * built or indexed yet. Flipping it there is a one-line change in
 * lib/i18n/locales.ts.
 */
export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  // Preferences provider initialises with defaults; the client effect in
  // PreferencesProvider rehydrates from cookie/localStorage on mount. We
  // deliberately do NOT call `cookies()` here because that would opt every
  // page (including statically-cached /about etc.) into dynamic rendering.
  // The brief render flicker — only visible for non-AED/ft² users — is the
  // trade-off; addressing it would mean either a script-tag preamble or
  // moving the provider down to (public)/layout.tsx (a meaningful refactor
  // for marginal benefit). Documented as a Tier-1 follow-up.
  //
  // Reading `params` does NOT have that cost: the segment is part of the
  // route, so it is known at build time and every page below stays static.
  // scripts/ci/assert-static-routes.mjs is what proves that claim.
  const { locale: raw } = await params;
  if (!isEnabledLocale(raw)) notFound();
  const locale: Locale = raw;

  // Required on 16.2.6: without it every page below this layout opts into
  // dynamic rendering the moment it touches a next-intl API, silently
  // discarding its `revalidate`. The page still renders, it just stops being
  // cached, so nothing surfaces until the bill does.
  // scripts/ci/assert-static-routes.mjs is what actually catches a missed one.
  setRequestLocale(locale);

  // Dynamically imported so the Arabic woff2 and its preload tag never reach
  // an English page. See app/[locale]/_fonts-ar.ts.
  const arabic =
    LOCALE_DIR[locale] === "rtl"
      ? (await import("./_fonts-ar")).plexArabic
      : null;

  return (
    <html
      lang={locale}
      dir={LOCALE_DIR[locale]}
      className={cn(
        geist.variable,
        instrumentSerif.variable,
        jetbrainsMono.variable,
        arabic?.variable,
        "h-full",
      )}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd()),
          }}
        />
      </head>
      <body className="min-h-dvh-safe flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <ConsentProvider>
            {/*
            Two direction mechanisms, both required and not interchangeable.
            CSS `direction` is inherited through the DOM, which is why `dir`
            sits on <html> — that is what portalled content (dialogs, popovers,
            the map canvas) computes against. Radix instead reads React
            context and hard-defaults to "ltr" when no provider is mounted, so
            <html dir> alone is invisible to it.
          */}
            <DirectionProvider dir={LOCALE_DIR[locale]}>
              <NuqsAdapter>
                <PostHogProvider locale={locale}>
                  <PreferencesProvider>
                    <TooltipProvider delayDuration={150}>
                      {children}
                    </TooltipProvider>
                  </PreferencesProvider>
                </PostHogProvider>
              </NuqsAdapter>
              {/* sonner reads document.documentElement.dir, which is set above. */}
              <Toaster
                richColors
                closeButton
                dir="auto"
                position={
                  LOCALE_DIR[locale] === "rtl" ? "bottom-left" : "bottom-right"
                }
              />
              <VercelAnalyticsGate />
              <CookieBanner />
            </DirectionProvider>
          </ConsentProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

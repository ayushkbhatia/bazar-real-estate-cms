import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/lib/posthog";
import { PreferencesProvider } from "@/lib/preferences";
import { ConsentProvider } from "./_consent/consent-provider";
import { CookieBanner } from "./_consent/cookie-banner";
import { VercelAnalyticsGate } from "./_consent/analytics-gate";
import { organizationJsonLd } from "@/lib/jsonld";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://bazar-real-estate-cms.vercel.app"),
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
};

// `viewport-fit=cover` is required for env(safe-area-inset-*) to report
// non-zero on notched / home-indicator devices — the mobile sticky bars
// and CMS bottom tab bar rely on it (see globals.css --bz-bar-safe).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Preferences provider initialises with defaults; the client effect in
  // PreferencesProvider rehydrates from cookie/localStorage on mount. We
  // deliberately do NOT call `cookies()` here because that would opt every
  // page (including statically-cached /about etc.) into dynamic rendering.
  // The brief render flicker — only visible for non-AED/ft² users — is the
  // trade-off; addressing it would mean either a script-tag preamble or
  // moving the provider down to (public)/layout.tsx (a meaningful refactor
  // for marginal benefit). Documented as a Tier-1 follow-up.

  return (
    <html
      lang="en"
      className={`${geist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full`}
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
        <ConsentProvider>
          <NuqsAdapter>
            <PostHogProvider>
              <PreferencesProvider>
                <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
              </PreferencesProvider>
            </PostHogProvider>
          </NuqsAdapter>
          <Toaster richColors closeButton position="bottom-right" />
          <VercelAnalyticsGate />
          <CookieBanner />
        </ConsentProvider>
      </body>
    </html>
  );
}

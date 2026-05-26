import type { Metadata } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/lib/posthog";
import { PreferencesProvider } from "@/lib/preferences";
import { readPreferencesFromCookie } from "@/lib/preferences/server";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Seed the preferences provider from the cookie so SSR matches first paint.
  // Phase 2 of T1-B: makes the popover SSR-stable.
  const initialPrefs = await readPreferencesFromCookie();

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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ConsentProvider>
          <NuqsAdapter>
            <PostHogProvider>
              <PreferencesProvider initial={initialPrefs}>
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

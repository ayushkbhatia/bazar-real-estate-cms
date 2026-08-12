import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { DEFAULT_LOCALE, LOCALE_DIR } from "@/lib/i18n/locales";
import "./globals.css";

/**
 * The 404 for URLs that match no route at all.
 *
 * Next's own guidance names our exact situation: `global-not-found` exists for
 * when "your root layout is defined using top-level dynamic segments (e.g.
 * `app/[country]/layout.tsx`), which makes composing a consistent 404 page
 * harder." Our root layout is `app/[locale]/layout.tsx`, so a request to
 * `/fr/buy` or `/nonsense` has no locale to resolve and therefore no layout to
 * render `not-found.tsx` into.
 *
 * It bypasses the app's normal rendering entirely, which is why the font and
 * stylesheet are imported here rather than inherited. Deliberately minimal:
 * no providers, no nav, no DB reads — this page must render when nothing else
 * can, including when Supabase is unreachable.
 *
 * English by necessity, not by choice: there is no locale in the URL to read.
 * `app/[locale]/not-found.tsx` is the localised one, and it handles every
 * `notFound()` thrown from inside a route that *did* resolve a locale.
 */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Page not found · Bazar",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html
      lang={DEFAULT_LOCALE}
      dir={LOCALE_DIR[DEFAULT_LOCALE]}
      className={`${geist.variable} h-full`}
    >
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        <main className="min-h-[60vh] flex flex-1 items-center justify-center px-6 py-16">
          <div className="max-w-xl w-full">
            <p className="eyebrow">404 · Not found</p>
            <h1 className="serif text-4xl mt-3 mb-4">
              This page isn&rsquo;t here.
            </h1>
            <p className="text-bz-ink-2 mb-8">
              The link may be out of date, or the page has been moved. The home
              page is the quickest way back to the catalogue.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Return home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}

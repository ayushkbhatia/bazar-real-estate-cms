import type { Metadata } from "next";
import { LegalDocFrame } from "../_layout";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie policy",
  description:
    "What cookies Bazar uses, why, and how to control them. PDPL-aligned essential/analytics/marketing categories.",
};

const COOKIES = [
  {
    name: "bz_consent",
    category: "Essential",
    purpose:
      "Records your cookie-banner choice (essential / analytics / marketing).",
    retention: "12 months",
    provider: "Bazar",
  },
  {
    name: "sb-* (Supabase session)",
    category: "Essential",
    purpose:
      "Keeps you signed in across requests; protects against CSRF on server actions.",
    retention: "30 days rolling",
    provider: "Supabase",
  },
  {
    name: "ph_*",
    category: "Analytics",
    purpose:
      "PostHog product analytics — pageviews, button clicks, page-leave events.",
    retention: "12 months",
    provider: "PostHog",
  },
  {
    name: "_vercel_analytics",
    category: "Analytics",
    purpose: "Vercel Analytics — pageview and web-vitals telemetry.",
    retention: "13 months",
    provider: "Vercel",
  },
];

export default function CookiesPage() {
  return (
    <LegalDocFrame active="cookies" title="Cookie policy" effective="22 May 2026">
      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files a website stores on your device to
        remember information between visits. We also use similar
        technologies (local storage, pixels) for the same purposes — this
        policy covers all of them under &quot;cookies&quot; for simplicity.
      </p>

      <h2>2. How We Use Cookies</h2>
      <p>
        We use three categories. Essential cookies are required for the site
        to function and are always on. Analytics and marketing cookies are
        off until you accept them in the consent banner, and you can
        withdraw consent at any time.
      </p>
      <ul>
        <li>
          <b>Essential</b> — sign-in, CSRF protection, your cookie-banner
          choice. These can&apos;t be disabled without breaking core
          functionality.
        </li>
        <li>
          <b>Analytics</b> — PostHog and Vercel Analytics, used to understand
          which listings and pages work, and to improve search relevance.
        </li>
        <li>
          <b>Marketing</b> — retargeting pixels. None currently wired;
          reserved for future use. Off by default and will require a policy
          update and fresh consent before activation.
        </li>
      </ul>

      <h2>3. Specific Cookies</h2>
      <div className="not-prose my-6 overflow-x-auto -mx-2">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] uppercase tracking-widest text-bz-muted-2 border-b border-bz-border">
              <th className="py-2 pl-2 pr-3">Name</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Provider</th>
              <th className="py-2 pr-3">Purpose</th>
              <th className="py-2 pr-3">Retention</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((c) => (
              <tr key={c.name} className="border-b border-bz-border align-top">
                <td className="py-3 pl-2 pr-3 mono text-[12px] whitespace-nowrap">
                  {c.name}
                </td>
                <td className="py-3 pr-3">{c.category}</td>
                <td className="py-3 pr-3">{c.provider}</td>
                <td className="py-3 pr-3 text-bz-ink-2">{c.purpose}</td>
                <td className="py-3 pr-3 text-bz-muted whitespace-nowrap">
                  {c.retention}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        We&apos;ll add a row here (and bump the effective date) before
        activating any new cookie, including marketing pixels.
      </p>

      <h2>4. Third-Party Cookies</h2>
      <p>
        Some cookies above are set by vendors we use to run the Service
        (Supabase, PostHog, Vercel), not by Bazar directly. Their processing
        of data collected via cookies is also covered by our{" "}
        <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>

      <h2>5. Managing Your Preferences</h2>
      <p>
        You can change your cookie choice at any time. The banner re-opens
        whenever the policy is materially revised. To reset your preference
        before then, clear the <code>bz_consent</code> cookie from your
        browser and reload the page; the banner will reappear. You can also
        block cookies entirely in your browser settings, though this may
        break sign-in and saved searches.
      </p>

      <h2>6. Do-Not-Track / Global Privacy Control</h2>
      <p>
        We respect the browser&apos;s Global Privacy Control signal where it
        is present: when GPC is set, analytics and marketing default to off
        regardless of your prior choice.
      </p>

      <h2>7. Changes to This Policy</h2>
      <p>
        We&apos;ll update the effective date whenever this policy changes
        materially, and re-surface the consent banner if the change affects
        what we collect.
      </p>

      <h2>8. Questions</h2>
      <p>
        Email{" "}
        <a href="mailto:dpo@bazarrealestate.ae">dpo@bazarrealestate.ae</a>{" "}
        with any questions about the cookies we use or your stored
        preferences.
      </p>
    </LegalDocFrame>
  );
}

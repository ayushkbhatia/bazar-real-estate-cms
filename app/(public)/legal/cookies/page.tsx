import type { Metadata } from "next";
import { LegalDocFrame } from "../_layout";

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
      <h2>The short version</h2>
      <p>
        We use three categories of cookies. Essential ones are required for the
        site to function and are always on. Analytics and marketing cookies are
        off until you accept them in the consent banner.
      </p>
      <ul>
        <li>
          <b>Essential</b> — sign-in, CSRF protection, your cookie-banner
          choice.
        </li>
        <li>
          <b>Analytics</b> — PostHog and Vercel Analytics, used to understand
          which listings and pages work.
        </li>
        <li>
          <b>Marketing</b> — retargeting pixels (none currently wired). Off by
          default.
        </li>
      </ul>

      <h2>Specific cookies</h2>
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

      <h2>Changing your choice</h2>
      <p>
        You can change your cookie choice at any time. The banner re-opens
        whenever the policy is materially revised. To reset your preference
        before then, clear the <code>bz_consent</code> cookie from your browser
        and reload the page; the banner will reappear.
      </p>

      <h2>Do-not-track</h2>
      <p>
        We respect the browser&apos;s Global Privacy Control signal where it is
        present: when GPC is set, analytics and marketing default to off
        regardless of your prior choice.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:dpo@bazar.ae">dpo@bazar.ae</a> with any
        questions about the cookies we use or your stored preferences.
      </p>
    </LegalDocFrame>
  );
}

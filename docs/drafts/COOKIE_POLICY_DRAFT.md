# Bazar Real Estate — Cookie Policy (Draft)

**Effective date:** [to confirm on publish]
**Last reviewed:** 8 July 2026

> Draft for review. Benchmarked against Allsopp & Allsopp, Haus & Haus, and
> Metropolitan Properties cookie pages (what-are-cookies primer, category
> breakdown, per-cookie table, opt-out mechanics, do-not-track), rewritten
> against Bazar's actual cookie inventory. Structure and cookie table match
> the current `app/[locale]/(public)/legal/cookies/page.tsx` implementation — content
> is expanded, not replaced. Once approved this replaces the copy in that
> file.

---

## 1. What Are Cookies

Cookies are small text files a website stores on your device to remember
information between visits. We also use similar technologies (local
storage, pixels) for the same purposes — this policy covers all of them
under "cookies" for simplicity.

## 2. How We Use Cookies

We use three categories. Essential cookies are required for the site to
function and are always on. Analytics and marketing cookies are off until
you accept them in the consent banner, and you can withdraw consent at any
time.

- **Essential** — sign-in, CSRF protection, your cookie-banner choice.
  These can't be disabled without breaking core functionality.
- **Analytics** — PostHog and Vercel Analytics, used to understand which
  listings and pages work, and to improve search relevance.
- **Marketing** — retargeting pixels. None currently wired; reserved for
  future use. Off by default and will require a policy update and fresh
  consent before activation.

## 3. Specific Cookies

| Name | Category | Provider | Purpose | Retention |
|---|---|---|---|---|
| `bz_consent` | Essential | Bazar | Records your cookie-banner choice (essential / analytics / marketing) | 12 months |
| `sb-*` (Supabase session) | Essential | Supabase | Keeps you signed in across requests; protects against CSRF on server actions | 30 days rolling |
| `ph_*` | Analytics | PostHog | Product analytics — pageviews, button clicks, page-leave events | 12 months |
| `_vercel_analytics` | Analytics | Vercel | Pageview and web-vitals telemetry | 13 months |

We'll add a row here (and bump the effective date) before activating any
new cookie, including marketing pixels.

## 4. Third-Party Cookies

Some cookies above are set by vendors we use to run the Service (Supabase,
PostHog, Vercel), not by Bazar directly. Their processing of data collected
via cookies is also covered by our [Privacy Policy](/legal/privacy) vendor
list.

## 5. Managing Your Preferences

You can change your cookie choice at any time. The banner re-opens whenever
the policy is materially revised. To reset your preference before then,
clear the `bz_consent` cookie from your browser and reload the page; the
banner will reappear. You can also block cookies entirely in your browser
settings, though this may break sign-in and saved searches.

## 6. Do-Not-Track / Global Privacy Control

We respect the browser's Global Privacy Control signal where it is present:
when GPC is set, analytics and marketing default to off regardless of your
prior choice.

## 7. Changes to This Policy

We'll update the effective date whenever this policy changes materially,
and re-surface the consent banner if the change affects what we collect.

## 8. Questions

Email [dpo@bazarrealestate.ae](mailto:dpo@bazarrealestate.ae) with any
questions about the cookies we use or your stored preferences.

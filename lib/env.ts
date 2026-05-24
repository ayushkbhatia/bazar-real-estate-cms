import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_ADDRESS: z.string().email().optional(),
  RESEND_REPLY_TO: z.string().email().optional(),
  CRON_SECRET: z.string().min(1).optional(),
  // Upstash Redis credentials for per-IP rate limiting. Both optional —
  // when absent, lib/rate-limit no-ops so dev/test still work.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Sprint 12 integrations
  MEILISEARCH_HOST: z.string().url().optional(),
  MEILISEARCH_API_KEY: z.string().min(1).optional(),
  VOYAGE_API_KEY: z.string().min(1).optional(),
  // Sprint 13 integrations
  MAILCHIMP_API_KEY: z.string().min(1).optional(),
  MAILCHIMP_LIST_ID: z.string().min(1).optional(),
  MAILCHIMP_DC: z.string().min(1).optional(), // datacenter, e.g. 'us21'
  MAILCHIMP_WEBHOOK_SECRET: z.string().min(1).optional(),
  DOCUSIGN_INTEGRATION_KEY: z.string().min(1).optional(),
  DOCUSIGN_USER_ID: z.string().min(1).optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().min(1).optional(),
  DOCUSIGN_PRIVATE_KEY: z.string().min(1).optional(),
  DOCUSIGN_BASE_URL: z.string().url().optional(),
  DOCUSIGN_WEBHOOK_SECRET: z.string().min(1).optional(),
  PROPERTY_FINDER_FEED_TOKEN: z.string().min(1).optional(),
  BAYUT_FEED_TOKEN: z.string().min(1).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  // WhatsApp deep-link numbers. Free-form so we accept "+971 50 …",
  // "(971) 50…", and digits-only; lib/whatsapp.ts normalises before
  // building the wa.me URL. Falls back to a UAE placeholder when unset.
  NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER: z.string().optional(),
  NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER: z.string().optional(),
  // Sprint 12 — Mapbox + Meilisearch public/search key + static FX rate.
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1).optional(),
  NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_MEILISEARCH_HOST: z.string().url().optional(),
  // Static USD-per-AED rate (placeholder until Sprint 13 wires a daily
  // FX cron). Used to render USD equivalents on /p/[slug].
  NEXT_PUBLIC_FX_USD_PER_AED: z.string().optional(),
});

const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER:
    process.env.NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER,
  NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER:
    process.env.NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY:
    process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY,
  NEXT_PUBLIC_MEILISEARCH_HOST: process.env.NEXT_PUBLIC_MEILISEARCH_HOST,
  NEXT_PUBLIC_FX_USD_PER_AED: process.env.NEXT_PUBLIC_FX_USD_PER_AED,
});

const serverEnv =
  typeof window === "undefined"
    ? serverSchema.parse({
        NODE_ENV: process.env.NODE_ENV,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        SENTRY_DSN: process.env.SENTRY_DSN,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        RESEND_FROM_ADDRESS: process.env.RESEND_FROM_ADDRESS,
        RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
        CRON_SECRET: process.env.CRON_SECRET,
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
        MEILISEARCH_HOST: process.env.MEILISEARCH_HOST,
        MEILISEARCH_API_KEY: process.env.MEILISEARCH_API_KEY,
        VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
        MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY,
        MAILCHIMP_LIST_ID: process.env.MAILCHIMP_LIST_ID,
        MAILCHIMP_DC: process.env.MAILCHIMP_DC,
        MAILCHIMP_WEBHOOK_SECRET: process.env.MAILCHIMP_WEBHOOK_SECRET,
        DOCUSIGN_INTEGRATION_KEY: process.env.DOCUSIGN_INTEGRATION_KEY,
        DOCUSIGN_USER_ID: process.env.DOCUSIGN_USER_ID,
        DOCUSIGN_ACCOUNT_ID: process.env.DOCUSIGN_ACCOUNT_ID,
        DOCUSIGN_PRIVATE_KEY: process.env.DOCUSIGN_PRIVATE_KEY,
        DOCUSIGN_BASE_URL: process.env.DOCUSIGN_BASE_URL,
        DOCUSIGN_WEBHOOK_SECRET: process.env.DOCUSIGN_WEBHOOK_SECRET,
        PROPERTY_FINDER_FEED_TOKEN: process.env.PROPERTY_FINDER_FEED_TOKEN,
        BAYUT_FEED_TOKEN: process.env.BAYUT_FEED_TOKEN,
      })
    : ({ NODE_ENV: "development" } as z.infer<typeof serverSchema>);

export const env = {
  ...clientEnv,
  ...serverEnv,
};

export const isSupabaseConfigured = Boolean(
  clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const isResendConfigured =
  typeof window === "undefined" && Boolean(env.RESEND_API_KEY);

/** Sprint 12 — feature flags for integrations. Read-only at module load.
 *  Code paths that depend on these should degrade gracefully when false:
 *  Meilisearch falls back to Postgres FTS, pgvector falls back to FTS,
 *  Mapbox falls back to maplibre-gl + open tiles. */
export const isMeilisearchConfigured =
  typeof window === "undefined"
    ? Boolean(env.MEILISEARCH_HOST && env.MEILISEARCH_API_KEY)
    : Boolean(
        clientEnv.NEXT_PUBLIC_MEILISEARCH_HOST &&
          clientEnv.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY,
      );

export const isVoyageConfigured =
  typeof window === "undefined" && Boolean(env.VOYAGE_API_KEY);

export const isMapboxConfigured = Boolean(
  clientEnv.NEXT_PUBLIC_MAPBOX_TOKEN,
);

export const isMailchimpConfigured =
  typeof window === "undefined" &&
  Boolean(env.MAILCHIMP_API_KEY && env.MAILCHIMP_LIST_ID && env.MAILCHIMP_DC);

export const isDocuSignConfigured =
  typeof window === "undefined" &&
  Boolean(
    env.DOCUSIGN_INTEGRATION_KEY &&
      env.DOCUSIGN_USER_ID &&
      env.DOCUSIGN_ACCOUNT_ID &&
      env.DOCUSIGN_PRIVATE_KEY,
  );

/** USD per 1 AED. Defaults to 0.272 (mid-2026 spot rate) when env unset. */
export function usdPerAed(): number {
  const raw = clientEnv.NEXT_PUBLIC_FX_USD_PER_AED;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0.272;
}

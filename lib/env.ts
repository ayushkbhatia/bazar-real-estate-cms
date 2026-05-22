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

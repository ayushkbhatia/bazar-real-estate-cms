import "server-only";

import {
  env,
  isMeilisearchConfigured,
  isResendConfigured,
  isSupabaseConfigured,
} from "@/lib/env";
import {
  readDeploy,
  rollupStatus,
  type HealthCheck,
  type HealthReport,
} from "@/lib/health";

/** Cheap liveness check on Supabase REST. */
async function checkSupabase(): Promise<HealthCheck> {
  if (!isSupabaseConfigured) {
    return {
      name: "supabase",
      status: "unconfigured",
      latency_ms: null,
      detail: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY not set",
    };
  }
  const started = Date.now();
  try {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/areas?select=id&limit=1`;
    const response = await fetch(url, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const latency_ms = Date.now() - started;
    if (!response.ok) {
      return {
        name: "supabase",
        status: "down",
        latency_ms,
        detail: `HTTP ${response.status}`,
      };
    }
    return {
      name: "supabase",
      status: latency_ms > 1500 ? "degraded" : "ok",
      latency_ms,
      detail: null,
    };
  } catch (err) {
    return {
      name: "supabase",
      status: "down",
      latency_ms: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Resend reachability + key-validity check via /domains (auth-required). */
async function checkResend(): Promise<HealthCheck> {
  if (!isResendConfigured) {
    return {
      name: "resend",
      status: "unconfigured",
      latency_ms: null,
      detail: "RESEND_API_KEY not set",
    };
  }
  const started = Date.now();
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const latency_ms = Date.now() - started;
    if (!response.ok) {
      const status = response.status >= 500 ? "degraded" : "down";
      return {
        name: "resend",
        status,
        latency_ms,
        detail: `HTTP ${response.status}`,
      };
    }
    return {
      name: "resend",
      status: latency_ms > 1500 ? "degraded" : "ok",
      latency_ms,
      detail: null,
    };
  } catch (err) {
    return {
      name: "resend",
      status: "down",
      latency_ms: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Meilisearch /health is anonymous + cheap. Returns `unconfigured` when the
 *  server key isn't set (search falls back to Postgres FTS in that mode). */
async function checkMeilisearch(): Promise<HealthCheck> {
  if (!isMeilisearchConfigured) {
    return {
      name: "meilisearch",
      status: "unconfigured",
      latency_ms: null,
      detail: "MEILISEARCH_HOST / MEILISEARCH_API_KEY not set (using Postgres FTS)",
    };
  }
  const started = Date.now();
  try {
    const host = env.MEILISEARCH_HOST!.replace(/\/+$/, "");
    const response = await fetch(`${host}/health`, {
      headers: { Authorization: `Bearer ${env.MEILISEARCH_API_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const latency_ms = Date.now() - started;
    if (!response.ok) {
      return {
        name: "meilisearch",
        status: "down",
        latency_ms,
        detail: `HTTP ${response.status}`,
      };
    }
    return {
      name: "meilisearch",
      status: latency_ms > 1500 ? "degraded" : "ok",
      latency_ms,
      detail: null,
    };
  } catch (err) {
    return {
      name: "meilisearch",
      status: "down",
      latency_ms: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Upstash Redis /ping check — the per-IP rate limiter that gates
 *  /api/concierge, /api/valuation-lead, and enquiry forms. Falls back to
 *  no-op in dev when unset (lib/rate-limit handles the empty case). */
async function checkUpstash(): Promise<HealthCheck> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      name: "upstash",
      status: "unconfigured",
      latency_ms: null,
      detail: "UPSTASH_REDIS_REST_* not set (rate limiter is no-op)",
    };
  }
  const started = Date.now();
  try {
    const url = `${env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, "")}/ping`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const latency_ms = Date.now() - started;
    if (!response.ok) {
      return {
        name: "upstash",
        status: "down",
        latency_ms,
        detail: `HTTP ${response.status}`,
      };
    }
    return {
      name: "upstash",
      status: latency_ms > 1500 ? "degraded" : "ok",
      latency_ms,
      detail: null,
    };
  } catch (err) {
    return {
      name: "upstash",
      status: "down",
      latency_ms: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Runs every check + assembles the full HealthReport. Used by both
 *  /api/health (HTTP wrapper) and /status (page) so the page doesn't have
 *  to fetch itself.
 *
 *  We probe Supabase / Resend / Meilisearch / Upstash because each has a
 *  cheap unauthenticated-or-cheap-authenticated reachability endpoint.
 *  Anthropic + Voyage are intentionally NOT probed — any auth call would
 *  count toward billable usage, and a quota outage is more useful caught
 *  at request time. */
export async function buildHealthReport(): Promise<HealthReport> {
  const checks = await Promise.all([
    checkSupabase(),
    checkResend(),
    checkMeilisearch(),
    checkUpstash(),
  ]);
  return {
    status: rollupStatus(checks),
    checked_at: new Date().toISOString(),
    deploy: readDeploy(process.env),
    checks,
  };
}

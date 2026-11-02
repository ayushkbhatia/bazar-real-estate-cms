import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Per-IP rate limiter for public POST endpoints.
 *
 * Backed by Upstash Redis (REST API; works on Vercel edge + node) when
 * `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. Without
 * them — which is how production has always run — a deployed site counts in
 * Postgres instead (`rate_limit_hit()`, migration 0173). Off Vercel (unit
 * tests, local dev, CI's e2e against the shared database) it no-ops, so a
 * test run can neither be throttled nor spend a visitor's budget.
 *
 * Each named bucket gets its own `Ratelimit` instance (and its own Redis
 * key prefix), so endpoints don't share budgets. We cache instances per
 * process to avoid reconnecting Redis on every request.
 */

type LimiterEntry = { limiter: Ratelimit; requests: number };
const cache = new Map<string, LimiterEntry>();
let redisSingleton: Redis | null = null;

/**
 * Say once, per process, that the limiter is not actually running.
 *
 * The no-op below is deliberate and documented, and it still cost us: no
 * `UPSTASH_*` variable has ever been set in Vercel, in any environment, so
 * every `checkRateLimit` call on the live site returned `ok` without
 * consulting anything. Five actions call it and all five read as protected.
 * Nobody noticed until a form-submission service put ~85 junk leads in the
 * client's inbox and the limiter turned out to be scenery.
 *
 * Warning only in production, and only once: locally and in preview the
 * degradation is the intended behaviour, and a line per request would be
 * noise rather than a signal.
 */
let warnedUnconfigured = false;
function warnUnconfigured(): void {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  if (process.env.NODE_ENV !== "production") return;
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL / _TOKEN are unset — counting in " +
      "Postgres (rate_limit_hit) instead.",
  );
}

function getRedis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    warnUnconfigured();
    return null;
  }
  if (!redisSingleton) {
    redisSingleton = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisSingleton;
}

function getLimiter(
  name: string,
  requests: number,
  windowSeconds: number,
): Ratelimit | null {
  const cached = cache.get(name);
  if (cached && cached.requests === requests) return cached.limiter;
  const redis = getRedis();
  if (!redis) return null;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    prefix: `bazar:rl:${name}`,
    analytics: false,
  });
  cache.set(name, { limiter, requests });
  return limiter;
}

export type RateLimitResult =
  | { ok: true; remaining: number; reset: number }
  | { ok: false; retryAfterSeconds: number };

export type RateLimitOpts = {
  /** Bucket name — each endpoint gets its own (`concierge`, `enquiry`, …). */
  name: string;
  /** Caller IP — see `extractClientIp`. */
  ip: string;
  /** Max requests per window. */
  requests: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

/**
 * Count in Postgres, for a deployment with no Upstash.
 *
 * Fails open: a database hiccup must not turn into "too many requests" for a
 * visitor sending their first enquiry. The IP is hashed with the bucket name
 * before it leaves the server, so the table never holds an address.
 */
async function checkPostgres(opts: RateLimitOpts): Promise<RateLimitResult> {
  const open = { ok: true as const, remaining: opts.requests, reset: 0 };
  if (!env.VERCEL_ENV || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return open;
  }
  const key = createHash("sha256").update(`${opts.name}:${opts.ip}`).digest("hex");
  try {
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_bucket: opts.name,
      p_key: key,
      p_limit: opts.requests,
      p_window_seconds: opts.windowSeconds,
    });
    if (error) throw error;
    const retryAfterSeconds = Number(data) || 0;
    return retryAfterSeconds > 0 ? { ok: false, retryAfterSeconds } : open;
  } catch (err) {
    console.warn(`[rate-limit] ${opts.name}: Postgres count failed, allowing`, err);
    return open;
  }
}

/**
 * Check the rate limit for one request: Upstash when configured, Postgres on
 * a deployment without it, nothing off Vercel.
 */
export async function checkRateLimit(
  opts: RateLimitOpts,
): Promise<RateLimitResult> {
  const limiter = getLimiter(opts.name, opts.requests, opts.windowSeconds);
  if (!limiter) return checkPostgres(opts);
  const r = await limiter.limit(opts.ip);
  if (r.success) {
    return { ok: true, remaining: r.remaining, reset: r.reset };
  }
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((r.reset - Date.now()) / 1000),
  );
  return { ok: false, retryAfterSeconds };
}

/**
 * Best-effort caller IP from request headers. Tries the standard
 * forwarding headers in order. Returns `"unknown"` if nothing usable
 * is present — `unknown` is a stable bucket key, so anyone behind the
 * same proxy chain still shares a quota.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/** Convenience: human-readable Retry-After message. */
export function rateLimitMessage(retryAfterSeconds: number): string {
  if (retryAfterSeconds <= 1) return "Too many requests — try again in a moment.";
  return `Too many requests — try again in ${retryAfterSeconds}s.`;
}

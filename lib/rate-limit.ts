import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Per-IP rate limiter for public POST endpoints.
 *
 * Backed by Upstash Redis (REST API; works on Vercel edge + node). When
 * either `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is
 * missing the limiter silently no-ops — so unit tests, local dev, and
 * preview deploys without Upstash credentials still pass.
 *
 * Each named bucket gets its own `Ratelimit` instance (and its own Redis
 * key prefix), so endpoints don't share budgets. We cache instances per
 * process to avoid reconnecting Redis on every request.
 */

type LimiterEntry = { limiter: Ratelimit; requests: number };
const cache = new Map<string, LimiterEntry>();
let redisSingleton: Redis | null = null;

function getRedis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
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
 * Check the rate limit for one request. No-ops with `{ ok: true }` when
 * Upstash isn't configured.
 */
export async function checkRateLimit(
  opts: RateLimitOpts,
): Promise<RateLimitResult> {
  const limiter = getLimiter(opts.name, opts.requests, opts.windowSeconds);
  if (!limiter) return { ok: true, remaining: opts.requests, reset: 0 };
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

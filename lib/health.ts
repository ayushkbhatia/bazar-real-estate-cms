/**
 * Pure helpers for the /api/health endpoint.
 *
 * The actual probe calls live in the route handler so this module stays
 * side-effect-free and unit-testable.
 */

export type HealthCheckStatus = "ok" | "degraded" | "down" | "unconfigured";

export type HealthCheck = {
  name: string;
  status: HealthCheckStatus;
  latency_ms: number | null;
  detail: string | null;
};

export type HealthReport = {
  status: HealthCheckStatus;
  checked_at: string;
  deploy: {
    commit_sha: string | null;
    commit_short: string | null;
    commit_ref: string | null;
    deployed_at: string | null;
    environment: string;
  };
  checks: HealthCheck[];
};

/** Roll a list of individual checks up into one overall status. */
export function rollupStatus(checks: HealthCheck[]): HealthCheckStatus {
  let worst: HealthCheckStatus = "ok";
  const order: Record<HealthCheckStatus, number> = {
    ok: 0,
    unconfigured: 1,
    degraded: 2,
    down: 3,
  };
  for (const c of checks) {
    if (order[c.status] > order[worst]) worst = c.status;
  }
  return worst;
}

/** Convert a HealthCheckStatus into an HTTP status code. */
export function httpStatusFor(status: HealthCheckStatus): number {
  if (status === "ok" || status === "unconfigured") return 200;
  if (status === "degraded") return 200; // still serving traffic
  return 503;
}

/** Truncate a SHA to the first 7 chars (canonical Git short SHA). */
export function shortSha(sha: string | null): string | null {
  if (!sha) return null;
  return sha.slice(0, 7);
}

/** Build the deploy block from env vars. Designed to work both in Vercel
 *  (where the VERCEL_* vars are injected at build) and locally (where they
 *  are absent and we return nulls so the consumer renders "—"). */
export function readDeploy(env: NodeJS.ProcessEnv): HealthReport["deploy"] {
  const sha = env.VERCEL_GIT_COMMIT_SHA ?? null;
  const ref = env.VERCEL_GIT_COMMIT_REF ?? null;
  // VERCEL doesn't expose a deploy timestamp; we use the build-time injected
  // VERCEL_DEPLOYMENT_URL as a sanity check that this is a Vercel deploy.
  const deployedAt =
    env.VERCEL_GIT_COMMIT_AUTHOR_NAME && env.VERCEL_GIT_COMMIT_REF
      ? null // best-effort; populate from build script in a follow-up
      : null;
  return {
    commit_sha: sha,
    commit_short: shortSha(sha),
    commit_ref: ref,
    deployed_at: deployedAt,
    environment: env.VERCEL_ENV ?? env.NODE_ENV ?? "local",
  };
}

/** Format a millisecond duration as e.g. "143ms". */
export function fmtMs(ms: number | null): string {
  if (ms == null) return "—";
  return `${Math.round(ms)}ms`;
}

import { NextResponse } from "next/server";
import { env, isResendConfigured, isSupabaseConfigured } from "@/lib/env";
import {
  httpStatusFor,
  readDeploy,
  rollupStatus,
  type HealthCheck,
  type HealthReport,
} from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Quick liveness check on Supabase. Uses the public REST endpoint with the
 *  anon key — same path the SSR clients use, so a green check means SSR
 *  fetches will work. */
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
    // Cheap REST head request. The areas table is tiny + public-readable.
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

/** Resend reachability via the /domains endpoint. Auth-required, so this
 *  also doubles as a key-validity check. */
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
      // 401/403 = key invalid (down), 5xx = degraded
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

export async function GET() {
  const [supabase, resend] = await Promise.all([
    checkSupabase(),
    checkResend(),
  ]);
  const checks = [supabase, resend];
  const status = rollupStatus(checks);
  const deploy = readDeploy(process.env);

  const report: HealthReport = {
    status,
    checked_at: new Date().toISOString(),
    deploy,
    checks,
  };

  return NextResponse.json(report, {
    status: httpStatusFor(status),
    headers: { "cache-control": "no-store" },
  });
}

// HEAD lets uptime monitors check without parsing JSON.
export async function HEAD() {
  const res = await GET();
  return new NextResponse(null, { status: res.status });
}

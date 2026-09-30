import "server-only";
import type { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MortgageApiError } from "./errors";

/**
 * Shared plumbing for the mortgage module's route handlers: JSON in and out,
 * errors in the API's shape, rate limits, and the feature flag. Every
 * response is `no-store` — nothing here should ever be cached.
 */

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Run a handler and turn what it throws into the API's error shape. Anything
 * unexpected is reported without personal data — `source` and the error's
 * message only — and answered with a bare 500.
 */
export async function handle(source: string, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof MortgageApiError) {
      const headers: Record<string, string> = { "cache-control": "no-store" };
      if (error.code === "rate_limited" && error.details.retryAfterSeconds) {
        headers["retry-after"] = String(error.details.retryAfterSeconds);
      }
      return Response.json(error.toJSON(), { status: error.status, headers });
    }
    await reportError(error, { source });
    return json({ code: "internal" }, 500);
  }
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  // Only a real JSON request: a cross-site form can post text/plain, never
  // application/json without a preflight (SECURITY-REVIEW SR-16).
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type.trim())) {
    throw new MortgageApiError(415, "invalid", "body must be application/json");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new MortgageApiError(400, "invalid", "body must be JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MortgageApiError(422, "invalid", issue?.message, {}, issue?.path.join(".") || undefined);
  }
  return parsed.data;
}

export async function rateLimit(name: string, key: string, requests: number, windowSeconds: number): Promise<void> {
  const result = await checkRateLimit({ name, ip: key, requests, windowSeconds });
  if (!result.ok) {
    throw new MortgageApiError(429, "rate_limited", undefined, { retryAfterSeconds: result.retryAfterSeconds });
  }
}

export type MortgageFlag = "off" | "staff" | "public";

export async function readFlag(db: SupabaseClient): Promise<MortgageFlag> {
  const { data } = await db.from("mortgage_settings").select("flag").eq("id", 1).maybeSingle();
  const flag = (data as { flag?: string } | null)?.flag;
  return flag === "public" || flag === "staff" ? flag : "off";
}

/** Whether the caller is signed in as active staff (any role), for the flag's `staff` setting. */
export async function callerIsStaff(db: SupabaseClient): Promise<boolean> {
  try {
    const session = await createSupabaseServerClient();
    const { data } = await session.auth.getUser();
    if (!data.user) return false;
    const { data: staff } = await db
      .from("staff")
      .select("status")
      .eq("user_id", data.user.id)
      .maybeSingle();
    return (staff as { status?: string } | null)?.status === "active";
  } catch {
    return false;
  }
}

/**
 * The feature flag `mortgage_requests` (SPEC §4.1): off, the public endpoints
 * don't exist; staff, only signed-in staff can use them; public, everyone.
 */
export async function requireFlag(db: SupabaseClient): Promise<void> {
  const flag = await readFlag(db);
  if (flag === "public") return;
  if (flag === "staff" && (await callerIsStaff(db))) return;
  throw new MortgageApiError(404, "not_found");
}

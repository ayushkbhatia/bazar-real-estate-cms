import "server-only";
import { env } from "@/lib/env";

/**
 * Cloudflare Turnstile, the invisible bot check on the mortgage application's
 * public endpoints (docs/mortgage/SPEC.md §4.2, §8).
 *
 * Without TURNSTILE_SECRET_KEY the check is skipped outside production, so
 * local development works, and refused in production, so a misconfigured
 * deployment fails closed. For staging, Cloudflare publishes test keys that
 * always pass or always fail.
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "missing" | "invalid" | "unavailable" };

export async function verifyTurnstile(
  token: string | null | undefined,
  ip: string | null,
  opts: { secret?: string; production?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<TurnstileResult> {
  const secret = opts.secret ?? env.TURNSTILE_SECRET_KEY;
  const production = opts.production ?? env.NODE_ENV === "production";
  if (!secret) return production ? { ok: false, reason: "not_configured" } : { ok: true };
  if (!token) return { ok: false, reason: "missing" };

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await (opts.fetchImpl ?? fetch)(SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const outcome = (await res.json()) as { success?: boolean };
    return outcome.success === true ? { ok: true } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

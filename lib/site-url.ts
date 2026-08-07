import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

const PRODUCTION_FALLBACK = "https://www.bazarrealestate.ae";

/**
 * The origin to build emailed links from.
 *
 * Read from the live request first, and only then from configuration. That
 * order is deliberate: the staff invitation email used to be sent by Supabase,
 * whose link lands on the project's configured Site URL — still
 * `http://localhost:3000` — so every invitee received a localhost link. Reading
 * `NEXT_PUBLIC_SITE_URL` instead would move the same failure into our code, and
 * silently: nothing errors, the mail just arrives useless.
 *
 * Whoever is clicking "Invite" is, by definition, on a working origin. Using it
 * means the link points wherever the admin actually is — preview deployment,
 * production, or a laptop — without anyone maintaining an env var for it.
 *
 * `x-forwarded-host` is the header Vercel sets; `host` covers everything else.
 * The scheme comes from `x-forwarded-proto`, defaulting to https except for
 * localhost, where nothing is listening on TLS.
 */
export async function requestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1")
          ? "http"
          : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Outside a request scope — a cron job or a script. Fall through.
  }
  return (env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_FALLBACK).replace(/\/+$/, "");
}

/** Absolute URL for an emailed link. `path` should start with a slash. */
export async function absoluteUrl(path: string): Promise<string> {
  const origin = await requestOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

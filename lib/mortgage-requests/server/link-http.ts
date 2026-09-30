import "server-only";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { DraftDeps } from "./drafts";
import { requireSession, sessionCookieName, type LinkRow } from "./links";
import { hashToken } from "./tokens";

/**
 * The secure-link routes' shared plumbing. The token is in the path — the
 * link token IS the URL (SPEC §8) — so it is never used as a key anywhere
 * else: rate limits key on its hash.
 */
export function linkKey(token: string): string {
  return hashToken(token).slice(0, 24);
}

/** The verified link this request's cookie opens, or the API's refusal. */
export function sessionLink(req: NextRequest, token: string, deps: Pick<DraftDeps, "db" | "now">): Promise<LinkRow> {
  return requireSession(deps, token, (name) => req.cookies.get(name)?.value);
}

/** The session cookie: httpOnly, SameSite=Strict, Secure off localhost, for as long as the session. */
export function sessionCookie(linkId: string, value: string, expiresAt: string) {
  return {
    name: sessionCookieName(linkId),
    value,
    options: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
      expires: new Date(expiresAt),
    },
  };
}

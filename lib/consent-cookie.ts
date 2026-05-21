import "server-only";
import { cookies } from "next/headers";
import {
  CONSENT_COOKIE_MAX_AGE_SECONDS,
  CONSENT_COOKIE_NAME,
  parseConsent,
  serialiseConsent,
  type ConsentState,
} from "./consent";

/** Read the consent state from the request cookies at SSR time.
 *  Returns null when no cookie is present — caller treats that as
 *  "banner should show, deny everything by default". */
export async function readConsentCookie(): Promise<ConsentState | null> {
  const store = await cookies();
  const raw = store.get(CONSENT_COOKIE_NAME)?.value;
  return parseConsent(raw);
}

/** Persist a consent decision in the response cookies. Used by the server
 *  action wired to the banner buttons. */
export async function writeConsentCookie(state: ConsentState): Promise<void> {
  const store = await cookies();
  store.set(CONSENT_COOKIE_NAME, serialiseConsent(state), {
    maxAge: CONSENT_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Not HttpOnly — the client provider reads it as a fallback when
    // localStorage is unavailable (private browsing / iframes / SSR mismatch).
    httpOnly: false,
  });
}

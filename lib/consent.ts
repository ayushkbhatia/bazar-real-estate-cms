/**
 * Cookie consent state machine.
 *
 * Three categories — UAE PDPL doesn't require this granularity but it sets up
 * a clean contract for analytics + marketing gating without changing copy
 * when we add tools (Sentry replay, ad pixels) later.
 *
 * - essential: always granted. Auth, CSRF, theme preference, language.
 * - analytics: PostHog + Vercel Analytics. Off until explicit accept.
 * - marketing: ad pixels / retargeting. Off until explicit accept.
 *
 * Persisted in two places so SSR can gate:
 *   - localStorage on the client (read by ConsentProvider)
 *   - cookie 'bz_consent' (read by server components + middleware)
 *
 * Cookie value is the JSON-encoded ConsentState. We accept a single legacy
 * "essential-only" value for users who clicked "Reject" so the cookie still
 * exists and the banner doesn't reappear.
 */

export const CONSENT_COOKIE_NAME = "bz_consent";
export const CONSENT_VERSION = 1;

/** A year — recommended PDPL/GDPR upper bound. */
export const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type ConsentCategory = "essential" | "analytics" | "marketing";

/** The discrete preferences the user has expressed. */
export type ConsentPreferences = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

/** The full persisted state, with the metadata SSR needs. */
export type ConsentState = ConsentPreferences & {
  /** ISO timestamp of the choice. null = no decision yet, banner should show. */
  decided_at: string | null;
  version: number;
};

export const DEFAULT_DENIED: ConsentState = {
  essential: true,
  analytics: false,
  marketing: false,
  decided_at: null,
  version: CONSENT_VERSION,
};

export function acceptAll(now: () => Date = () => new Date()): ConsentState {
  return {
    essential: true,
    analytics: true,
    marketing: true,
    decided_at: now().toISOString(),
    version: CONSENT_VERSION,
  };
}

export function rejectAll(now: () => Date = () => new Date()): ConsentState {
  return {
    essential: true,
    analytics: false,
    marketing: false,
    decided_at: now().toISOString(),
    version: CONSENT_VERSION,
  };
}

export function savePreferences(
  prefs: Partial<Pick<ConsentPreferences, "analytics" | "marketing">>,
  now: () => Date = () => new Date(),
): ConsentState {
  return {
    essential: true,
    analytics: Boolean(prefs.analytics),
    marketing: Boolean(prefs.marketing),
    decided_at: now().toISOString(),
    version: CONSENT_VERSION,
  };
}

/** True if the banner should render (no decision yet or stale version). */
export function bannerShouldShow(state: ConsentState | null): boolean {
  if (!state) return true;
  if (state.decided_at == null) return true;
  if (state.version !== CONSENT_VERSION) return true;
  return false;
}

/** Parse a cookie/localStorage string defensively. Returns null on any
 *  malformed shape so callers fall back to the default-denied state. */
export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (o.essential !== true) return null;
  if (typeof o.analytics !== "boolean") return null;
  if (typeof o.marketing !== "boolean") return null;
  if (typeof o.version !== "number") return null;
  const decided_at =
    typeof o.decided_at === "string" || o.decided_at === null
      ? (o.decided_at as string | null)
      : null;
  return {
    essential: true,
    analytics: o.analytics,
    marketing: o.marketing,
    decided_at,
    version: o.version,
  };
}

/** Serialise for storage. */
export function serialiseConsent(state: ConsentState): string {
  return JSON.stringify(state);
}

/** Has the user granted a specific category? Essential is always allowed. */
export function consentGranted(
  state: ConsentState | null,
  category: ConsentCategory,
): boolean {
  if (category === "essential") return true;
  if (!state || state.decided_at == null) return false;
  return Boolean(state[category]);
}

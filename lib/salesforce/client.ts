import "server-only";
import { env, isSalesforceConfigured } from "@/lib/env";

/**
 * Salesforce REST client — OAuth 2.0 Client Credentials flow.
 *
 * Per the Levarus integration doc (18 Sept 2026): POST to
 * /services/oauth2/token with grant_type=client_credentials, then send the
 * returned token as `Authorization: Bearer <token>` on every call.
 *
 * ── On token lifetime ────────────────────────────────────────────────────
 * The client-credentials grant returns **no refresh token and no
 * `expires_in`** — the doc's sample response carries only `access_token`,
 * `instance_url` and `token_type`. So there is nothing to renew against and
 * nothing that tells us when the token dies; the real lifetime is the org's
 * session-timeout setting, which we do not control and cannot read.
 *
 * Two mechanisms cover that between them:
 *   · a conservative local TTL, so a long-lived warm Lambda re-authenticates
 *     periodically rather than holding a token until it is refused;
 *   · a single transparent retry on 401, which is the only signal Salesforce
 *     actually gives us that a token has expired. The doc says as much:
 *     "Re-authenticate when you receive a 401 Unauthorized response."
 *
 * The cache is module-level, so it is per warm serverless instance. That is
 * the right scope: a token is cheap, and sharing one across instances would
 * mean putting an org credential in Redis for no gain.
 */

/** Conservative: well inside any plausible org session timeout. */
const TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Pinned rather than floating. A Salesforce org serves every version it has
 * ever shipped, so pinning costs nothing and protects us from a major release
 * changing behaviour under a running integration. Bump deliberately.
 */
const DEFAULT_API_VERSION = "v67.0";

type CachedToken = { token: string; instanceUrl: string; fetchedAt: number };

let cached: CachedToken | null = null;

/** Test seam — the cache is module state and would leak between specs. */
export function __resetSalesforceTokenCache(): void {
  cached = null;
}

export function salesforceApiVersion(): string {
  return env.SALESFORCE_API_VERSION || DEFAULT_API_VERSION;
}

export class SalesforceError extends Error {
  readonly status: number;
  readonly errorCode: string | null;
  /** Whether another attempt could plausibly succeed. See `classify` below. */
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { status: number; errorCode?: string | null; retryable: boolean },
  ) {
    super(message);
    this.name = "SalesforceError";
    this.status = opts.status;
    this.errorCode = opts.errorCode ?? null;
    this.retryable = opts.retryable;
  }
}

/**
 * Retryable means "the same payload might work later".
 *
 * A 400 carrying MALFORMED_ID, a restricted-picklist rejection or a missing
 * required field will fail identically on every future attempt — retrying it
 * four more times burns the org's daily API allocation to reach the same
 * answer, and buries the row's real error behind a retry count. Those fail
 * fast and land in `crm_last_error` for a human.
 *
 * Everything transport-shaped — 5xx, the two throttling codes, a network
 * throw with no status at all — is worth another run.
 */
function classify(status: number, errorCode: string | null): boolean {
  if (status === 0) return true; // network / DNS / abort — never reached SF
  if (status === 401) return true; // handled by re-auth, but safe to retry
  if (status === 429) return true;
  if (status >= 500) return true;
  if (
    errorCode === "REQUEST_LIMIT_EXCEEDED" ||
    errorCode === "SERVER_UNAVAILABLE" ||
    errorCode === "UNABLE_TO_LOCK_ROW"
  ) {
    return true;
  }
  return false;
}

/**
 * Salesforce reports REST errors as an array of
 * `{ message, errorCode, fields }`, not as a single object. A non-JSON body
 * (an HTML login page, a gateway error) has to survive this too, so the raw
 * text is the fallback.
 */
function parseSalesforceError(
  status: number,
  body: string,
): { message: string; errorCode: string | null } {
  try {
    const parsed: unknown = JSON.parse(body);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    if (first && typeof first === "object") {
      const rec = first as Record<string, unknown>;
      const code =
        typeof rec.errorCode === "string"
          ? rec.errorCode
          : typeof rec.error === "string"
            ? rec.error
            : null;
      const msg =
        typeof rec.message === "string"
          ? rec.message
          : typeof rec.error_description === "string"
            ? rec.error_description
            : body.slice(0, 300);
      const fields = Array.isArray(rec.fields)
        ? (rec.fields as unknown[]).filter((f) => typeof f === "string")
        : [];
      return {
        message: fields.length ? `${msg} [${fields.join(", ")}]` : msg,
        errorCode: code,
      };
    }
  } catch {
    // fall through to the raw body
  }
  return { message: body.slice(0, 300) || `HTTP ${status}`, errorCode: null };
}

async function requestToken(): Promise<CachedToken> {
  const base = (env.SALESFORCE_INSTANCE_URL ?? "").replace(/\/+$/, "");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.SALESFORCE_CLIENT_ID ?? "",
    client_secret: env.SALESFORCE_CLIENT_SECRET ?? "",
  });

  let res: Response;
  try {
    res = await fetch(`${base}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch (err) {
    throw new SalesforceError(
      `Token request failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 0, retryable: true },
    );
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    const { message, errorCode } = parseSalesforceError(res.status, text);
    throw new SalesforceError(`Auth failed: ${message}`, {
      status: res.status,
      errorCode,
      // A bad client_id/secret is `invalid_client` and will never come good on
      // its own; treating it as retryable would hammer the org's login
      // endpoint every five minutes and risk the IP being locked out.
      retryable:
        errorCode !== "invalid_client" &&
        errorCode !== "invalid_grant" &&
        classify(res.status, errorCode),
    });
  }

  let parsed: { access_token?: string; instance_url?: string };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new SalesforceError("Auth response was not JSON", {
      status: res.status,
      retryable: true,
    });
  }
  if (!parsed.access_token) {
    throw new SalesforceError("Auth response carried no access_token", {
      status: res.status,
      retryable: true,
    });
  }

  return {
    token: parsed.access_token,
    // Salesforce echoes the instance to address; prefer it over our env value
    // so a My Domain change or a sandbox refresh does not need a redeploy.
    instanceUrl: (parsed.instance_url ?? base).replace(/\/+$/, ""),
    fetchedAt: Date.now(),
  };
}

async function getToken(forceRefresh = false): Promise<CachedToken> {
  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.fetchedAt < TOKEN_TTL_MS
  ) {
    return cached;
  }
  cached = await requestToken();
  return cached;
}

/**
 * One authenticated REST call, with the 401 re-auth built in.
 *
 * `path` is relative to the data API root, e.g.
 * `sobjects/Lead__c` → `<instance>/services/data/v67.0/sobjects/Lead__c`.
 *
 * Returns the parsed JSON body, or `null` for a 204. Throws `SalesforceError`
 * on anything else so the caller has one thing to catch and one flag —
 * `retryable` — to branch on.
 */
export async function salesforceRequest<T = unknown>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: unknown },
): Promise<T | null> {
  if (!isSalesforceConfigured) {
    throw new SalesforceError("Salesforce is not configured", {
      status: 0,
      retryable: false,
    });
  }

  const attempt = async (forceRefresh: boolean): Promise<Response> => {
    const { token, instanceUrl } = await getToken(forceRefresh);
    const url = `${instanceUrl}/services/data/${salesforceApiVersion()}/${path.replace(/^\/+/, "")}`;
    return fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  };

  let res: Response;
  try {
    res = await attempt(false);
    // The one signal Salesforce gives that a cached token has died. Retry
    // once with a fresh token; a second 401 is a real authorisation problem
    // (the run-as user lost access to the object) and must surface.
    if (res.status === 401) res = await attempt(true);
  } catch (err) {
    if (err instanceof SalesforceError) throw err;
    throw new SalesforceError(
      err instanceof Error ? err.message : String(err),
      { status: 0, retryable: true },
    );
  }

  if (res.status === 204) return null;

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    const { message, errorCode } = parseSalesforceError(res.status, text);
    throw new SalesforceError(message, {
      status: res.status,
      errorCode,
      retryable: classify(res.status, errorCode),
    });
  }

  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SalesforceError("Response was not JSON", {
      status: res.status,
      retryable: false,
    });
  }
}

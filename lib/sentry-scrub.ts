import { scrubContext, scrubPii } from "@/lib/pii-scrub";

/**
 * Sentry's `beforeSend` / `beforeSendTransaction` / `beforeBreadcrumb`, for the
 * server, edge and browser inits (instrumentation*.ts): every event leaves
 * without personal data or secure-link tokens (docs/mortgage SPEC §8,
 * SECURITY-REVIEW SR-4). `sendDefaultPii` stays off, so Sentry adds no
 * cookies, IPs or user details of its own; this takes out what messages, URLs
 * and breadcrumbs carry.
 *
 * Typed loosely on purpose: the same function serves error and transaction
 * events across Sentry's runtimes, and it only ever rewrites strings.
 */

type Loose = Record<string, unknown>;

function scrubUrl(value: unknown): unknown {
  return typeof value === "string" ? scrubPii(value) : value;
}

export function scrubSentryEvent<E>(event: E): E {
  const e = event as unknown as Loose;
  if (typeof e.message === "string") e.message = scrubPii(e.message);
  if (typeof e.transaction === "string") e.transaction = scrubPii(e.transaction);

  const exception = e.exception as { values?: { value?: string }[] } | undefined;
  for (const v of exception?.values ?? []) if (typeof v.value === "string") v.value = scrubPii(v.value);

  const request = e.request as Loose | undefined;
  if (request) {
    request.url = scrubUrl(request.url);
    // Bodies and query strings are the applicant's answers; they never leave.
    delete request.data;
    delete request.query_string;
    delete request.cookies;
    const headers = request.headers as Loose | undefined;
    if (headers) {
      for (const key of Object.keys(headers)) {
        if (/^(cookie|authorization|x-forwarded-for|x-real-ip|referer)$/i.test(key)) delete headers[key];
        else headers[key] = scrubUrl(headers[key]);
      }
    }
  }

  // Only an id is ever useful here.
  const user = e.user as Loose | undefined;
  if (user) e.user = user.id ? { id: user.id } : undefined;

  if (e.extra) e.extra = scrubContext(e.extra);
  if (e.contexts) e.contexts = scrubContext(e.contexts);
  if (e.tags) e.tags = scrubContext(e.tags);
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = e.breadcrumbs.map((b) => scrubBreadcrumb(b as Loose));
  if (Array.isArray(e.spans)) {
    for (const span of e.spans as Loose[]) {
      if (typeof span.description === "string") span.description = scrubPii(span.description);
      if (span.data) span.data = scrubContext(span.data);
    }
  }
  return event;
}

export function scrubBreadcrumb<B>(breadcrumb: B): B {
  const b = breadcrumb as unknown as Loose;
  if (typeof b.message === "string") b.message = scrubPii(b.message);
  if (b.data) b.data = scrubContext(b.data);
  return breadcrumb;
}

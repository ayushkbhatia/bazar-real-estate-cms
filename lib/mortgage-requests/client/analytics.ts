"use client";

/**
 * The flow's PostHog events (docs/mortgage/frontend/00-foundations §10), with
 * no personal data by construction: each event names the properties it may
 * carry, the types allow only enums and counts, and anything else is dropped
 * before it leaves. Never names, emails, mobiles, dates of birth, references,
 * file names or link tokens.
 *
 * A no-op until the visitor has consented to analytics and PostHog has
 * loaded (lib/posthog.tsx) — this never loads the SDK itself.
 */

import { CONSENT_COOKIE_NAME, parseConsent } from "@/lib/consent";

type Events = {
  mortgage_apply_viewed: { step: string; service?: string; entry_point?: string };
  mortgage_service_selected: { service: string; entry_point: string };
  mortgage_details_completed: { service: string; residency: string; employment_type: string };
  mortgage_details_error: { field: string; rule: string };
  mortgage_doc_file_added: { kind: string; mime: string; size_bucket: string };
  mortgage_doc_file_rejected: { kind: string; code: string };
  mortgage_consent_toggled: { checked: boolean };
  mortgage_request_submitted: { service: string; residency: string; employment_type: string; entry_point: string };
  mortgage_request_failed: { service: string; status: number };
  mortgage_apply_exit: { step: string };
  // W8 and the invite landing (SPEC §8: the route, never the token).
  mortgage_reupload_viewed: { kind: string; reason: string; state: string };
  mortgage_reupload_otp_sent: { purpose: string };
  mortgage_reupload_otp_failed: { attempt: number };
  mortgage_reupload_verified: { purpose: string };
  mortgage_reupload_sent: { kind: string; files: number };
  mortgage_invite_submitted: { employment_type: string };
};

const ALLOWED: { [E in keyof Events]: readonly (keyof Events[E])[] } = {
  mortgage_apply_viewed: ["step", "service", "entry_point"],
  mortgage_service_selected: ["service", "entry_point"],
  mortgage_details_completed: ["service", "residency", "employment_type"],
  mortgage_details_error: ["field", "rule"],
  mortgage_doc_file_added: ["kind", "mime", "size_bucket"],
  mortgage_doc_file_rejected: ["kind", "code"],
  mortgage_consent_toggled: ["checked"],
  mortgage_request_submitted: ["service", "residency", "employment_type", "entry_point"],
  mortgage_request_failed: ["service", "status"],
  mortgage_apply_exit: ["step"],
  mortgage_reupload_viewed: ["kind", "reason", "state"],
  mortgage_reupload_otp_sent: ["purpose"],
  mortgage_reupload_otp_failed: ["attempt"],
  mortgage_reupload_verified: ["purpose"],
  mortgage_reupload_sent: ["kind", "files"],
  mortgage_invite_submitted: ["employment_type"],
};

/** Only the listed keys, and only short enum-like strings, numbers and booleans. */
export function safeProperties<E extends keyof Events>(event: E, props: Events[E]): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const key of ALLOWED[event] as readonly string[]) {
    const value = (props as Record<string, unknown>)[key];
    if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (typeof value === "string" && /^[a-z0-9_/.<>+-]{1,40}$/i.test(value)) out[key] = value;
  }
  return out;
}

/** The consent cookie says analytics may run. Checked before the SDK is even loaded. */
function analyticsAllowed(): boolean {
  if (typeof document === "undefined") return false;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.slice(CONSENT_COOKIE_NAME.length + 1);
  try {
    return parseConsent(raw ? decodeURIComponent(raw) : null)?.analytics === true;
  } catch {
    return false;
  }
}

export function trackMortgage<E extends keyof Events>(event: E, props: Events[E]): void {
  if (!analyticsAllowed()) return;
  const properties = safeProperties(event, props);
  void import("posthog-js")
    .then(({ default: posthog }) => {
      if (!posthog.__loaded || posthog.has_opted_out_capturing()) return;
      posthog.capture(event, properties);
    })
    .catch(() => undefined);
}

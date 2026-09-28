"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { redactSecureLinkPaths } from "@/lib/secure-link-redaction";
import { useConsent } from "./consent-provider";

/** A secure mortgage link's token is its URL: report the route, never the token. */
function redact(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: redactSecureLinkPaths(event.url) };
}

/**
 * Mount Vercel Analytics only after the user has granted analytics consent.
 * Vercel Analytics does not expose an opt-in API the way PostHog does, so
 * gating at mount time is the cleanest path.
 */
export function VercelAnalyticsGate() {
  const { isGranted } = useConsent();
  if (!isGranted("analytics")) return null;
  return <Analytics beforeSend={redact} />;
}

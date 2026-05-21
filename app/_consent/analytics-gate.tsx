"use client";

import { Analytics } from "@vercel/analytics/next";
import { useConsent } from "./consent-provider";

/**
 * Mount Vercel Analytics only after the user has granted analytics consent.
 * Vercel Analytics does not expose an opt-in API the way PostHog does, so
 * gating at mount time is the cleanest path.
 */
export function VercelAnalyticsGate() {
  const { isGranted } = useConsent();
  if (!isGranted("analytics")) return null;
  return <Analytics />;
}

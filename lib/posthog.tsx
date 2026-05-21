"use client";

import { useEffect } from "react";
import { env } from "@/lib/env";
import { useConsent } from "@/app/_consent/consent-provider";

/**
 * Initialises PostHog only after the user has granted analytics consent.
 *
 * The `posthog-js` module is dynamically-imported so it isn't shipped in the
 * initial JS bundle for visitors who haven't (yet) consented to analytics.
 * Once consent flips on we opt in and keep the loaded SDK; if it flips back
 * off later the SDK opts out without unloading (which the SDK doesn't
 * support cleanly).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { isGranted } = useConsent();
  const analyticsAllowed = isGranted("analytics");

  useEffect(() => {
    if (!env.NEXT_PUBLIC_POSTHOG_KEY) return;
    let cancelled = false;

    if (!analyticsAllowed) {
      // Best-effort opt-out without forcing the SDK to load if it never has.
      import("posthog-js")
        .then(({ default: posthog }) => {
          if (cancelled) return;
          if (posthog.__loaded) posthog.opt_out_capturing();
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const { default: posthog } = await import("posthog-js");
      if (cancelled) return;
      if (!posthog.__loaded) {
        posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY!, {
          api_host: env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
          person_profiles: "identified_only",
          capture_pageview: "history_change",
          capture_pageleave: true,
          autocapture: true,
          opt_out_capturing_by_default: true,
          loaded: (ph) => ph.opt_in_capturing(),
        });
      } else {
        posthog.opt_in_capturing();
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [analyticsAllowed]);

  return <>{children}</>;
}

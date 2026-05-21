"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { env } from "@/lib/env";
import { useConsent } from "@/app/_consent/consent-provider";

/**
 * Initialises PostHog only after the user has granted analytics consent.
 * Toggles `opt_in_capturing` / `opt_out_capturing` dynamically when the user
 * changes their mind, so we never have to do a full page reload on revoke.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { isGranted } = useConsent();
  const analyticsAllowed = isGranted("analytics");

  useEffect(() => {
    if (!env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (!analyticsAllowed) {
      if (posthog.__loaded) posthog.opt_out_capturing();
      return;
    }

    if (!posthog.__loaded) {
      posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_pageleave: true,
        autocapture: true,
        // Don't auto-capture before opt-in. opt_in below explicitly enables it.
        opt_out_capturing_by_default: true,
        loaded: () => posthog.opt_in_capturing(),
      });
    } else {
      posthog.opt_in_capturing();
    }
  }, [analyticsAllowed]);

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { env, isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { useConsent } from "@/app/_consent/consent-provider";

/**
 * Initialises PostHog only after the user has granted analytics consent.
 *
 * The `posthog-js` module is dynamically-imported so it isn't shipped in the
 * initial JS bundle for visitors who haven't (yet) consented to analytics.
 * Once consent flips on we opt in and keep the loaded SDK; if it flips back
 * off later the SDK opts out without unloading (which the SDK doesn't
 * support cleanly).
 *
 * Sign-in/out is wired here too: a Supabase auth subscription calls
 * `posthog.identify()` on SIGNED_IN and `posthog.reset()` on SIGNED_OUT so
 * authed events land on a real distinct_id instead of an anonymous one. Both
 * are gated on the same consent flag — no identify fires before analytics
 * consent and no identify fires when keys are missing.
 *
 * `locale` is registered as a super-property so it rides on every event. This
 * codebase has no `capture()` calls at all — analytics is autocapture plus
 * pageviews — so without it `/buy` and `/ar/buy` would arrive as two unrelated
 * URL strings with no dimension to group them by, and "how is the Arabic site
 * converting?" would have no answer. It ships before Arabic does because the
 * data is not backfillable: events captured without the property never get it.
 */
export function PostHogProvider({
  children,
  locale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
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
          loaded: (ph) => {
            // Register before opting in, so the very first pageview of the
            // session already carries the locale.
            ph.register({ locale });
            ph.opt_in_capturing();
          },
        });
      } else {
        posthog.register({ locale });
        posthog.opt_in_capturing();
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [analyticsAllowed, locale]);

  useEffect(() => {
    if (!env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (!analyticsAllowed) return;
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const [{ default: posthog }, { createSupabaseBrowserClient }] =
        await Promise.all([
          import("posthog-js"),
          import("@/lib/supabase/browser"),
        ]);
      if (cancelled) return;

      const supabase = createSupabaseBrowserClient();

      // Best-effort identify on mount for users who arrived already signed in.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled && user && posthog.__loaded) {
        identifyUser(posthog, user.id, user.email ?? null);
      }

      const { data: sub } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!posthog.__loaded) return;
          if (event === "SIGNED_IN" && session?.user) {
            identifyUser(posthog, session.user.id, session.user.email ?? null);
          } else if (event === "SIGNED_OUT") {
            posthog.reset();
          }
        },
      );
      unsubscribe = () => sub.subscription.unsubscribe();
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [analyticsAllowed]);

  return <>{children}</>;
}

type PostHogLike = {
  identify: (id: string, props?: Record<string, unknown>) => void;
};

export function identifyUser(
  posthog: PostHogLike,
  userId: string,
  email: string | null,
) {
  posthog.identify(userId, email ? { email } : undefined);
}

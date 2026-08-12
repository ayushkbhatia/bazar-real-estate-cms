import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
    enabled: process.env.NODE_ENV === "production",
  });

  // Tag every event with the rendered locale, read off the document rather
  // than plumbed through — the root layout is what sets `<html lang>`, so this
  // stays correct when Arabic lands without another wiring change. Switching
  // locale is a full navigation to a different URL prefix, never a client-side
  // transition, so the boot-time read cannot go stale.
  //
  // Without it an Arabic-only crash (bidi, font load, the RTL scroll sign bug)
  // is indistinguishable from an English one in the issue stream.
  Sentry.setTag("locale", document.documentElement.lang || "en");
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

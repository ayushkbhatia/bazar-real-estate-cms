"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Root-layout error boundary. Runs only when the root layout itself
 * throws — so no providers, no Tailwind base styles, no nav. Must
 * render its own <html><body>.
 *
 * We keep the markup intentionally minimal: a single message and an
 * inline reload action. Anything more risks pulling in code that may
 * also have just crashed.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { component: "global-error-boundary" },
      contexts: error.digest ? { error_digest: { digest: error.digest } } : undefined,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "64px 24px",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          background: "#fafaf7",
          color: "#1c1c1a",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <p
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontSize: 11,
              color: "#8a8a82",
              margin: 0,
            }}
          >
            Error
          </p>
          <h1
            style={{
              fontFamily: 'ui-serif, Georgia, serif',
              fontSize: 36,
              lineHeight: 1.15,
              fontWeight: 400,
              margin: "12px 0 16px",
            }}
          >
            We couldn&rsquo;t load the page.
          </h1>
          <p style={{ color: "#3a3a36", margin: "0 0 32px" }}>
            An unexpected error interrupted the application shell. The team
            has been notified. Please reload to try again.
          </p>
          {/* Plain <a> by design: the root layout has crashed here, so
              next/link's client-router context may not be available. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              background: "#3a4f3a",
              color: "#ffffff",
              padding: "10px 16px",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Reload home
          </a>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                color: "#8a8a82",
                marginTop: 32,
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

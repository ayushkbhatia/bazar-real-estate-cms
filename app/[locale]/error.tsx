"use client";

import { useEffect } from "react";
import Link from "@/components/i18n/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";

export default function GlobalSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { component: "error-boundary" },
      contexts: error.digest ? { error_digest: { digest: error.digest } } : undefined,
    });
  }, [error]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6 py-16 bg-bz-bg text-bz-ink">
      <div className="max-w-xl w-full">
        <Eyebrow>Error</Eyebrow>
        <h1 className="serif text-4xl mt-3 mb-4">Something went wrong.</h1>
        <p className="text-bz-ink-2 mb-8">
          We hit an unexpected error rendering this page. The team has been
          notified. You can try again — if the problem persists, the homepage
          is your safest fallback.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Return home</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="mono text-xs text-bz-muted mt-8">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}

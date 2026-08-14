"use client";

import { useTranslations } from "next-intl";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acceptAllConsent,
  rejectAllConsent,
  savePreferencesConsent,
} from "./actions";
import { useConsent } from "./consent-provider";

export function CookieBanner() {
  const { state, setState, bannerOpen, openCustomize, setOpenCustomize } =
    useConsent();
  const t = useTranslations("consent");
  const [pending, startTransition] = useTransition();
  const [analytics, setAnalytics] = useState<boolean>(
    state?.analytics ?? false,
  );
  const [marketing, setMarketing] = useState<boolean>(
    state?.marketing ?? false,
  );

  if (!bannerOpen) return null;

  const onAcceptAll = () =>
    startTransition(async () => {
      const next = await acceptAllConsent();
      setState(next);
    });

  const onRejectAll = () =>
    startTransition(async () => {
      const next = await rejectAllConsent();
      setState(next);
    });

  const onSave = () =>
    startTransition(async () => {
      const next = await savePreferencesConsent({ analytics, marketing });
      setState(next);
    });

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="bz-consent-title"
      aria-describedby="bz-consent-body"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pointer-events-none",
        "md:start-auto md:end-6 md:bottom-6 md:px-0 md:pb-0",
      )}
    >
      <div className="pointer-events-auto bg-bz-surface border border-bz-border-strong rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.18)] max-w-[480px] ms-auto p-5 flex flex-col gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-bz-muted">
            Cookies
          </div>
          <h2
            id="bz-consent-title"
            className="serif text-[20px] font-normal mt-1.5"
            style={{ letterSpacing: "-0.015em" }}
          >
            We use cookies to understand what works.
          </h2>
          <p
            id="bz-consent-body"
            className="mt-2 text-[13px] text-bz-ink-2 leading-[1.55]"
          >
            Essential cookies keep you signed in. Analytics cookies help us see
            which listings get attention. We don&apos;t share your data — read
            our{" "}
            <Link
              href="/legal/cookies"
              className="underline text-bz-ink hover:text-bz-accent"
            >
              cookie policy
            </Link>
            .
          </p>
        </div>

        {openCustomize ? (
          <fieldset className="border-t border-bz-border pt-4 flex flex-col gap-3">
            <legend className="sr-only">{t("title")}</legend>

            <label className="flex items-start gap-3 cursor-not-allowed opacity-70">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-1"
                aria-describedby="bz-consent-essential-desc"
              />
              <span>
                <span className="block text-[13.5px] font-medium">
                  Essential
                </span>
                <span
                  id="bz-consent-essential-desc"
                  className="text-[12px] text-bz-muted leading-snug"
                >
                  Always on. Required for sign-in and CSRF protection.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1"
                aria-describedby="bz-consent-analytics-desc"
              />
              <span>
                <span className="block text-[13.5px] font-medium">
                  Analytics
                </span>
                <span
                  id="bz-consent-analytics-desc"
                  className="text-[12px] text-bz-muted leading-snug"
                >
                  Vercel Analytics + PostHog. Tells us which pages and listings
                  work.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1"
                aria-describedby="bz-consent-marketing-desc"
              />
              <span>
                <span className="block text-[13.5px] font-medium">
                  Marketing
                </span>
                <span
                  id="bz-consent-marketing-desc"
                  className="text-[12px] text-bz-muted leading-snug"
                >
                  Retargeting pixels (Meta, LinkedIn). Off by default — we
                  haven&apos;t wired any yet.
                </span>
              </span>
            </label>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap gap-2 justify-end items-center pt-1">
          {openCustomize ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenCustomize(false)}
              disabled={pending}
            >
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenCustomize(true)}
              disabled={pending}
            >
              {t("customize")}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRejectAll}
            disabled={pending}
          >
            {t("rejectAll")}
          </Button>

          {openCustomize ? (
            <Button type="button" size="sm" onClick={onSave} disabled={pending}>
              {pending ? t("saving") : t("savePreferences")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onAcceptAll}
              disabled={pending}
            >
              {pending ? t("saving") : t("acceptAll")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

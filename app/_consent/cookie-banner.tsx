"use client";

import { useTranslations } from "next-intl";

import { useState, useTransition } from "react";
import Link from "@/components/i18n/link";
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
        /*
          `pb-[var(--bz-bar-safe)]` rather than the `.pb-bar-safe` utility:
          that class is hand-written inside `@layer utilities` in globals.css,
          and Tailwind v4 cannot compose a variant onto a class it did not
          generate — so there would be no way to cancel it at `md`, where the
          card is a floating corner panel with `md:bottom-6` and needs no inset
          at all. Reading the same custom property keeps the two in step. The
          old `pb-4` put Accept/Reject inside the iOS home-indicator strip.
        */
        "fixed inset-x-0 bottom-0 z-50 px-4 pb-[var(--bz-bar-safe)] pointer-events-none",
        "md:start-auto md:end-6 md:bottom-6 md:px-0 md:pb-0",
      )}
    >
      <div className="pointer-events-auto bg-bz-surface border border-bz-border-strong rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.18)] max-w-[480px] ms-auto p-4 md:p-5 flex flex-col gap-3 md:gap-4">
        <div>
          {/*
            The eyebrow goes below `md`, and the heading's top margin with it —
            nothing is above it there. It repeats the one word the heading
            already carries, and this card is bottom-anchored over the page, so
            every row it costs is a row of the hero underneath that a first-time
            visitor cannot see or reach.
          */}
          <div className="hidden md:block text-[11px] uppercase tracking-widest text-bz-muted">
            Cookies
          </div>
          <h2
            id="bz-consent-title"
            className="serif text-[17px] md:text-[20px] font-normal mt-0 md:mt-1.5"
            style={{ letterSpacing: "-0.015em" }}
          >
            We use cookies to understand what works.
          </h2>
          <p
            id="bz-consent-body"
            className="mt-2 text-[13px] text-bz-ink-2 leading-[1.55]"
          >
            {/*
              Every sentence renders at every width, deliberately.

              A previous pass shortened the banner on phones by hiding this
              first sentence behind `hidden md:inline`, reasoning that
              essential cookies are not consentable anyway and the Customize
              panel repeats the point. Both halves are true and it is still the
              wrong trade: `display: none` also removes the text from
              `aria-describedby`, so the screen-reader announcement of a
              consent dialog got shorter on exactly the devices where most
              visitors meet it, and "what are you storing" is disclosure rather
              than decoration. Under PDPL this is not a call to make for
              vertical space — take the height out of padding or the Customize
              panel instead.
            */}
            Essential cookies keep you signed in. Analytics cookies help us see
            which listings get attention. We
            don&apos;t share your data — read our{" "}
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

            {/*
              `size-5` at every width, not just below `md`. The audit's "~13px
              target" is the painted box; the whole `<label>` wraps the input,
              so what a thumb actually lands on is the row. What 13px costs is
              READING the control — at that size a checked box and an unchecked
              one are the same grey smudge on a consent panel, which is the one
              place the state has to be obvious. `min-h-11` is a floor for a
              category whose description fits on one line; today all three wrap
              to two and clear it on their own.
            */}
            <label className="flex items-start gap-3 min-h-11 md:min-h-0 cursor-not-allowed opacity-70">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-0.5 size-5 shrink-0"
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

            <label className="flex items-start gap-3 min-h-11 md:min-h-0 cursor-pointer">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-0.5 size-5 shrink-0"
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

            <label className="flex items-start gap-3 min-h-11 md:min-h-0 cursor-pointer">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-0.5 size-5 shrink-0"
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

        {/*
          Below `md` the row splits: Customize sits on the start edge and the
          two consequential controls on the end edge, so the nearest thing to
          Reject is Accept and they are 16px apart instead of 8. These are the
          only controls on the public site where a mistap records the OPPOSITE
          of what the visitor meant, and 8px between Reject and Accept at the
          old 28px height was the tightest pairing measured anywhere in the
          audit. Height itself is already handled: the `(pointer: coarse)` rule
          in globals.css floors every `[data-slot=button]` at 44px, and
          `min-height` beats the `h-7` that `size="sm"` sets.

          At `md` the outer gap, the inner gap and `justify-end` all return to
          the single 8px row the panel has always drawn.

          `flex-wrap` on the outer, not the inner: at ~320px the three labels no
          longer fit on one line, and wrapping the pair together as a unit keeps
          Reject and Accept side by side rather than stacking them in whichever
          order the flow happens to produce.
        */}
        <div className="flex flex-wrap gap-3 justify-between items-center pt-1 md:gap-2 md:justify-end">
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

          <div className="flex items-center gap-4 md:gap-2">
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
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={pending}
              >
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
    </div>
  );
}

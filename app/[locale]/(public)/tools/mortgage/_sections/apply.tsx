"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import Link from "@/components/i18n/link";
import { Button } from "@/components/ui/button";
import { StickyActionBar } from "@/components/brand/mobile/sticky-action-bar";
import { Faq } from "../../../_components/marketing/faq";
import { cn } from "@/lib/utils";
import { ToolSection, type SectionCopy } from "./shared";

/**
 * The mortgage page's way into the application (Bazar, 9 Oct 2026: "the
 * entire mortgage master page needs a design rethink … multiple CTAs leading
 * to the mortgage wizard"). Every piece here is drawn only while the online
 * application is open; with it closed the page is the calculator it was.
 *
 * The one loud element is the hero's panel, which IS the wizard's first step:
 * the same two services and the step it sits in, so choosing one on this page
 * carries the visitor to "Your details" with Step 1 already done
 * (`?step=details`). Everything else — the route, the bridge after the
 * calculator, the questions, the start bar, the closing band — is quiet and
 * points at the same two doors.
 */

export type StartPanelCopy = {
  step: string | null;
  title: string | null;
  sub: string | null;
  preApprovalTitle: string | null;
  preApprovalDesc: string | null;
  consultancyTitle: string | null;
  consultancyDesc: string | null;
  note: string | null;
};

export type ApplyHrefs = {
  /** Fast Pre-Approval, chosen: lands on W2. */
  preApproval: string;
  /** Mortgage Consultancy, chosen: lands on W2. */
  consultancy: string;
  /** The wizard's first step, nothing chosen yet. */
  start: string;
};

/** The wizard's three steps as a track, the first lit: where the visitor is about to be. */
function StepTrack({ label }: { label: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="flex items-center">
        <span className="size-2.5 rounded-full bg-bz-accent" />
        <span className="h-px w-6 bg-bz-border-strong" />
        <span className="size-2.5 rounded-full border border-bz-border-strong bg-bz-surface" />
        <span className="h-px w-6 bg-bz-border-strong" />
        <span className="size-2.5 rounded-full border border-bz-border-strong bg-bz-surface" />
      </div>
      {label ? <span className="text-[12.5px] text-bz-ink-2">{label}</span> : null}
    </div>
  );
}

function Choice({
  href,
  title,
  desc,
  primary,
  testId,
}: {
  href: string;
  title: string | null;
  desc: string | null;
  primary?: boolean;
  testId: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        "group flex items-start gap-4 rounded-[14px] border p-4 md:p-5 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-accent",
        primary
          ? "border-bz-navy bg-bz-navy text-white hover:bg-[color-mix(in_oklch,var(--bz-navy),black_12%)]"
          : "border-bz-border bg-bz-surface text-bz-ink hover:border-bz-ink-2",
      )}
    >
      {/* The wizard's radio, so the choice reads as the first answer it is. */}
      <span
        aria-hidden
        className={cn(
          "mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
          primary ? "border-white/70 group-hover:bg-white" : "border-bz-border-strong group-hover:border-bz-ink",
        )}
      >
        <Check
          size={11}
          strokeWidth={3}
          className={cn("opacity-0 transition-opacity group-hover:opacity-100", primary ? "text-bz-navy" : "text-bz-ink")}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="serif block text-[21px] leading-tight md:text-[23px]" style={{ letterSpacing: "-0.01em" }}>
          {title}
        </span>
        {desc ? (
          <span className={cn("mt-1 block text-[13.5px] leading-[1.5]", primary ? "text-white/80" : "text-bz-ink-2")}>
            {desc}
          </span>
        ) : null}
      </span>
      <ArrowRight
        size={18}
        strokeWidth={1.6}
        aria-hidden
        className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
      />
    </Link>
  );
}

/** The hero's right-hand side while the application is open: its first step. */
export function StartPanel({ copy, hrefs }: { copy: StartPanelCopy; hrefs: ApplyHrefs }) {
  return (
    <div
      id="start-panel"
      className="rounded-[18px] border border-bz-border bg-bz-surface p-5 text-bz-ink shadow-[0_24px_60px_-28px_rgba(0,52,82,0.45)] md:p-7"
      data-testid="mortgage-start-panel"
    >
      <StepTrack label={copy.step} />
      <h2 className="serif mt-4 text-[28px] leading-[1.08] md:text-[32px]" style={{ letterSpacing: "-0.02em" }}>
        {copy.title}
      </h2>
      {copy.sub ? <p className="mt-2 text-[14px] leading-[1.55] text-bz-ink-2">{copy.sub}</p> : null}
      <div className="mt-5 flex flex-col gap-2.5">
        <Choice href={hrefs.preApproval} title={copy.preApprovalTitle} desc={copy.preApprovalDesc} primary testId="start-preapproval" />
        <Choice href={hrefs.consultancy} title={copy.consultancyTitle} desc={copy.consultancyDesc} testId="start-consultancy" />
      </div>
      {copy.note ? <p className="mt-4 text-[12.5px] leading-[1.5] text-bz-muted">{copy.note}</p> : null}
    </div>
  );
}

export type JourneyCopy = SectionCopy & {
  steps: { title: string | null; body: string | null }[];
  ctaLabel: string | null;
};

/** How it works: the four stops from this page to a bank's answer, the last one the destination. */
export function JourneySection({ copy, href }: { copy: JourneyCopy; href: string }) {
  const steps = copy.steps.filter((s) => s.title);
  return (
    <ToolSection copy={copy} surface testId="mortgage-journey">
      <ol className="grid gap-x-6 gap-y-8 md:grid-cols-4">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={i} className="relative ps-12 md:ps-0 md:pt-12">
              {/* The route: down the side on a phone, across the top on a desktop. */}
              {!last ? (
                <span
                  aria-hidden
                  className="absolute start-[15px] top-8 bottom-[-2rem] w-px bg-bz-border-strong md:start-8 md:end-[-1.5rem] md:top-[15px] md:bottom-auto md:h-px md:w-auto"
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "mono absolute start-0 top-0 flex size-8 items-center justify-center rounded-full text-[12px]",
                  last ? "bg-bz-accent text-white" : "border border-bz-border-strong bg-bz-surface text-bz-ink",
                )}
              >
                {i + 1}
              </span>
              <h3 className="text-[16px] font-semibold text-bz-ink">{step.title}</h3>
              {step.body ? <p className="mt-1.5 max-w-[30ch] text-[14px] leading-[1.55] text-bz-ink-2">{step.body}</p> : null}
            </li>
          );
        })}
      </ol>
      {copy.ctaLabel ? (
        <Button asChild className="mt-10" data-testid="journey-cta">
          <Link href={href}>
            {copy.ctaLabel}
            <ArrowRight size={14} strokeWidth={1.6} />
          </Link>
        </Button>
      ) : null}
    </ToolSection>
  );
}

export type ApplyBridgeCopy = {
  title: string | null;
  body: string | null;
  primaryLabel: string | null;
  secondaryLabel: string | null;
};

/** `{monthly}`/`{loan}` in the line, as the visitor's own figures. */
function withFigures(template: string, figures: Record<string, string>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name && figures[name] !== undefined ? (
      <strong key={i} className="font-semibold whitespace-nowrap text-bz-ink">
        {figures[name]}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    );
  });
}

/** After the calculator: the visitor's estimate, and the step that turns it into a bank's answer. */
export function ApplyBridgeSection({
  copy,
  monthly,
  loan,
  hrefs,
}: {
  copy: ApplyBridgeCopy;
  monthly: string;
  loan: string;
  hrefs: ApplyHrefs;
}) {
  return (
    <section className="px-4 py-10 md:px-12 md:py-12" data-testid="mortgage-apply-bridge">
      <div className="grid items-center gap-6 rounded-[16px] border border-bz-border bg-bz-surface p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
        <div>
          <h2 className="serif text-[26px] leading-[1.1] md:text-[30px]" style={{ letterSpacing: "-0.015em" }}>
            {copy.title}
          </h2>
          {copy.body ? (
            <p className="mt-2 max-w-[60ch] text-[15px] leading-[1.6] text-bz-ink-2" data-testid="apply-bridge-figures">
              {withFigures(copy.body, { monthly, loan })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {copy.primaryLabel ? (
            <Button asChild size="lg" data-testid="apply-bridge-cta">
              <Link href={hrefs.preApproval}>
                {copy.primaryLabel}
                <ArrowRight size={15} strokeWidth={1.6} />
              </Link>
            </Button>
          ) : null}
          {copy.secondaryLabel ? (
            <Button asChild size="lg" variant="outline">
              <Link href={hrefs.consultancy}>{copy.secondaryLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export type QuestionsCopy = SectionCopy & { items: [string, string][] };

/** What people ask before they apply, in the site's own question list. */
export function QuestionsSection({ copy }: { copy: QuestionsCopy }) {
  if (copy.items.length === 0) return null;
  return (
    <ToolSection copy={copy} testId="mortgage-questions">
      <div className="max-w-[860px]">
        <Faq items={copy.items} />
      </div>
    </ToolSection>
  );
}

/**
 * The start bar: once the hero's panel has scrolled away, a slim bar offers
 * the same start; it steps aside again over the closing band, which says the
 * same thing larger. A floating bar on a desktop, the site's sticky action bar
 * on a phone.
 */
export function StartBar({ text, cta, href }: { text: string | null; cta: string | null; href: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const panel = document.getElementById("start-panel");
    const close = document.querySelector('[data-testid="pre-approval-section"]');
    if (!panel) return;
    // Measured on scroll rather than observed: a jump to the foot of the page
    // can carry the closing band past the screen without it ever intersecting.
    let frame = 0;
    const measure = () => {
      frame = 0;
      const pastPanel = panel.getBoundingClientRect().bottom < 0;
      // On the closing band, or past it (the footer below): the band has said it.
      const closeReached = close ? close.getBoundingClientRect().top < window.innerHeight : false;
      setShow(pastPanel && !closeReached);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  if (!cta) return null;
  return (
    <>
      <div
        aria-hidden={!show}
        data-testid="mortgage-start-bar"
        data-shown={show || undefined}
        className={cn(
          "fixed bottom-6 start-1/2 z-30 hidden -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-bz-navy py-2 ps-6 pe-2 text-white shadow-[0_18px_40px_-16px_rgba(0,52,82,0.6)] md:flex rtl:translate-x-1/2",
          "motion-safe:transition-[opacity,transform] motion-safe:duration-300",
          show ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        {text ? <span className="text-[14px] whitespace-nowrap">{text}</span> : null}
        <Link
          href={href}
          tabIndex={show ? undefined : -1}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium whitespace-nowrap text-bz-navy hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {cta}
          <ArrowRight size={15} strokeWidth={1.7} aria-hidden />
        </Link>
      </div>
      <StickyActionBar
        className={cn(
          "md:hidden motion-safe:transition-transform motion-safe:duration-300",
          show ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
      >
        {text ? <span className="min-w-0 flex-1 text-[13px] leading-snug text-bz-ink-2">{text}</span> : null}
        <Button asChild className="shrink-0" tabIndex={show ? undefined : -1}>
          <Link href={href}>{cta}</Link>
        </Button>
      </StickyActionBar>
    </>
  );
}

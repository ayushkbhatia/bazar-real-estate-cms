"use client";

import Link from "@/components/i18n/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Calendar, MessageCircle } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResolvedForm } from "@/lib/forms/types";
import { FormRenderer } from "@/app/[locale]/(public)/_components/forms/form-renderer";
import { MORTGAGE_FORM_ANCHOR } from "@/lib/master-pages/sections/mortgage";

/**
 * The band's words, resolved from Pages & blocks by the page.
 *
 * Every entry is nullable because a master-page field is nullable: an editor
 * who clears the eyebrow means "no eyebrow", not "fall back to the one I just
 * deleted". The band renders around whatever survives.
 */
export type PreApprovalCopy = {
  eyebrow: string | null;
  title: string | null;
  sub: string | null;
  scenarioLabel: string | null;
  scenarioNote: string | null;
  talkLabel: string | null;
  advisorCtaLabel: string | null;
  advisorCtaHref: string;
  whatsappCtaLabel: string | null;
  fallbackCtaLabel: string | null;
  jumpCtaLabel: string | null;
};

type Props = {
  copy: PreApprovalCopy;
  form: ResolvedForm;
  /** The recap the visitor reads, in their own currency. */
  scenarioLines: { key: string; value: string }[];
  /** The same scenario in AED and English — what the desk reads. */
  scenarioBrief: string;
  /** wa.me link with the scenario prefilled, or null when unconfigured. */
  waLink: string | null;
  /**
   * The form is drawing in the hero, so this band closes with a button that
   * scrolls back up to it rather than a second copy of the same form.
   */
  formInHero: boolean;
};

/**
 * The card the hero holds when the form lives up there.
 *
 * Exported because the hero is assembled by the page, not by this section —
 * but the form and its context belong together wherever they are drawn, and a
 * second call site building its own `FormRenderer` would be a second place to
 * forget the scenario context.
 */
export function PreApprovalFormCard({
  form,
  scenarioBrief,
}: {
  form: ResolvedForm;
  scenarioBrief: string;
}) {
  return (
    <div
      className="rounded-lg border border-bz-border bg-bz-surface p-6 md:p-7"
      data-testid="pre-approval-form"
    >
      <FormRenderer
        form={form}
        context={{ scenario: scenarioBrief }}
        successStyle="serif"
      />
    </div>
  );
}

export function PreApprovalSection({
  copy,
  form,
  scenarioLines,
  scenarioBrief,
  waLink,
  formInHero,
}: Props) {
  const t = useTranslations("tools");

  // Two switches, deliberately separate. The SECTION toggle in Pages & blocks
  // removes this band; the FORM toggle in /admin/forms removes the form and
  // leaves the band as the WhatsApp-and-advisor row it was before the form
  // existed. An editor who wanted the second should not get the first.
  const showForm = form.enabled && !formInHero;
  const showRecap = form.enabled;

  return (
    <section
      className="px-4 md:px-12 py-12 md:py-16 border-t border-bz-border"
      data-testid="pre-approval-section"
    >
      <div
        className={cn(
          "bg-bz-accent-soft rounded-xl p-6 md:p-8 gap-6",
          showForm
            ? "grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,430px)] lg:gap-12 [&>*]:min-w-0"
            : "flex flex-wrap items-center justify-between",
        )}
      >
        <div>
          {copy.eyebrow ? (
            <Eyebrow className="text-bz-accent">{copy.eyebrow}</Eyebrow>
          ) : null}
          <h2
            className={cn(
              "serif mt-1.5",
              showForm
                ? "text-[26px] md:text-[32px] leading-[1.1]"
                : "text-[26px]",
            )}
            style={{ letterSpacing: "-0.015em" }}
          >
            {copy.title}
          </h2>
          {copy.sub ? (
            <p className="text-[13.5px] text-bz-ink-2 mt-1.5">{copy.sub}</p>
          ) : null}

          {showForm ? (
            <>
              {/* The visitor should be able to see what they're sending. */}
              <div
                className="mt-6 rounded-lg border border-bz-border bg-bz-surface p-5"
                data-testid="pre-approval-scenario"
              >
                {copy.scenarioLabel ? (
                  <Eyebrow>{copy.scenarioLabel}</Eyebrow>
                ) : null}
                <dl className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {scenarioLines.map(({ key, value }) => (
                    <div key={key}>
                      <dt className="text-[11.5px] text-bz-muted">
                        {t(`mortgage.${key}`)}
                      </dt>
                      <dd className="mono text-[13.5px] text-bz-ink mt-0.5">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {copy.scenarioNote ? (
                  <p className="text-[11.5px] text-bz-muted mt-4 pt-3.5 border-t border-bz-border">
                    {copy.scenarioNote}
                  </p>
                ) : null}
              </div>

              {copy.talkLabel ? (
                <p className="text-[13px] text-bz-ink-2 mt-6">
                  {copy.talkLabel}
                </p>
              ) : null}
            </>
          ) : null}

          <div className={cn("flex flex-wrap gap-2", showForm && "mt-2.5")}>
            {copy.advisorCtaLabel ? (
              <Button asChild variant="outline">
                <Link href={copy.advisorCtaHref}>
                  <Calendar size={14} strokeWidth={1.6} />
                  {copy.advisorCtaLabel}
                </Link>
              </Button>
            ) : null}

            {formInHero && showRecap ? (
              // Same-page anchor, so a plain <a>: next/link would treat "#…"
              // as a route push.
              <Button asChild data-testid="pre-approval-cta">
                <a href={`#${MORTGAGE_FORM_ANCHOR}`}>
                  {copy.jumpCtaLabel}
                  <ArrowRight size={14} strokeWidth={1.6} />
                </a>
              </Button>
            ) : waLink ? (
              <Button
                asChild
                variant={showForm ? "outline" : "default"}
                data-testid="pre-approval-cta"
              >
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} strokeWidth={1.6} />
                  {copy.whatsappCtaLabel}
                  <ArrowRight size={14} strokeWidth={1.6} />
                </a>
              </Button>
            ) : (
              <Button
                asChild
                variant={showForm ? "outline" : "default"}
                data-testid="pre-approval-cta"
              >
                <Link href="/contact?source=mortgage">
                  {copy.fallbackCtaLabel}
                  <ArrowRight size={14} strokeWidth={1.6} />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {showForm ? (
          <PreApprovalFormCard form={form} scenarioBrief={scenarioBrief} />
        ) : null}
      </div>
    </section>
  );
}

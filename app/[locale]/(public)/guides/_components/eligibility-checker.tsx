"use client";

/**
 * T3-C: shared multi-step eligibility checker used across the
 * /guides/* cluster.  Pure client-side — no backend, no state stored,
 * no PII.  Each guide passes a custom `steps` config and a `decide`
 * function that maps the captured answers to a result + advisor next-step.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * A step and its choices, as keys rather than words.
 *
 * `value` is what `decide()` branches on and what a `data-` attribute would
 * carry; it is identity and never moves. `hint` is a boolean rather than a
 * string because the question is only ever "does this choice have one" — the
 * hint itself lives beside the label in the catalogue.
 */
export type Step = {
  key: string;
  choices: { value: string; hint?: boolean }[];
};

/**
 * What `decide()` returns: a decision, not a paragraph.
 *
 * It used to return the title, the copy, the next-step sentences and the CTA
 * label — five or six English strings per branch, in a pure function whose
 * whole job is the branching. Same shape `lib/mortgage.ts` and `lib/compare.ts`
 * carried before waves 4a and 4c, and the same fix: the function names the
 * outcome and the component renders it.
 *
 * `nextSteps` is a count rather than a list because the sentences are in the
 * catalogue and only their number is a property of the branch. `cta` says
 * whether this outcome overrides the default advisor CTA.
 */
export type Outcome = {
  status: "eligible" | "likely" | "borderline" | "ineligible";
  /** Message key under `checker.<checker>.outcome.<key>`. */
  key: string;
  nextSteps: number;
  cta?: true;
} | null;

type Props = {
  /**
   * Which checker this is — the message key under `checker.*`, and the only
   * thing the shell needs to resolve every string it renders.
   */
  checker: string;
  steps: Step[];
  decide: (answers: Record<string, string>) => Outcome;
  /** /contact route + intent param so the advisor CTA pre-fills properly. */
  contactIntent: string;
};

export function EligibilityChecker({
  checker,
  steps,
  decide,
  contactIntent,
}: Props) {
  const t = useTranslations("guides");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const isLast = index === steps.length - 1;
  const step = steps[index]!;
  const current = answers[step.key];
  const allAnswered = steps.every((s) => answers[s.key] != null);
  const outcome = allAnswered ? decide(answers) : null;

  function choose(value: string) {
    setAnswers((prev) => ({ ...prev, [step.key]: value }));
  }

  function reset() {
    setAnswers({});
    setIndex(0);
  }

  return (
    <section className="px-4 md:px-12 py-16 border-t border-bz-border bg-bz-surface-2">
      <Eyebrow>{t("checker.shell.eyebrow")}</Eyebrow>
      <h2
        className="serif text-[28px] md:text-[36px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {t(`checker.${checker}.title`)}
      </h2>
      <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
        {t(`checker.${checker}.intro`)}
      </p>

      <div className="mt-9 max-w-[640px] rounded-lg border border-bz-border bg-bz-surface p-7">
        {outcome ? (
          <OutcomeCard
            checker={checker}
            outcome={outcome}
            onReset={reset}
            contactIntent={contactIntent}
          />
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i <= index ? "bg-bz-navy" : "bg-bz-border",
                  )}
                />
              ))}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-bz-ink-2">
              {t("checker.shell.stepCounter", {
                n: index + 1,
                total: steps.length,
              })}
            </div>
            <h3
              className="serif text-[24px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              {t(`checker.${checker}.step.${step.key}.question`)}
            </h3>
            <ul className="mt-5 flex flex-col gap-2">
              {step.choices.map((c) => (
                <li key={c.value}>
                  <button
                    type="button"
                    onClick={() => choose(c.value)}
                    aria-pressed={current === c.value}
                    className={cn(
                      "w-full text-start p-3 rounded-md border transition-colors",
                      current === c.value
                        ? "border-bz-navy bg-bz-navy/5"
                        : "border-bz-border bg-bz-bg hover:border-bz-ink/40",
                    )}
                  >
                    <div className="text-[14px] text-bz-ink">
                      {t(
                        `checker.${checker}.step.${step.key}.choice.${c.value}.label`,
                      )}
                    </div>
                    {c.hint ? (
                      <div className="mt-0.5 text-[12px] text-bz-ink-2">
                        {t(
                          `checker.${checker}.step.${step.key}.choice.${c.value}.hint`,
                        )}
                      </div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ArrowLeft size={13} strokeWidth={1.7} />
                {t("checker.shell.back")}
              </Button>
              <Button
                size="sm"
                disabled={!current}
                onClick={() => {
                  if (!isLast) setIndex((i) => i + 1);
                }}
              >
                {t(isLast ? "checker.shell.seeResult" : "checker.shell.next")}
                <ArrowRight size={13} strokeWidth={1.7} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function OutcomeCard({
  checker,
  outcome,
  onReset,
  contactIntent,
}: {
  checker: string;
  outcome: NonNullable<Outcome>;
  onReset: () => void;
  contactIntent: string;
}) {
  const t = useTranslations("guides");
  const base = `checker.${checker}.outcome.${outcome.key}`;
  const isEligible = outcome.status === "eligible" || outcome.status === "likely";
  const Icon = isEligible ? Check : X;
  const iconBg = isEligible
    ? "bg-bz-accent/15 text-bz-accent"
    : "bg-bz-border text-bz-ink-2";

  return (
    <div>
      <div
        className={cn(
          "w-12 h-12 rounded-full inline-flex items-center justify-center",
          iconBg,
        )}
      >
        <Icon size={22} strokeWidth={1.8} />
      </div>
      {/*
        The status used to render as the raw enum with its underscores swapped
        for spaces — an identity leaking onto the page as a label, so the word
        a visitor read was whatever the branch happened to be called.
      */}
      <div className="mt-4 text-[11px] uppercase tracking-wider text-bz-ink-2">
        {t(`checker.shell.status.${outcome.status}`)}
      </div>
      <h3
        className="serif text-[28px] mt-1 leading-tight"
        style={{ letterSpacing: "-0.018em" }}
      >
        {t(`${base}.title`)}
      </h3>
      <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed">
        {t(`${base}.copy`)}
      </p>
      {outcome.nextSteps > 0 ? (
        <div className="mt-5 pt-5 border-t border-bz-border">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-2">
            {t("checker.shell.whatNext")}
          </div>
          <ol className="flex flex-col gap-2 list-decimal ps-5">
            {Array.from({ length: outcome.nextSteps }, (_, i) => (
              <li key={i} className="text-[14px] text-bz-ink leading-relaxed">
                {t(`${base}.next.${i + 1}`)}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <Button asChild>
          <a href={`/contact?intent=${encodeURIComponent(contactIntent)}`}>
            {t(outcome.cta ? `${base}.cta` : "checker.shell.defaultCta")}
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
          {t("checker.shell.restart")}
        </Button>
      </div>
    </div>
  );
}

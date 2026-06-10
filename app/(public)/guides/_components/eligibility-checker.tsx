"use client";

/**
 * T3-C: shared multi-step eligibility checker used across the
 * /guides/* cluster.  Pure client-side — no backend, no state stored,
 * no PII.  Each guide passes a custom `steps` config and a `decide`
 * function that maps the captured answers to a result + advisor next-step.
 */

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/eyebrow";

type Choice = {
  value: string;
  label: string;
  hint?: string;
};

export type Step = {
  key: string;
  question: string;
  choices: Choice[];
};

export type Outcome =
  | {
      status: "eligible" | "likely" | "borderline" | "ineligible";
      title: string;
      copy: string;
      nextSteps: string[];
      advisorCtaLabel?: string;
    }
  | null;

type Props = {
  title: string;
  intro: string;
  steps: Step[];
  decide: (answers: Record<string, string>) => Outcome;
  /** /contact route + intent param so the advisor CTA pre-fills properly. */
  contactIntent: string;
};

export function EligibilityChecker({
  title,
  intro,
  steps,
  decide,
  contactIntent,
}: Props) {
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
      <Eyebrow>Eligibility checker</Eyebrow>
      <h2
        className="serif text-[28px] md:text-[36px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {title}
      </h2>
      <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
        {intro}
      </p>

      <div className="mt-9 max-w-[640px] rounded-lg border border-bz-border bg-bz-surface p-7">
        {outcome ? (
          <OutcomeCard
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
                    i <= index ? "bg-bz-ink" : "bg-bz-border",
                  )}
                />
              ))}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-bz-ink-2">
              Step {index + 1} of {steps.length}
            </div>
            <h3
              className="serif text-[24px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              {step.question}
            </h3>
            <ul className="mt-5 flex flex-col gap-2">
              {step.choices.map((c) => (
                <li key={c.value}>
                  <button
                    type="button"
                    onClick={() => choose(c.value)}
                    aria-pressed={current === c.value}
                    className={cn(
                      "w-full text-left p-3 rounded-md border transition-colors",
                      current === c.value
                        ? "border-bz-ink bg-bz-ink/5"
                        : "border-bz-border bg-bz-bg hover:border-bz-ink/40",
                    )}
                  >
                    <div className="text-[14px] text-bz-ink">{c.label}</div>
                    {c.hint ? (
                      <div className="mt-0.5 text-[12px] text-bz-ink-2">
                        {c.hint}
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
                Back
              </Button>
              <Button
                size="sm"
                disabled={!current}
                onClick={() => {
                  if (!isLast) setIndex((i) => i + 1);
                }}
              >
                {isLast ? "See result" : "Next"}
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
  outcome,
  onReset,
  contactIntent,
}: {
  outcome: NonNullable<Outcome>;
  onReset: () => void;
  contactIntent: string;
}) {
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
      <div className="mt-4 text-[11px] uppercase tracking-wider text-bz-ink-2">
        {outcome.status.replace(/_/g, " ")}
      </div>
      <h3
        className="serif text-[28px] mt-1 leading-tight"
        style={{ letterSpacing: "-0.018em" }}
      >
        {outcome.title}
      </h3>
      <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed">
        {outcome.copy}
      </p>
      {outcome.nextSteps.length > 0 ? (
        <div className="mt-5 pt-5 border-t border-bz-border">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-2">
            What to do next
          </div>
          <ol className="flex flex-col gap-2 list-decimal pl-5">
            {outcome.nextSteps.map((s, i) => (
              <li key={i} className="text-[14px] text-bz-ink leading-relaxed">
                {s}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <Button asChild>
          <a href={`/contact?intent=${encodeURIComponent(contactIntent)}`}>
            {outcome.advisorCtaLabel ?? "Talk to a Bazar advisor"}
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
          Restart
        </Button>
      </div>
    </div>
  );
}

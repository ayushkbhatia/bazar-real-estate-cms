"use client";

import {
  EligibilityChecker,
  type Outcome,
  type Step,
} from "../_components/eligibility-checker";

/** Identity only — the words live under `checker.taxResidency.step.*`. */
const STEPS: Step[] = [
  {
    key: "days",
    choices: [
      { value: "183_plus" },
      { value: "90_to_182", hint: true },
      { value: "below_90" },
    ],
  },
  {
    key: "anchor",
    choices: [
      { value: "permanent_home" },
      { value: "employment" },
      { value: "business" },
      { value: "none" },
    ],
  },
  {
    key: "treaty",
    choices: [
      { value: "yes" },
      { value: "domestic_only" },
      { value: "unsure" },
    ],
  },
];

/**
 * The FTA's two tests, in the order they exclude.
 *
 * `treaty` is captured but does not branch: it steers the advisor
 * conversation rather than the eligibility result, which is a real
 * distinction and not an oversight.
 */
function decide(answers: Record<string, string>): Outcome {
  const { days, anchor } = answers;

  if (days === "below_90" && anchor === "none") {
    return { status: "ineligible", key: "notEligible", nextSteps: 2 };
  }
  if (days === "183_plus") {
    return { status: "eligible", key: "via183", nextSteps: 2, cta: true };
  }
  if (days === "90_to_182" && anchor !== "none") {
    return { status: "likely", key: "via90Anchor", nextSteps: 2, cta: true };
  }
  return { status: "borderline", key: "borderline", nextSteps: 2 };
}

export function TaxResidencyChecker() {
  return (
    <EligibilityChecker
      checker="taxResidency"
      steps={STEPS}
      decide={decide}
      contactIntent="tax-residency"
    />
  );
}

"use client";

import {
  EligibilityChecker,
  type Outcome,
  type Step,
} from "../_components/eligibility-checker";

/** Identity only — the words live under `checker.propertyResidency.step.*`. */
const STEPS: Step[] = [
  {
    key: "value",
    choices: [{ value: "above_750k" }, { value: "below_750k" }],
  },
  {
    key: "mortgage",
    choices: [
      { value: "no_mortgage" },
      { value: "mortgage_below_50" },
      { value: "mortgage_above_50" },
    ],
  },
  {
    key: "stage",
    choices: [{ value: "ready" }, { value: "off_plan" }],
  },
];

/**
 * Threshold, then handover, then leverage.
 *
 * Off-plan is checked before the mortgage because it is the harder blocker:
 * an unhanded-over property cannot qualify at any loan-to-value, so telling
 * the visitor about a lender NOC first would be advice they cannot act on.
 */
function decide(answers: Record<string, string>): Outcome {
  if (answers.value === "below_750k") {
    return { status: "ineligible", key: "belowThreshold", nextSteps: 1 };
  }
  if (answers.stage === "off_plan") {
    return { status: "borderline", key: "offPlan", nextSteps: 2 };
  }
  if (answers.mortgage === "mortgage_above_50") {
    return { status: "borderline", key: "lenderNoc", nextSteps: 2 };
  }
  return { status: "eligible", key: "eligible", nextSteps: 3, cta: true };
}

export function PropertyResidencyChecker() {
  return (
    <EligibilityChecker
      checker="propertyResidency"
      steps={STEPS}
      decide={decide}
      contactIntent="residency-2yr"
    />
  );
}

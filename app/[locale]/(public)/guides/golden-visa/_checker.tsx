"use client";

import {
  EligibilityChecker,
  type Outcome,
  type Step,
} from "../_components/eligibility-checker";

/**
 * The questions, as identity only.
 *
 * `value` is what `decide()` branches on; the words live in
 * `messages/en/guides.json` under `checker.goldenVisa.step.*`. `hint: true`
 * says a choice has one, not what it says.
 */
const STEPS: Step[] = [
  {
    key: "value",
    choices: [
      { value: "above_2m", hint: true },
      { value: "1m_to_2m" },
      { value: "750k_to_1m", hint: true },
      { value: "below_750k" },
    ],
  },
  {
    key: "ownership",
    choices: [
      { value: "personal" },
      { value: "joint" },
      { value: "company" },
      { value: "mortgaged" },
    ],
  },
  {
    key: "stage",
    choices: [
      { value: "ready_titled" },
      { value: "off_plan_50pct" },
      { value: "off_plan_below50" },
    ],
  },
];

/**
 * The branching, with the prose taken out.
 *
 * Order matters and is the product decision: the value bands are checked
 * before the ownership structure, so someone at AED 1.5M in a company name is
 * told about the 2-year route rather than about restructuring they do not yet
 * need.
 */
function decide(answers: Record<string, string>): Outcome {
  const { value, ownership, stage } = answers;

  if (value === "below_750k") {
    return { status: "ineligible", key: "belowThreshold", nextSteps: 2, cta: true };
  }
  if (value === "750k_to_1m" || value === "1m_to_2m") {
    return { status: "borderline", key: "twoYearBand", nextSteps: 2, cta: true };
  }
  if (ownership === "company") {
    return { status: "borderline", key: "companyHeld", nextSteps: 2, cta: true };
  }
  if (stage === "off_plan_below50") {
    return { status: "likely", key: "offPlanUnder50", nextSteps: 2 };
  }
  return { status: "eligible", key: "eligible", nextSteps: 3, cta: true };
}

export function GoldenVisaChecker() {
  return (
    <EligibilityChecker
      checker="goldenVisa"
      steps={STEPS}
      decide={decide}
      contactIntent="golden-visa"
    />
  );
}

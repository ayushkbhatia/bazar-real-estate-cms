"use client";

import {
  EligibilityChecker,
  type Outcome,
  type Step,
} from "../_components/eligibility-checker";

const STEPS: Step[] = [
  {
    key: "value",
    question: "What's the property value?",
    choices: [
      { value: "above_750k", label: "AED 750K or more" },
      { value: "below_750k", label: "Below AED 750K" },
    ],
  },
  {
    key: "mortgage",
    question: "Is the property mortgaged?",
    choices: [
      { value: "no_mortgage", label: "No, paid in full" },
      { value: "mortgage_below_50", label: "Yes — mortgage covers less than 50% of value" },
      { value: "mortgage_above_50", label: "Yes — mortgage covers 50% or more" },
    ],
  },
  {
    key: "stage",
    question: "Is the property ready and titled?",
    choices: [
      { value: "ready", label: "Yes — titled and registered" },
      { value: "off_plan", label: "Off-plan, still under construction" },
    ],
  },
];

function decide(answers: Record<string, string>): Outcome {
  if (answers.value === "below_750k") {
    return {
      status: "ineligible",
      title: "Below the AED 750K threshold",
      copy: "The 2-year residency requires AED 750K+ on the title. Look at projects above that line or consider scaling up — Bazar's advisors regularly run shortlists at the 750K-1M sweet spot.",
      nextSteps: ["Discuss a qualifying-range brief with an advisor"],
    };
  }

  if (answers.stage === "off_plan") {
    return {
      status: "borderline",
      title: "Eligible once the property hands over",
      copy: "The 2-year visa is granted against a registered title deed, which off-plan property doesn't have until handover. The good news: developer payment progress doesn't change this — only handover does.",
      nextSteps: [
        "Track the handover date with the developer",
        "Pre-stage paperwork so day-1 application is clean",
      ],
    };
  }

  if (answers.mortgage === "mortgage_above_50") {
    return {
      status: "borderline",
      title: "Lender NOC required",
      copy: "When the outstanding mortgage exceeds 50% of the property value, ICP requires the lender's NOC plus proof that you've serviced the loan on schedule for 12+ months. Achievable, just means an extra week or two of paperwork.",
      nextSteps: [
        "Request the lender NOC",
        "Compile 12 months of repayment statements",
      ],
    };
  }

  return {
    status: "eligible",
    title: "You should qualify for the 2-year residency",
    copy: "AED 750K+ on title, mortgage-clean or under 50% leveraged, ready property — the textbook profile. End-to-end timeline is typically 3–4 weeks once the medical slot opens up.",
    nextSteps: [
      "Compile passport, title deed, valuation, dependants paperwork",
      "Book the medical + Emirates ID slot",
      "Submit via ICP — 3–4 week clearance window",
    ],
    advisorCtaLabel: "Engage the visa desk",
  };
}

export function PropertyResidencyChecker() {
  return (
    <EligibilityChecker
      title="Are you on the right side of the threshold?"
      intro="Three questions about the asset. The result is directional; your advisor will pressure-test it before any application is filed."
      steps={STEPS}
      decide={decide}
      contactIntent="residency-2yr"
    />
  );
}

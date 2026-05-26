"use client";

import {
  EligibilityChecker,
  type Outcome,
  type Step,
} from "../_components/eligibility-checker";

const STEPS: Step[] = [
  {
    key: "days",
    question: "How many days will you spend in the UAE this tax year?",
    choices: [
      { value: "183_plus", label: "183+ days" },
      { value: "90_to_182", label: "90–182 days", hint: "Qualifies if certain other conditions are met" },
      { value: "below_90", label: "Below 90 days" },
    ],
  },
  {
    key: "anchor",
    question: "Which best describes your UAE anchor?",
    choices: [
      { value: "permanent_home", label: "I own or rent a permanent home in the UAE" },
      { value: "employment", label: "I'm employed by a UAE entity" },
      { value: "business", label: "I run a UAE business / I'm a partner" },
      { value: "none", label: "None of the above" },
    ],
  },
  {
    key: "treaty",
    question: "Do you need to break tax residency in another country via a treaty?",
    choices: [
      { value: "yes", label: "Yes — I want a treaty-grade certificate" },
      { value: "domestic_only", label: "No — UAE domestic certificate is enough" },
      { value: "unsure", label: "Not sure" },
    ],
  },
];

function decide(answers: Record<string, string>): Outcome {
  const days = answers.days!;
  const anchor = answers.anchor!;

  if (days === "below_90" && anchor === "none") {
    return {
      status: "ineligible",
      title: "Not eligible this tax year",
      copy: "Both pathways require either physical presence or a UAE anchor (home, employment, or business). With neither, the Federal Tax Authority will reject the application.",
      nextSteps: [
        "Plan to spend at least 90 days in the UAE next tax year",
        "Or establish a permanent home / employment / business",
      ],
    };
  }

  if (days === "183_plus") {
    return {
      status: "eligible",
      title: "Eligible via the 183-day route",
      copy: "Physical presence of 183+ days in the UAE during the tax year qualifies you directly — no further conditions. Application turnaround is typically 4–6 weeks once your travel records are compiled.",
      nextSteps: [
        "Compile passport stamps + UAE entry/exit records",
        "Request the certificate via the FTA portal",
      ],
      advisorCtaLabel: "Get help compiling the application",
    };
  }

  if (days === "90_to_182" && anchor !== "none") {
    return {
      status: "likely",
      title: "Eligible via the 90-day + anchor route",
      copy: "90–182 days plus a UAE anchor (home, employment, or business) qualifies you under the FTA's secondary test. You'll need to evidence the anchor — title deed, tenancy contract, Emirates ID, trade licence, salary certificate, depending on which applies.",
      nextSteps: [
        "Compile travel records + anchor evidence",
        "Submit through the FTA portal",
      ],
      advisorCtaLabel: "Get help compiling the application",
    };
  }

  return {
    status: "borderline",
    title: "Borderline — case-by-case",
    copy: "Your profile sits in the FTA's discretionary zone. With evidence of substantial UAE economic activity (e.g. a fully-owned UAE company drawing your income, a UAE-titled primary residence) the certificate is often granted, but it's not automatic. Worth a 30-minute advisor call to map your case.",
    nextSteps: [
      "Book a 30-minute consult to map evidence",
      "Identify any gaps before applying",
    ],
  };
}

export function TaxResidencyChecker() {
  return (
    <EligibilityChecker
      title="Where do you land on the FTA's two tests?"
      intro="Three questions about days, anchor, and treaty intent. The result is directional only — for borderline cases, a cross-border tax adviser is essential before filing."
      steps={STEPS}
      decide={decide}
      contactIntent="tax-residency"
    />
  );
}

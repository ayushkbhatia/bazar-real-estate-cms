"use client";

import {
  EligibilityChecker,
  type Outcome,
  type Step,
} from "../_components/eligibility-checker";

const STEPS: Step[] = [
  {
    key: "value",
    question: "What's the property value you're considering?",
    choices: [
      { value: "above_2m", label: "AED 2M or more", hint: "Golden Visa threshold" },
      { value: "1m_to_2m", label: "Between AED 1M and AED 2M" },
      { value: "750k_to_1m", label: "AED 750K – 1M", hint: "2-year residency threshold" },
      { value: "below_750k", label: "Below AED 750K" },
    ],
  },
  {
    key: "ownership",
    question: "How will the property be owned?",
    choices: [
      { value: "personal", label: "In my personal name" },
      { value: "joint", label: "Jointly with my spouse" },
      { value: "company", label: "In a company name" },
      { value: "mortgaged", label: "Partly mortgaged" },
    ],
  },
  {
    key: "stage",
    question: "Where is the property in its lifecycle?",
    choices: [
      { value: "ready_titled", label: "Ready and titled" },
      { value: "off_plan_50pct", label: "Off-plan, 50%+ paid" },
      { value: "off_plan_below50", label: "Off-plan, less than 50% paid" },
    ],
  },
];

function decide(answers: Record<string, string>): Outcome {
  const value = answers.value!;
  const ownership = answers.ownership!;
  const stage = answers.stage!;

  if (value === "below_750k") {
    return {
      status: "ineligible",
      title: "Below the residency threshold today",
      copy: "AED 750K is the minimum for the 2-year property-linked residency. Step up the budget or wait for the right project — a Bazar advisor can build a brief that lands you in the qualifying band.",
      nextSteps: [
        "Discuss a brief and a target qualifying range",
        "Consider the 2-year route (AED 750K+) as an interim step",
      ],
      advisorCtaLabel: "Talk through eligibility",
    };
  }

  if (value === "750k_to_1m" || value === "1m_to_2m") {
    return {
      status: "borderline",
      title: "Eligible for 2-year residency, not Golden Visa yet",
      copy: "The 2-year property-linked residency requires AED 750K+; you're inside that band. The 10-year Golden Visa needs AED 2M+ — close but not there yet. The 2-year route is renewable and gets you into the country while you scale up.",
      nextSteps: [
        "Apply for the 2-year visa first to lock in residency",
        "Plan the upgrade path to AED 2M+ over 12–18 months",
      ],
      advisorCtaLabel: "Plan the 2-year + upgrade path",
    };
  }

  if (ownership === "company") {
    return {
      status: "borderline",
      title: "Company-held property doesn't qualify directly",
      copy: "The visa is granted on the owner of record. If the property is held by a company, ICP will check the beneficial-ownership structure but won't grant the visa to a corporate. Your advisor can restructure to personal title before the application.",
      nextSteps: [
        "Restructure to personal title pre-application",
        "Confirm the transfer fees + timeline with conveyancing",
      ],
      advisorCtaLabel: "Discuss restructuring",
    };
  }

  if (stage === "off_plan_below50") {
    return {
      status: "likely",
      title: "Eligible — once you cross the 50% paid threshold",
      copy: "ICP applies the Golden Visa to off-plan property only after the developer has issued the 50%-paid certificate. Stay the course, hit the milestone, and you're in. Bazar's visa desk can pre-stage your paperwork so the day-1 submission is smooth.",
      nextSteps: [
        "Track the 50% paid milestone with the developer",
        "Pre-compile passport, valuation, NOC, dependants",
      ],
    };
  }

  return {
    status: "eligible",
    title: "You should qualify for the 10-year Golden Visa",
    copy: "AED 2M+ in personal name on a ready or majority-paid off-plan property is the canonical Golden Visa profile. ICP processing typically lands in 4–6 weeks once paperwork is complete. Bazar's visa desk handles the entire flow — eligibility check, documentation, medical, Emirates ID, dependants.",
    nextSteps: [
      "Compile passport, title deed, valuation, dependants paperwork",
      "Book the medical + Emirates ID slot",
      "Submit through ICP — typical 4–6 week clearance window",
    ],
    advisorCtaLabel: "Engage the visa desk",
  };
}

export function GoldenVisaChecker() {
  return (
    <EligibilityChecker
      title="Check where you land in 90 seconds."
      intro="Three questions about the property and the ownership structure. The result is directional — your Bazar advisor will tighten it against your specific paperwork before any application is filed."
      steps={STEPS}
      decide={decide}
      contactIntent="golden-visa"
    />
  );
}

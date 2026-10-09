"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MORTGAGE_FLOW_DEFAULTS, type MortgageFlowSettings } from "@/lib/master-pages/wizard-flow";

const WizardFlowContext = createContext<MortgageFlowSettings>({ ...MORTGAGE_FLOW_DEFAULTS });

/** The Flow switches from Pages & blocks → Wizards → Mortgage application, for the steps that read them. */
export function WizardFlowProvider({ flow, children }: { flow: MortgageFlowSettings; children: ReactNode }) {
  return <WizardFlowContext.Provider value={flow}>{children}</WizardFlowContext.Provider>;
}

export function useWizardFlow(): MortgageFlowSettings {
  return useContext(WizardFlowContext);
}

"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MORTGAGE_FLOW_DEFAULTS, type MortgageFlowSettings } from "@/lib/master-pages/wizard-flow";
import type { DocKind } from "@/lib/mortgage-requests/documents";

export type DocArt = Partial<Record<DocKind, string>>;

const WizardFlowContext = createContext<MortgageFlowSettings>({ ...MORTGAGE_FLOW_DEFAULTS });
const DocArtContext = createContext<DocArt>({});

/**
 * The Flow switches from Pages & blocks → Wizards → Mortgage application, for
 * the steps that read them, and the document icons an editor uploaded there.
 */
export function WizardFlowProvider({ flow, docArt = {}, children }: { flow: MortgageFlowSettings; docArt?: DocArt; children: ReactNode }) {
  return (
    <WizardFlowContext.Provider value={flow}>
      <DocArtContext.Provider value={docArt}>{children}</DocArtContext.Provider>
    </WizardFlowContext.Provider>
  );
}

export function useWizardFlow(): MortgageFlowSettings {
  return useContext(WizardFlowContext);
}

/** The uploaded icon for each document kind that has one. */
export function useDocArt(): DocArt {
  return useContext(DocArtContext);
}

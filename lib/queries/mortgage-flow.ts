import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * The mortgage application flow's entry points (docs/mortgage/SPEC.md §4.1).
 *
 * Public pages show them only when the `mortgage_requests` flag is `public`.
 * The flag lives in `mortgage_settings`, which visitors can't read; the
 * `mortgage_flow_public()` function (0141) answers the one question with the
 * cookie-free client, so asking doesn't take a page off prerendering. Any
 * failure — the function not deployed yet, a database blip — reads as
 * "closed", and the page keeps the links it had before.
 *
 * A flipped flag reaches a prerendered page at its next revalidation.
 */
export const isMortgageFlowPublic = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured) return false;
  try {
    const { data, error } = await createSupabasePublicClient().rpc("mortgage_flow_public");
    return !error && data === true;
  } catch {
    return false;
  }
});

/** The entry links: SPEC §4.1's five, and the mortgage page's start buttons. */
export const MORTGAGE_ENTRY_LINKS = {
  home: "/mortgages/apply?service=pre_approval&from=home",
  calculatorPreApproval: "/mortgages/apply?service=pre_approval&from=calculator_preapproval",
  calculatorAdvisor: "/mortgages/apply?service=consultancy&from=calculator_advisor",
  servicesMenu: "/mortgages/apply?service=consultancy&from=services_menu",
  /** The mortgage page's application panel and start buttons: the service is chosen there, so the flow opens on W2. */
  startPreApproval: "/mortgages/apply?service=pre_approval&from=calculator_preapproval&step=details",
  startConsultancy: "/mortgages/apply?service=consultancy&from=calculator_advisor&step=details",
  propertyDetail: (reference: string) =>
    `/mortgages/apply?service=pre_approval&from=property_detail&property=${encodeURIComponent(reference)}`,
} as const;

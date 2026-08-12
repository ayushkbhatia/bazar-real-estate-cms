import type { SeedAgent } from "@/lib/seeds/agents";
import { LeadAdvisorBanner } from "./lead-advisor-banner";

/**
 * Sprint 5a (backfilled): Advisor section anchor on the development
 * detail page. Thin wrapper around LeadAdvisorBanner that gives the
 * sticky sub-nav something to scroll to.
 */
export function AdvisorSection({
  agent,
  developmentName,
}: {
  agent: SeedAgent;
  developmentName: string;
}) {
  return (
    <div id="advisor" className="scroll-mt-16">
      <LeadAdvisorBanner agent={agent} developmentName={developmentName} />
    </div>
  );
}

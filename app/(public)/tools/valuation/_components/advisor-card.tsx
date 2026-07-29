import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { SEED_AGENTS, type SeedAgent } from "@/lib/seeds/agents";

/**
 * Sprint 5b (backfilled): advisor card on the valuation review pane.
 * Routes by area slug — Sprint 9 swaps the seed lookup for real
 * `lead_routing` rules.
 */
export function ValuationAdvisorCard({ areaSlug }: { areaSlug?: string }) {
  const agent: SeedAgent =
    SEED_AGENTS.find((a) => a.areas.includes(areaSlug ?? "")) ??
    SEED_AGENTS[0];

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4 flex items-center gap-3">
      {agent.photo_url ? (
        <Image
          src={agent.photo_url}
          alt={agent.display_name}
          width={48}
          height={48}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <PlaceholderImage
          label={agent.slug}
          className="w-12 h-12 rounded-full flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <Eyebrow>Your advisor</Eyebrow>
        <div className="text-[13.5px] font-medium mt-0.5 truncate">
          {agent.display_name}
        </div>
        <div className="text-[11.5px] text-bz-muted truncate">
          {agent.title}
        </div>
      </div>
      <div className="mono text-[10.5px] text-bz-muted">
        {agent.brn}
      </div>
    </div>
  );
}

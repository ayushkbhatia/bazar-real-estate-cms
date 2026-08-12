import { Lock, Globe2 } from "lucide-react";

type Source =
  | { kind: "off_market"; advisor: string }
  | { kind: "public" }
  | { kind: "exclusive"; advisor: string };

/**
 * Sprint 5c (backfilled): source label on concierge result cards.
 * "Off-market · Mariam" vs "Public listing" vs "Exclusive · Mariam" —
 * gives the user a clear signal about where the result came from.
 */
export function SourceLabel({ source }: { source: Source }) {
  if (source.kind === "off_market") {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-bz-accent">
        <Lock size={9} strokeWidth={2.2} />
        Off-market · {source.advisor.split(" ")[0]}
      </span>
    );
  }
  if (source.kind === "exclusive") {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-bz-ink">
        Exclusive · {source.advisor.split(" ")[0]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-bz-muted">
      <Globe2 size={9} strokeWidth={2} />
      Public listing
    </span>
  );
}

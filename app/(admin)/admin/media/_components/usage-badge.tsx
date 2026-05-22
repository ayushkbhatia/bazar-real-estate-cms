import { Building2 } from "lucide-react";

/**
 * Sprint 7d (backfilled): "Used in N listings" badge that overlays each
 * media tile. Sprint 9 wires the count from `property_media.media_id`
 * counts; today the parent passes the precomputed total.
 */
export function MediaUsageBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="absolute bottom-2 left-2 inline-flex items-center gap-1 h-5 px-1.5 rounded bg-bz-ink/80 text-bz-bg text-[10px] font-medium backdrop-blur"
      title={`Used in ${count} listing${count === 1 ? "" : "s"}`}
    >
      <Building2 size={9} strokeWidth={2} />
      {count}
    </span>
  );
}

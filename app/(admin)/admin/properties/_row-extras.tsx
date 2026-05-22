import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";

/**
 * Sprint 7b (backfilled): hero thumbnail + views/enquiries pills for the
 * admin properties table. Sprint 13 wires real `views_30d` from PostHog;
 * today the parent passes 0 so the column stays present.
 */
export function PropertyRowThumb({
  storageKey,
  reference,
}: {
  storageKey: string | null;
  reference: string;
}) {
  return (
    <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
      {storageKey ? (
        <Image
          src={mediaPublicUrl(storageKey)}
          alt={`${reference} thumbnail`}
          fill
          sizes="48px"
          className="object-cover"
        />
      ) : (
        <PlaceholderImage label={reference} className="w-full h-full" />
      )}
    </div>
  );
}

export function PropertyRowStats({
  views30d,
  enquiriesOpen,
}: {
  views30d: number;
  enquiriesOpen: number;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-[11px]">
      <span className="mono text-bz-ink-2">
        {views30d.toLocaleString()} views
      </span>
      <span className="mono text-bz-muted">
        {enquiriesOpen} open enq
      </span>
    </div>
  );
}

"use client";

import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

type Agent = {
  user_id: string;
  display_name: string;
  title?: string | null;
  photo_url?: string | null;
};

/**
 * Sprint 7c (backfilled): right-rail "Assigned agent" card on the
 * property edit form. Controlled select + portrait preview.
 */
export function AssignedAgentCard({
  agents,
  value,
  onChange,
}: {
  agents: Agent[];
  value: string | null;
  onChange: (userId: string | null) => void;
}) {
  const current = agents.find((a) => a.user_id === value) ?? null;

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <Eyebrow>Assigned agent</Eyebrow>
      <div className="mt-3 flex items-center gap-3">
        {current ? (
          <PlaceholderImage
            label={current.display_name.split(" ")[0].toLowerCase()}
            className="w-12 h-12 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-bz-surface-2 flex items-center justify-center text-bz-muted text-[10.5px]">
            None
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-bz-ink truncate">
            {current?.display_name ?? "Unassigned"}
          </div>
          <div className="text-[11.5px] text-bz-muted truncate">
            {current?.title ?? "Pick an advisor"}
          </div>
        </div>
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-3 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px]"
      >
        <option value="">Unassigned</option>
        {agents.map((a) => (
          <option key={a.user_id} value={a.user_id}>
            {a.display_name}
          </option>
        ))}
      </select>
    </div>
  );
}

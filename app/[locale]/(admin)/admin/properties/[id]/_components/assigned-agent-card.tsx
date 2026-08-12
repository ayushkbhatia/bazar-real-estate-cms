"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { assignAgent } from "../_actions";

type Agent = {
  user_id: string;
  display_name: string;
  title?: string | null;
  photo_url?: string | null;
};

/**
 * Right-rail "Assigned agent" card on the property edit page. Self-contained:
 * changing the select persists immediately via the `assignAgent` server action
 * (optimistic, with rollback on error), mirroring how PublishCard saves.
 *
 * `agents` is the active-agent list; the currently-assigned agent is always
 * included by the page even if they've since gone inactive, so the picker
 * reflects reality rather than silently showing "Unassigned".
 */
export function AssignedAgentCard({
  propertyId,
  agents,
  value: initialValue,
}: {
  propertyId: string;
  agents: Agent[];
  value: string | null;
}) {
  const [value, setValue] = useState<string | null>(initialValue);
  const [saving, startSaving] = useTransition();
  const current = agents.find((a) => a.user_id === value) ?? null;

  function onSelect(next: string | null) {
    const prev = value;
    setValue(next); // optimistic
    startSaving(async () => {
      const result = await assignAgent(propertyId, next);
      if (result.status === "ok") {
        toast.success(result.message);
      } else {
        toast.error(result.message);
        setValue(prev); // rollback
      }
    });
  }

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Assigned agent</Eyebrow>
        {saving ? (
          <span className="text-[11px] text-bz-muted">Saving…</span>
        ) : null}
      </div>
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
        onChange={(e) => onSelect(e.target.value || null)}
        disabled={saving}
        aria-label="Assigned agent"
        className="mt-3 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px] disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {agents.map((a) => (
          <option key={a.user_id} value={a.user_id}>
            {a.display_name}
          </option>
        ))}
      </select>
      <p className="mt-2.5 text-[11.5px] text-bz-muted leading-snug">
        Shown on the public listing and the advisor&apos;s profile. To assign
        several listings at once, use bulk reassign on the properties list.
      </p>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Sprint 7b (backfilled): agent / area / type filter dropdowns above the
 * properties table. URL-state driven so deep-links work.
 */
export function PropertiesFilterDropdowns({
  agents,
  areas,
}: {
  agents: { user_id: string; display_name: string }[];
  areas: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Picker
        label="Agent"
        value={sp.get("agent") ?? ""}
        options={[
          { value: "", label: "All agents" },
          { value: "unassigned", label: "Unassigned" },
          ...agents.map((a) => ({
            value: a.user_id,
            label: a.display_name,
          })),
        ]}
        onChange={(v) => setParam("agent", v)}
        disabled={pending}
      />
      <Picker
        label="Area"
        value={sp.get("area") ?? ""}
        options={[
          { value: "", label: "All areas" },
          ...areas.map((a) => ({ value: a.slug, label: a.name })),
        ]}
        onChange={(v) => setParam("area", v)}
        disabled={pending}
      />
      <Picker
        label="Type"
        value={sp.get("type") ?? ""}
        options={[
          { value: "", label: "All types" },
          { value: "apartment", label: "Apartment" },
          { value: "villa", label: "Villa" },
          { value: "penthouse", label: "Penthouse" },
          { value: "townhouse", label: "Townhouse" },
          { value: "commercial", label: "Commercial" },
          { value: "land", label: "Land" },
        ]}
        onChange={(v) => setParam("type", v)}
        disabled={pending}
      />
    </div>
  );
}

function Picker({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11.5px] text-bz-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 px-2.5 rounded border border-bz-border bg-bz-bg text-[13px] text-bz-ink outline-none focus:border-bz-border-strong"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

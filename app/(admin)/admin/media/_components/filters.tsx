"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Sprint 7d (backfilled): type / date / agent filter dropdowns above the
 * media grid. URL-state driven so deep-links + back-button work.
 */
export function MediaFilters({
  agents,
}: {
  agents: { user_id: string; display_name: string }[];
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
        label="Type"
        value={sp.get("type") ?? ""}
        options={[
          { value: "", label: "All types" },
          { value: "image", label: "Images" },
          { value: "pdf", label: "PDFs" },
          { value: "video", label: "Video" },
        ]}
        onChange={(v) => setParam("type", v)}
        disabled={pending}
      />
      <Picker
        label="Uploaded"
        value={sp.get("date") ?? ""}
        options={[
          { value: "", label: "Any time" },
          { value: "7d", label: "Past 7 days" },
          { value: "30d", label: "Past 30 days" },
          { value: "90d", label: "Past 90 days" },
        ]}
        onChange={(v) => setParam("date", v)}
        disabled={pending}
      />
      <Picker
        label="Uploaded by"
        value={sp.get("uploader") ?? ""}
        options={[
          { value: "", label: "Anyone" },
          ...agents.map((a) => ({
            value: a.user_id,
            label: a.display_name,
          })),
        ]}
        onChange={(v) => setParam("uploader", v)}
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
        className="h-8 px-2.5 rounded border border-bz-border bg-bz-bg text-[12.5px] text-bz-ink outline-none focus:border-bz-border-strong"
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

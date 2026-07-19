"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { AuditLogFilters } from "@/lib/queries/audit";

export function AuditLogFilters({
  initial,
  actionOptions,
  targetKindOptions,
}: {
  initial: AuditLogFilters;
  actionOptions: string[];
  targetKindOptions: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("page"); // any filter change resets the page
    router.replace(
      `/admin/audit-log${next.toString() ? `?${next}` : ""}`,
      { scroll: false },
    );
  }

  const hasAnyFilter =
    initial.q ||
    initial.action ||
    initial.target_kind ||
    initial.actor_email ||
    initial.date_from ||
    initial.date_to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bz-muted"
        />
        <input
          type="search"
          defaultValue={initial.q ?? ""}
          placeholder="Free-text (action / target_id)"
          className="h-8 pl-7 pr-2.5 bg-bz-surface border border-bz-border rounded text-[12.5px] outline-none focus:border-bz-accent w-[260px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setParam("q", (e.currentTarget.value ?? "").trim() || null);
            }
          }}
        />
      </div>

      <input
        type="search"
        defaultValue={initial.actor_email ?? ""}
        placeholder="Actor email or name"
        className="h-8 px-2.5 bg-bz-surface border border-bz-border rounded text-[12.5px] outline-none focus:border-bz-accent w-[200px]"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setParam(
              "actor_email",
              (e.currentTarget.value ?? "").trim() || null,
            );
          }
        }}
      />

      <SelectFilter
        label="Action"
        value={initial.action}
        options={actionOptions}
        onChange={(v) => setParam("action", v)}
      />

      <SelectFilter
        label="Target"
        value={initial.target_kind}
        options={targetKindOptions}
        onChange={(v) => setParam("target_kind", v)}
      />

      <DateFilter
        label="From"
        value={initial.date_from}
        onChange={(v) => setParam("date_from", v)}
      />
      <DateFilter
        label="To"
        value={initial.date_to}
        onChange={(v) => setParam("date_to", v)}
      />

      {hasAnyFilter ? (
        <button
          type="button"
          onClick={() => router.replace("/admin/audit-log", { scroll: false })}
          className="h-8 px-2.5 rounded text-[12px] text-bz-muted hover:text-bz-ink inline-flex items-center gap-1"
        >
          <X size={11} strokeWidth={2} />
          Clear
        </button>
      ) : null}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="inline-flex items-center bg-bz-surface border border-bz-border rounded overflow-hidden h-8">
      <span className="px-2 text-bz-muted-2 uppercase tracking-wider text-[10.5px] border-r border-bz-border">
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-full px-2 text-[12.5px] bg-transparent border-0 outline-none min-w-[120px]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="inline-flex items-center bg-bz-surface border border-bz-border rounded overflow-hidden h-8">
      <span className="px-2 text-bz-muted-2 uppercase tracking-wider text-[10.5px] border-r border-bz-border">
        {label}
      </span>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-full px-2 text-[12.5px] bg-transparent border-0 outline-none w-[140px]"
      />
    </div>
  );
}

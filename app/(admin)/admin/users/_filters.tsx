"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAFF_ROLES,
  STAFF_STATUSES,
  ROLE_LABEL,
  STATUS_LABEL,
} from "@/lib/schemas/staff";
import type { FilterState } from "./_filter-state";

export function UserFilters({ initial }: { initial: FilterState }) {
  const router = useRouter();
  const params = useSearchParams();

  const baseQuery = useMemo(() => {
    const out = new URLSearchParams();
    if (initial.q) out.set("q", initial.q);
    return out;
  }, [initial.q]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    router.replace(`/admin/users${next.toString() ? `?${next}` : ""}`, {
      scroll: false,
    });
  }

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
          placeholder="Search name or email"
          className="h-8 pl-7 pr-2.5 bg-bz-surface border border-bz-border rounded text-[12.5px] outline-none focus:border-bz-ink-2 w-[220px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setParam("q", (e.currentTarget.value ?? "").trim() || null);
            }
          }}
        />
      </div>

      <FilterGroup
        label="Role"
        value={initial.role}
        options={[
          { value: null, label: "All" },
          ...STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
        ]}
        onChange={(v) => setParam("role", v)}
      />

      <FilterGroup
        label="Status"
        value={initial.status}
        options={[
          { value: null, label: "All" },
          ...STAFF_STATUSES.map((s) => ({
            value: s,
            label: STATUS_LABEL[s],
          })),
        ]}
        onChange={(v) => setParam("status", v)}
      />

      {baseQuery.toString() ||
      initial.role !== null ||
      initial.status !== null ? (
        <button
          type="button"
          onClick={() => router.replace("/admin/users", { scroll: false })}
          className="h-8 px-2.5 rounded text-[12px] text-bz-muted hover:text-bz-ink"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T | null; label: string }[];
  onChange: (next: T | null) => void;
}) {
  return (
    <div className="inline-flex items-center bg-bz-surface border border-bz-border rounded overflow-hidden h-8 text-[12px]">
      <span className="px-2 text-bz-muted-2 uppercase tracking-wider text-[10.5px] border-r border-bz-border">
        {label}
      </span>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value ?? "all")}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-full px-2.5 transition-colors",
              active
                ? "bg-bz-ink text-bz-bg"
                : "text-bz-ink-2 hover:bg-bz-surface-2",
            )}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";

/**
 * Global topbar search. Submits to `/admin/search?q=...` (Sprint 3
 * Postgres ILIKE; Sprint 12 swaps to Meilisearch).
 */
export function CmsSearchInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    startTransition(() => {
      router.push(`/admin/search?q=${encodeURIComponent(q)}`);
    });
  }

  return (
    <form onSubmit={submit} className="relative w-[280px]">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search properties, enquiries…"
        disabled={pending}
        className="w-full h-10 pl-9 pr-3 bg-bz-surface border border-bz-border rounded text-[13.5px] outline-none focus:border-bz-ink-2 transition-colors"
      />
    </form>
  );
}

"use client";

import { Search as SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Sprint 7d (backfilled): keyword search above the media grid.
 * Server-side via ?q= so the existing media-list query can filter on
 * filename + alt_text.
 */
export function MediaSearchInput() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={submit} className="relative">
      <SearchIcon
        size={13}
        strokeWidth={1.7}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filename or alt text…"
        disabled={pending}
        className="w-full h-9 pl-9 pr-3 rounded-md border border-bz-border bg-bz-bg text-[13px] outline-none focus:border-bz-border-strong"
      />
    </form>
  );
}

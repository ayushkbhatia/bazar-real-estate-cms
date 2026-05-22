"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const MODES = [
  { value: "buy", label: "Buy" },
  { value: "rent", label: "Rent" },
  { value: "off-plan", label: "Off-plan" },
] as const;

type Mode = (typeof MODES)[number]["value"];

const TYPES = [
  { value: "", label: "Any type" },
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "penthouse", label: "Penthouse" },
  { value: "townhouse", label: "Townhouse" },
];

export function HeroSearch({ defaultMode = "buy" }: { defaultMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [beds, setBeds] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (location.trim()) params.set("q", location.trim());
    if (type) params.set("type", type);
    if (beds) params.set("beds", beds);
    if (priceMax) params.set("price_max", priceMax);
    const qs = params.toString();
    startTransition(() => {
      router.push(`/${mode}${qs ? `?${qs}` : ""}`);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-10 max-w-[860px] rounded-lg bg-white/10 backdrop-blur-md border border-white/20 p-1"
    >
      <div className="flex gap-1 px-1.5 pt-1.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={
              mode === m.value
                ? "h-8 px-3 rounded text-[12.5px] bg-white text-bz-ink font-medium"
                : "h-8 px-3 rounded text-[12.5px] text-white/80 hover:text-white transition-colors"
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-[1fr_140px_120px_120px_auto] gap-1 p-1">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Area, building, or reference"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded bg-white text-bz-ink text-[13.5px] outline-none border border-transparent focus:border-bz-accent"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-10 px-3 rounded bg-white text-bz-ink text-[13px] outline-none border border-transparent focus:border-bz-accent"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={beds}
          onChange={(e) => setBeds(e.target.value)}
          className="h-10 px-3 rounded bg-white text-bz-ink text-[13px] outline-none border border-transparent focus:border-bz-accent"
        >
          <option value="">Beds</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}+ bed
            </option>
          ))}
        </select>
        <select
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          className="h-10 px-3 rounded bg-white text-bz-ink text-[13px] outline-none border border-transparent focus:border-bz-accent"
        >
          <option value="">Max price</option>
          <option value="1500000">Up to 1.5M</option>
          <option value="3000000">Up to 3M</option>
          <option value="5000000">Up to 5M</option>
          <option value="10000000">Up to 10M</option>
          <option value="25000000">Up to 25M</option>
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </div>
    </form>
  );
}

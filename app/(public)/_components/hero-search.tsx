"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DualRangeSlider } from "./dual-range-slider";
import { formatPriceAED } from "@/lib/queries/property-utils";
import {
  HERO_TABS,
  buildHeroSearchUrl,
  type Range,
} from "@/lib/hero-search-config";

const EMPTY_RANGE: Range = { min: null, max: null };

export function HeroSearch({ defaultMode = "off-plan" }: { defaultMode?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState(
    HERO_TABS.some((t) => t.value === defaultMode) ? defaultMode : "off-plan",
  );
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [beds, setBeds] = useState("");
  const [price, setPrice] = useState<Range>(EMPTY_RANGE);
  const [size, setSize] = useState<Range>(EMPTY_RANGE);
  const [pending, startTransition] = useTransition();

  const tab = useMemo(
    () => HERO_TABS.find((t) => t.value === mode) ?? HERO_TABS[0],
    [mode],
  );

  // Switching tab resets the range/dropdown state — the price ceiling and
  // type list differ per tab, so carrying values over would be misleading.
  function switchTab(next: string) {
    if (next === mode) return;
    setMode(next);
    setType("");
    setBeds("");
    setPrice(EMPTY_RANGE);
    setSize(EMPTY_RANGE);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = buildHeroSearchUrl(tab, { q, type, beds, price, size });
    startTransition(() => router.push(url));
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 w-full max-w-[880px] rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-1.5"
    >
      {/* Tabs */}
      <div className="flex gap-1 px-1 pt-1" role="tablist" aria-label="Search type">
        {HERO_TABS.map((t) => {
          const active = mode === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(t.value)}
              className={
                active
                  ? "h-8 px-3.5 rounded-md text-[12.5px] bg-white text-bz-ink font-medium"
                  : "h-8 px-3.5 rounded-md text-[12.5px] text-white/80 hover:text-white transition-colors"
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Fields — light panel so the ink sliders stay legible over video. */}
      <div className="mt-1.5 rounded-lg bg-white/95 p-2.5 md:p-3 flex flex-col gap-2.5">
        {/* Row 1: search */}
        <div className="relative">
          <Search
            size={15}
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder={tab.placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full h-11 md:h-10 pl-9 pr-3 rounded-md bg-white text-bz-ink text-[13.5px] outline-none border border-bz-border focus:border-bz-accent"
          />
        </div>

        {/* Row 2: type + (beds | size) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-bz-muted">
              Property type
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 px-3 rounded-md bg-white text-bz-ink text-[13px] outline-none border border-bz-border focus:border-bz-accent"
            >
              <option value="">Any type</option>
              {tab.types.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {tab.beds ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-bz-muted">
                Bedrooms
              </span>
              <select
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="h-10 px-3 rounded-md bg-white text-bz-ink text-[13px] outline-none border border-bz-border focus:border-bz-accent"
              >
                <option value="">Any beds</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n === 6 ? "6+ Bedrooms" : `${n} Bedroom${n > 1 ? "s" : ""}`}
                  </option>
                ))}
              </select>
            </label>
          ) : tab.size ? (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-bz-muted">
                Size (ft²)
              </span>
              <div className="px-1 pt-1.5">
                <DualRangeSlider
                  key={`size-${mode}`}
                  min={0}
                  max={tab.size.max}
                  step={tab.size.step}
                  initial={size}
                  format={(n) => `${n.toLocaleString("en-US")} ft²`}
                  onChange={setSize}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Row 3: price slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-bz-muted">
            Price range
          </span>
          <div className="px-1 pt-1.5">
            <DualRangeSlider
              key={`price-${mode}`}
              min={0}
              max={tab.price.max}
              step={tab.price.step}
              initial={price}
              format={formatPriceAED}
              onChange={setPrice}
            />
          </div>
        </div>

        {/* Submit */}
        <Button type="submit" disabled={pending} className="h-11 md:h-10 w-full">
          {pending ? "Searching…" : "Search"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useQueryStates } from "nuqs";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PROPERTY_TYPES } from "@/lib/schemas/property";
import { filterParsers } from "@/lib/filters/property";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<(typeof PROPERTY_TYPES)[number], string> = {
  apartment: "Apartment",
  villa: "Villa",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  commercial: "Commercial",
  land: "Land",
  hotel_apartment: "Hotel apartment",
};

const BED_OPTIONS = [1, 2, 3, 4, 5] as const;
const BATH_OPTIONS = [1, 2, 3, 4] as const;
const UNSET = "__unset__";

export type AreaOption = { slug: string; name: string };

type Props = {
  mode: "buy" | "rent" | "off_plan" | "commercial";
  areas: AreaOption[];
};

export function FilterBar({ areas }: Props) {
  const [{ q, beds, baths, type, price_min, price_max, area }, setState] =
    useQueryStates(filterParsers, {
      shallow: false, // re-fetch the RSC page on change
    });
  const [pending, startTransition] = useTransition();

  // Local search-input state — debounced so we don't fire a page reload per
  // keystroke.
  const [qInput, setQInput] = useState(q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Keep local state in sync when the URL changes externally (back/forward,
    // "Clear filters").
    setQInput(q ?? "");
  }, [q]);

  function onQChange(value: string) {
    setQInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        void setState({ q: value.trim() === "" ? null : value.trim() });
      });
    }, 250);
  }

  const activeCount = [q, beds, baths, type, price_min, price_max, area].filter(
    (v) => v !== null && v !== undefined && v !== "",
  ).length;

  function commit(patch: Parameters<typeof setState>[0]) {
    startTransition(() => {
      void setState(patch);
    });
  }

  function clearAll() {
    setQInput("");
    startTransition(() => {
      void setState({
        q: null,
        beds: null,
        baths: null,
        type: null,
        price_min: null,
        price_max: null,
        area: null,
      });
    });
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-20 bg-bz-bg border-b border-bz-border",
        "px-12 py-4",
        pending && "opacity-90",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Free-text search */}
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Search Mamsha, Saadiyat, sea view…"
            value={qInput}
            onChange={(e) => onQChange(e.target.value)}
            className="w-[260px] h-9 pl-8 text-[13px]"
            aria-label="Search properties"
          />
        </label>

        {/* Beds */}
        <div className="flex items-center gap-1">
          <span className="text-[11.5px] uppercase tracking-wider text-bz-muted mr-1">
            Beds
          </span>
          {BED_OPTIONS.map((n) => {
            const active = beds === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => commit({ beds: active ? null : n })}
                className={cn(
                  "h-8 min-w-[34px] px-2 rounded text-[12.5px] font-medium border transition-colors",
                  active
                    ? "bg-bz-ink text-bz-bg border-bz-ink"
                    : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                )}
                aria-pressed={active}
                aria-label={`${n === 5 ? "5+" : n} bed${n === 1 ? "" : "s"}`}
              >
                {n === 5 ? "5+" : String(n)}
              </button>
            );
          })}
        </div>

        {/* Baths */}
        <div className="flex items-center gap-1">
          <span className="text-[11.5px] uppercase tracking-wider text-bz-muted mr-1">
            Baths
          </span>
          {BATH_OPTIONS.map((n) => {
            const active = baths === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => commit({ baths: active ? null : n })}
                className={cn(
                  "h-8 min-w-[34px] px-2 rounded text-[12.5px] font-medium border transition-colors",
                  active
                    ? "bg-bz-ink text-bz-bg border-bz-ink"
                    : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                )}
                aria-pressed={active}
                aria-label={`${n === 4 ? "4+" : n} bath${n === 1 ? "" : "s"}`}
              >
                {n === 4 ? "4+" : String(n)}
              </button>
            );
          })}
        </div>

        {/* Type */}
        <Select
          value={type ?? UNSET}
          onValueChange={(v) =>
            commit({ type: v === UNSET ? null : (v as typeof type) })
          }
        >
          <SelectTrigger className="w-[160px] h-9 text-[13px]">
            <SelectValue placeholder="Any type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>Any type</SelectItem>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Area */}
        {areas.length > 0 ? (
          <Select
            value={area ?? UNSET}
            onValueChange={(v) =>
              commit({ area: v === UNSET ? null : v })
            }
          >
            <SelectTrigger className="w-[200px] h-9 text-[13px]">
              <SelectValue placeholder="Any area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>Any area</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.slug} value={a.slug}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {/* Price */}
        <div className="flex items-center gap-1">
          <span className="text-[11.5px] uppercase tracking-wider text-bz-muted mr-1">
            Price
          </span>
          <Input
            type="number"
            placeholder="Min AED"
            value={price_min ?? ""}
            min={0}
            step={10000}
            onChange={(e) =>
              commit({
                price_min:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-[140px] h-9 text-[13px]"
          />
          <span className="text-bz-muted">–</span>
          <Input
            type="number"
            placeholder="Max AED"
            value={price_max ?? ""}
            min={0}
            step={10000}
            onChange={(e) =>
              commit({
                price_max:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-[140px] h-9 text-[13px]"
          />
        </div>

        {/* Clear */}
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-auto text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            <X size={12} strokeWidth={1.8} />
            Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

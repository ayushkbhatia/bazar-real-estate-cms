"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AmenityChoice } from "@/lib/queries/search-filters";

/**
 * The search results' Amenities filter — the one control left of what the
 * "More filters" drawer held (client, Oct 2026).
 *
 * Its choices come from the server: the amenities picked under Pages & blocks
 * → Sections → Search filters, from the live taxonomy, each in the page's
 * language. The drawer read a list baked into the bundle, so an amenity added
 * in the CMS, or its Arabic name, never reached it.
 *
 * Each tick applies at once (`?amenities=` holds the English labels, which is
 * what listings store), and resets to page 1.
 */
export function AmenitiesFilter({
  label,
  choices,
}: {
  /** The button's words, in the page's language. */
  label: string;
  choices: AmenityChoice[];
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const selected = new Set(
    (sp.get("amenities") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  function write(next: Set<string>) {
    const params = new URLSearchParams(sp.toString());
    if (next.size) params.set("amenities", Array.from(next).join(","));
    else params.delete("amenities");
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    });
  }

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    write(next);
  }

  if (choices.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-busy={pending || undefined}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors pointer-coarse:min-h-11",
            selected.size
              ? "border-bz-navy bg-bz-navy text-bz-bg"
              : "border-bz-border bg-bz-surface text-bz-ink hover:border-bz-border-strong",
          )}
        >
          {label}
          {selected.size ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-bz-bg px-1 text-[10.5px] text-bz-navy">
              {selected.size}
            </span>
          ) : null}
          <ChevronDown size={14} strokeWidth={1.7} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80 p-3">
        <div className="flex flex-wrap gap-1.5">
          {choices.map((c) => {
            const active = selected.has(c.value);
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(c.value)}
                className={
                  active
                    ? "inline-flex h-7 items-center gap-1 rounded-full bg-bz-navy px-2.5 text-[11.5px] text-bz-bg"
                    : "inline-flex h-7 items-center rounded-full border border-bz-border bg-bz-bg px-2.5 text-[11.5px] text-bz-ink-2 hover:border-bz-border-strong"
                }
              >
                {active ? <Check size={11} strokeWidth={2} /> : null}
                {c.label}
              </button>
            );
          })}
        </div>
        {selected.size ? (
          <button
            type="button"
            onClick={() => write(new Set())}
            className="mt-3 inline-flex items-center gap-1 text-[12px] text-bz-ink-2 hover:text-bz-ink"
          >
            <X size={12} strokeWidth={1.8} />
            {t("filters.clearCount", { count: selected.size })}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addCustomAmenity,
  groupAmenities,
  orderAmenities,
  splitAmenities,
  valueOf,
  MAX_AMENITY_LENGTH,
  type AmenityOption,
} from "@/lib/amenities";

/**
 * "Select all that apply" amenities picker (design handoff:
 * design_handoff_bazar_amenities). Controlled — the property form owns the
 * value so its dirty-state and save logic stay in one place.
 *
 * The taxonomy cards are the curated vocabulary — they're what the search
 * facet and the comparison table are built on. The same box that filters them
 * also adds a value the taxonomy doesn't have, because a lister shouldn't have
 * to wait on an admin to describe what the property actually has. Anything
 * typed that already exists in the taxonomy ticks that card instead of storing
 * a second spelling of it; genuinely new values are stored as custom text and
 * shown in their own block.
 */
export function AmenitiesPicker({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: AmenityOption[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);

  const { known, unknown } = useMemo(
    () => splitAmenities(value, options),
    [value, options],
  );
  const selected = useMemo(() => new Set(known), [known]);

  /** Always re-order through the taxonomy so stored order stays stable. */
  function commit(nextKnown: Set<string>) {
    onChange(orderAmenities([...nextKnown, ...unknown], options));
  }

  function toggle(option: AmenityOption) {
    const next = new Set(selected);
    const v = valueOf(option);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    commit(next);
  }

  function setGroup(items: AmenityOption[], on: boolean) {
    const next = new Set(selected);
    for (const item of items) {
      if (on) next.add(valueOf(item));
      else next.delete(valueOf(item));
    }
    commit(next);
  }

  /**
   * Add whatever is in the box. Runs against the *whole* stored list (taxonomy
   * values and customs alike) so the duplicate check covers both buckets.
   */
  function addCustom() {
    const result = addCustomAmenity(value, query, options);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    onChange(result.next);
    setQuery("");
    setNotice(
      result.matched
        ? {
            tone: "info",
            text: `“${result.matched.label}” is already an amenity — selected it for you.`,
          }
        : null,
    );
  }

  const q = query.trim().toLowerCase();
  /** An exact taxonomy match doesn't need an "Add" button — its card is right there. */
  const canAdd = q !== "" && !options.some((o) => o.label.toLowerCase() === q);
  const groups = groupAmenities(options)
    .map((g) => ({
      ...g,
      items: q
        ? g.items.filter((i) => i.label.toLowerCase().includes(q))
        : g.items,
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[12.5px] text-bz-muted mr-auto tabular-nums">
          {known.length} of {options.length} selected
        </span>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[12px] text-bz-accent hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-full max-w-[280px]">
            <label htmlFor="amenity-filter" className="sr-only">
              Filter amenities, or type one to add
            </label>
            <input
              id="amenity-filter"
              type="search"
              value={query}
              maxLength={MAX_AMENITY_LENGTH}
              aria-describedby={notice ? "amenity-add-notice" : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setNotice(null);
              }}
              onKeyDown={(e) => {
                // The picker sits inside the property <form> — an unguarded
                // Enter would submit the whole listing.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Filter or add an amenity…"
              className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]"
            />
          </div>
          {canAdd ? (
            <button
              type="button"
              onClick={addCustom}
              className="text-[12px] text-bz-accent hover:underline"
            >
              Add &ldquo;{query.trim()}&rdquo;
            </button>
          ) : null}
        </div>
        {notice ? (
          <p
            id="amenity-add-notice"
            role="status"
            aria-live="polite"
            className={cn(
              "text-[11.5px]",
              notice.tone === "error" ? "text-bz-danger" : "text-bz-muted",
            )}
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      {known.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {known.map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => {
                const next = new Set(selected);
                next.delete(v);
                commit(next);
              }}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] bg-bz-accent-soft text-bz-accent hover:opacity-80"
            >
              {v}
              <X size={10} strokeWidth={2} className="opacity-60" />
            </button>
          ))}
        </div>
      ) : null}

      {unknown.length > 0 ? (
        <div className="rounded border border-bz-border bg-bz-surface-2 px-3 py-2.5 flex flex-col gap-2">
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-[12.5px] font-medium">Custom amenities</h3>
            <span className="text-[11.5px] text-bz-muted tabular-nums">
              {unknown.length}
            </span>
          </div>
          <p className="text-[11.5px] text-bz-muted">
            Specific to this listing. They show on the property page, but
            they&rsquo;re not search filters — ask an admin to add one under
            Settings → Fields to make it filterable everywhere.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unknown.map((v) => (
              <button
                key={v}
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() =>
                  onChange(
                    orderAmenities(
                      [...known, ...unknown.filter((u) => u !== v)],
                      options,
                    ),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] bg-bz-bg border border-bz-border text-bz-ink-2 hover:border-bz-border-strong"
              >
                {v}
                <X size={10} strokeWidth={2} className="opacity-60" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {groups.map((group) => {
        const on = group.items.filter((i) =>
          selected.has(valueOf(i)),
        ).length;
        const all = on === group.items.length;
        const headingId = `amenity-group-${group.category}`;
        return (
          <section
            key={group.category}
            role="group"
            aria-labelledby={headingId}
            className="flex flex-col gap-2"
          >
            <div className="flex items-baseline gap-2.5">
              <h3 id={headingId} className="text-[12.5px] font-medium">
                {group.label}
              </h3>
              <span className="text-[11.5px] text-bz-muted flex-1 tabular-nums">
                {on}/{group.items.length}
              </span>
              <button
                type="button"
                onClick={() => setGroup(group.items, !all)}
                className="text-[11.5px] text-bz-accent hover:underline"
              >
                {all ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.items.map((item) => {
                const isOn = selected.has(valueOf(item));
                return (
                  <label
                    key={item.code}
                    className={cn(
                      "flex items-center gap-2 rounded border px-2.5 py-2 text-[12.5px] cursor-pointer transition-colors",
                      isOn
                        ? "border-bz-accent bg-bz-accent-soft text-bz-accent"
                        : "border-bz-border text-bz-ink hover:border-bz-border-strong",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggle(item)}
                      className="h-3.5 w-3.5 accent-bz-accent"
                    />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}

      {groups.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-bz-muted">
            No amenity matches &ldquo;{query}&rdquo;.
          </p>
          {canAdd ? (
            <button
              type="button"
              onClick={addCustom}
              className="text-[12px] text-bz-accent hover:underline"
            >
              Add it as a custom amenity
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

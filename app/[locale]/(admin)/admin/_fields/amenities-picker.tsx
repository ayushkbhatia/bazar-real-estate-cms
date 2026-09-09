"use client";

import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addCustomAmenity,
  groupAmenities,
  orderAmenities,
  splitAmenities,
  valueOf,
  MAX_AMENITIES,
  MAX_AMENITY_LENGTH,
  type AmenityOption,
} from "@/lib/amenities";
import {
  AMENITY_CATEGORIES,
  AMENITY_CATEGORY_LABELS,
} from "@/lib/schemas/amenity-taxonomy";
import type { AddAmenityToTaxonomyResult } from "./amenity-actions";

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
 * a second spelling of it.
 *
 * A genuinely new value now goes INTO the taxonomy rather than beside it, when
 * the mount passes `onAddToTaxonomy`. That is what gives it an Arabic twin: an
 * amenity's Arabic lives on `amenities_taxonomy.label_ar` and nowhere else, so
 * a value stored only on the listing is a word that can never be translated —
 * fifty-five of them are in the live catalogue. The lister picks a category,
 * optionally types the Arabic, and the entry becomes selectable and filterable
 * for everyone. If the write fails — role, RLS, a database blip — the old
 * free-text path still runs, so nothing they typed is lost.
 */
export function AmenitiesPicker({
  value,
  options,
  onChange,
  onAddToTaxonomy,
}: {
  value: string[];
  options: AmenityOption[];
  onChange: (next: string[]) => void;
  /**
   * Server action that writes the new amenity into `amenities_taxonomy`.
   * Optional: without it the picker keeps its free-text-only behaviour, which
   * is what the form specs render against.
   */
  onAddToTaxonomy?: (input: {
    label: string;
    label_ar?: string | null;
    category?: string;
  }) => Promise<AddAmenityToTaxonomyResult>;
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  /**
   * Rows this picker has just created. Merged into `options` so the new card
   * appears without a round trip to the server component that resolved them —
   * the page revalidates too, but the tick has to land now.
   */
  const [created, setCreated] = useState<AmenityOption[]>([]);
  /** The pending "add to the amenity list" panel: label, category, Arabic. */
  const [draft, setDraft] = useState<{
    label: string;
    category: string;
    labelAr: string;
  } | null>(null);
  const [notice, setNotice] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);

  /**
   * The vocabulary this picker resolves against: what the server sent, plus
   * anything added here since. Every lookup below goes through it, so a card
   * created a second ago behaves exactly like one that was seeded.
   */
  const allOptions = useMemo(
    () => [
      ...options,
      ...created.filter((c) => !options.some((o) => o.code === c.code)),
    ],
    [options, created],
  );

  const { known, unknown } = useMemo(
    () => splitAmenities(value, allOptions),
    [value, allOptions],
  );
  const selected = useMemo(() => new Set(known), [known]);

  /** Always re-order through the taxonomy so stored order stays stable. */
  function commit(nextKnown: Set<string>) {
    onChange(orderAmenities([...nextKnown, ...unknown], allOptions));
  }

  /**
   * What the listing would store. Custom values live in the same `text[]` as
   * the taxonomy ones and count against the same cap, so the cards have to be
   * checked against known + unknown, not against the card count on screen.
   */
  const stored = known.length + unknown.length;

  function atCap(projected: number) {
    return projected >= MAX_AMENITIES;
  }

  function toggle(option: AmenityOption) {
    const next = new Set(selected);
    const v = valueOf(option);
    if (next.has(v)) {
      next.delete(v);
    } else {
      // Checked here rather than left to the save — the schema enforces the
      // same cap server-side, and finding out at save time costs the agent
      // the whole round trip.
      if (atCap(next.size + unknown.length)) {
        setNotice({
          tone: "error",
          text: `Maximum ${MAX_AMENITIES} amenities — remove one to add another.`,
        });
        return;
      }
      next.add(v);
    }
    setNotice(null);
    commit(next);
  }

  function setGroup(items: AmenityOption[], on: boolean) {
    const next = new Set(selected);
    let skipped = 0;
    for (const item of items) {
      const v = valueOf(item);
      if (!on) {
        next.delete(v);
        continue;
      }
      if (next.has(v)) continue;
      // Fill to the cap and say what didn't fit, rather than dropping the
      // whole "Select all" on the floor.
      if (atCap(next.size + unknown.length)) {
        skipped += 1;
        continue;
      }
      next.add(v);
    }
    setNotice(
      skipped > 0
        ? {
            tone: "error",
            text: `Maximum ${MAX_AMENITIES} amenities — ${skipped} not added.`,
          }
        : null,
    );
    commit(next);
  }

  /**
   * Add whatever is in the box. Runs against the *whole* stored list (taxonomy
   * values and customs alike) so the duplicate check covers both buckets.
   *
   * Free text on this listing only. Still the path for a value the taxonomy
   * already knows (which resolves to its card), and the fallback for one that
   * could not be written to the taxonomy.
   */
  function addCustom(raw: string = query) {
    const result = addCustomAmenity(value, raw, allOptions);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return false;
    }
    onChange(result.next);
    setQuery("");
    setDraft(null);
    setNotice(
      result.matched
        ? {
            tone: "info",
            text: `“${result.matched.label}” is already an amenity — selected it for you.`,
          }
        : null,
    );
    return true;
  }

  /**
   * What the "Add" button does. With a taxonomy writer wired up it opens the
   * panel rather than committing, because two of the three things the row
   * needs — its category and its Arabic — are not in the search box.
   */
  function beginAdd() {
    const label = query.replace(/\s+/g, " ").trim();
    if (label === "") {
      setNotice({ tone: "error", text: "Type an amenity name." });
      return;
    }
    if (!onAddToTaxonomy) {
      addCustom(label);
      return;
    }
    // A value the taxonomy already holds never reaches the panel: it has a
    // card, and `addCustomAmenity` ticks it.
    if (allOptions.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      addCustom(label);
      return;
    }
    // Checked before the panel opens rather than after the write: the row
    // would land in the taxonomy and then fail to fit on the listing that
    // asked for it, which reads as the save having half-worked.
    if (atCap(stored)) {
      setNotice({
        tone: "error",
        text: `Maximum ${MAX_AMENITIES} amenities — remove one to add another.`,
      });
      return;
    }
    setNotice(null);
    setDraft({ label, category: "building", labelAr: "" });
  }

  /** Write the drafted amenity into the taxonomy, then tick it. */
  function commitDraft() {
    if (!draft || !onAddToTaxonomy) return;
    const request = draft;
    startTransition(async () => {
      const res = await onAddToTaxonomy({
        label: request.label,
        label_ar: request.labelAr.trim() === "" ? null : request.labelAr.trim(),
        category: request.category,
      });
      if (res.status === "error") {
        // Never lose what they typed: fall back to the listing-only value and
        // say why it is not filterable.
        const kept = addCustom(request.label);
        setNotice({
          tone: "error",
          text: kept
            ? `${res.message} Kept it on this listing only.`
            : res.message,
        });
        return;
      }
      setCreated((prev) =>
        prev.some((p) => p.code === res.option.code)
          ? prev
          : [...prev, res.option],
      );
      const merged = allOptions.some((o) => o.code === res.option.code)
        ? allOptions
        : [...allOptions, res.option];
      onChange(orderAmenities([...value, res.option.label], merged));
      setQuery("");
      setDraft(null);
      setNotice({
        tone: "info",
        text:
          res.status === "created"
            ? request.labelAr.trim() === ""
              ? `Added “${res.option.label}” to the amenity list — add its Arabic under Settings → Fields.`
              : `Added “${res.option.label}” to the amenity list.`
            : `“${res.option.label}” is already an amenity — selected it for you.`,
      });
    });
  }

  const q = query.trim().toLowerCase();
  /** An exact taxonomy match doesn't need an "Add" button — its card is right there. */
  const canAdd = q !== "" && !allOptions.some((o) => o.label.toLowerCase() === q);
  const groups = groupAmenities(allOptions)
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
        <span className="text-[12.5px] text-bz-muted me-auto tabular-nums">
          {known.length} of {allOptions.length} selected
          {/* Custom values are invisible in the count above but spend the same
              budget — showing the real total is what stops "under 50" from
              colliding with a cap the agent can't see. */}
          {unknown.length > 0 ? (
            <> · {stored} of {MAX_AMENITIES} used</>
          ) : null}
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
                  beginAdd();
                }
              }}
              placeholder="Filter or add an amenity…"
              className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]"
            />
          </div>
          {canAdd ? (
            <button
              type="button"
              onClick={() => beginAdd()}
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

        {draft ? (
          <div className="mt-1 rounded border border-bz-accent/40 bg-bz-accent-soft/40 px-3 py-3 flex flex-col gap-2.5">
            <div>
              <h3 className="text-[12.5px] font-medium">
                Add &ldquo;{draft.label}&rdquo; to the amenity list
              </h3>
              <p className="text-[11.5px] text-bz-muted mt-0.5">
                It becomes selectable on every listing and filterable on
                /buy + /rent. The Arabic is what the property page prints on
                /ar — leave it blank and the entry waits under Settings →
                Fields.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-bz-muted">
                  Category
                </span>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                  className="bz-field h-8 rounded border border-bz-border bg-bz-bg px-2 text-[12.5px] outline-none focus:border-bz-accent"
                >
                  {AMENITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {AMENITY_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <span className="text-[11px] uppercase tracking-wider text-bz-muted">
                  Arabic (optional)
                </span>
                <input
                  dir="rtl"
                  lang="ar"
                  value={draft.labelAr}
                  maxLength={90}
                  onChange={(e) =>
                    setDraft({ ...draft, labelAr: e.target.value })
                  }
                  placeholder="اسم الميزة بالعربية"
                  className="bz-field h-8 w-full rounded border border-bz-border bg-bz-bg px-2 text-[12.5px] outline-none focus:border-bz-accent"
                />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={commitDraft}
                className="h-8 rounded bg-bz-ink px-3 text-[12px] text-bz-bg hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Adding…" : "Add amenity"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => addCustom(draft.label)}
                className="h-8 px-1 text-[12px] text-bz-accent hover:underline disabled:opacity-50"
              >
                This listing only
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDraft(null)}
                className="h-8 px-1 text-[12px] text-bz-muted hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
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
            they&rsquo;re not search filters and they have nowhere to hold
            Arabic — so on /ar they print in English. Re-type one in the box
            above to promote it into the amenity list, which is where an
            amenity&rsquo;s Arabic lives.
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
                      allOptions,
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
              onClick={() => beginAdd()}
              className="text-[12px] text-bz-accent hover:underline"
            >
              {onAddToTaxonomy ? "Add it to the amenity list" : "Add it as a custom amenity"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

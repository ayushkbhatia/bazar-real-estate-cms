"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FEATURE_LAYOUTS,
  FEATURE_MAX,
  type FeatureKind,
  type FeatureLayout,
} from "@/lib/content-assets/email-feature";
import { OptionBody, filterRecordOptions } from "../../_fields/record-picker";
import {
  FEATURE_KIND_META,
  FEATURE_KIND_ORDER,
  FEATURE_LAYOUT_META,
  type FeatureTarget,
} from "./_feature-types";

export type FeatureRequest = {
  /** The block being edited, or null for a new one. */
  pos: number | null;
  initial: { kind: FeatureKind; ids: string[]; layout: FeatureLayout; labels: string[] } | null;
};

export type FeatureChoice = {
  kind: FeatureKind;
  ids: string[];
  labels: string[];
  layout: FeatureLayout;
};

/**
 * The Feature picker: choose up to six listings, projects, articles or area
 * guides, put them in order, and pick how they draw.
 *
 * Every published record is already in `targets`, so searching needs no
 * round-trip. Only records whose card the email can draw are offered.
 */
export function FeatureDialog({
  request,
  targets,
  defaultKind = "property",
  onClose,
  onChoose,
}: {
  /** `null` while closed. */
  request: FeatureRequest | null;
  targets: FeatureTarget[];
  defaultKind?: FeatureKind;
  onClose: () => void;
  onChoose: (choice: FeatureChoice) => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[760px]">
        {/* Mounted only while open, so each open starts from its own request. */}
        {request ? (
          <PickerForm
            request={request}
            targets={targets}
            defaultKind={defaultKind}
            onClose={onClose}
            onChoose={onChoose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PickerForm({
  request,
  targets,
  defaultKind,
  onClose,
  onChoose,
}: {
  request: FeatureRequest;
  targets: FeatureTarget[];
  defaultKind: FeatureKind;
  onClose: () => void;
  onChoose: (choice: FeatureChoice) => void;
}) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<FeatureKind>(request.initial?.kind ?? defaultKind);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>(request.initial?.ids ?? []);
  const [layout, setLayout] = useState<FeatureLayout>(request.initial?.layout ?? "card");
  const [active, setActive] = useState(0);

  const byKey = useMemo(() => new Map(targets.map((t) => [`${t.kind}:${t.id}`, t])), [targets]);
  const counts = useMemo(() => {
    const out: Record<FeatureKind, number> = { property: 0, development: 0, article: 0, area: 0 };
    for (const t of targets) out[t.kind]++;
    return out;
  }, [targets]);

  const visible = useMemo(() => {
    const pool = targets.filter((t) => t.kind === kind);
    return (filterRecordOptions(pool, query.trim()) as FeatureTarget[]).slice(0, 80);
  }, [targets, kind, query]);

  const meta = FEATURE_KIND_META[kind];
  const full = picked.length >= FEATURE_MAX;
  // Names kept for records that are no longer published, so the editor can
  // still see what a block held and take it out.
  const initialLabels = new Map(
    (request.initial?.ids ?? []).map((id, i) => [id, request.initial?.labels[i] ?? ""]),
  );

  function switchKind(next: FeatureKind) {
    if (next === kind) return;
    setKind(next);
    setPicked([]);
    setQuery("");
    setActive(0);
  }

  function toggle(id: string) {
    setPicked((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : list.length >= FEATURE_MAX ? list : [...list, id],
    );
  }

  function move(index: number, delta: number) {
    setPicked((list) => {
      const next = [...list];
      const to = index + delta;
      if (to < 0 || to >= next.length) return list;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function step(delta: number) {
    if (visible.length === 0) return;
    const next = Math.max(0, Math.min(visible.length - 1, active + delta));
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView?.({ block: "nearest" });
  }

  function submit() {
    if (picked.length === 0) return;
    onChoose({
      kind,
      ids: picked,
      labels: picked.map((id) => byKey.get(`${kind}:${id}`)?.name ?? initialLabels.get(id) ?? ""),
      layout,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{request.pos === null ? "Feature on the site" : "Edit featured block"}</DialogTitle>
        <DialogDescription>
          Pick up to {FEATURE_MAX}. Each card is drawn when the newsletter goes out, from the live record — today&apos;s
          photo, name and price, in Arabic for Arabic subscribers — and anything unpublished by then is left out.
        </DialogDescription>
      </DialogHeader>

      <div
        role="tablist"
        aria-label="What to feature"
        className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border border-bz-border bg-bz-surface-2 p-1"
      >
        {FEATURE_KIND_ORDER.map((k) => {
          const Icon = FEATURE_KIND_META[k].icon;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => switchKind(k)}
              title={picked.length > 0 && k !== kind ? "Switching clears your picks — one block features one kind" : undefined}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-md text-[12.5px] transition-colors",
                kind === k ? "bg-bz-bg text-bz-ink shadow-sm" : "text-bz-muted hover:text-bz-ink",
              )}
            >
              <Icon size={13} strokeWidth={1.8} aria-hidden />
              {FEATURE_KIND_META[k].tab}
              <span className="mono text-[10.5px] text-bz-muted-2">{counts[k]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="relative">
            <Search
              size={13}
              strokeWidth={1.8}
              aria-hidden
              className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-bz-muted"
            />
            <Input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-label={`Search ${meta.plural}`}
              placeholder={`Search ${meta.plural}…`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  step(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  step(-1);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const t = visible[active];
                  if (t) toggle(t.id);
                }
              }}
              className="h-9 ps-8 text-[13px]"
            />
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable
            aria-label={meta.tab}
            className="h-[300px] overflow-y-auto rounded border border-bz-border p-1"
          >
            {visible.length === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-bz-muted">
                {counts[kind] === 0 ? `No published ${meta.plural} yet.` : `No ${meta.noun} matches “${query.trim()}”.`}
              </p>
            ) : (
              visible.map((t, i) => {
                const on = picked.includes(t.id);
                const disabled = !on && full;
                return (
                  <div
                    key={t.id}
                    data-index={i}
                    role="option"
                    aria-selected={on}
                    aria-disabled={disabled}
                    onClick={() => !disabled && toggle(t.id)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5",
                      i === active && "bg-bz-surface-2/70",
                      on && "bg-bz-surface-2",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        on ? "border-bz-navy bg-bz-navy text-bz-bg" : "border-bz-border-strong bg-bz-bg",
                      )}
                    >
                      {on ? <Check size={11} strokeWidth={2.4} /> : null}
                    </span>
                    <OptionBody item={t} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[11px] uppercase tracking-widest text-bz-muted-2">
              <span>In this block</span>
              <span className="mono normal-case tracking-normal">
                {picked.length}/{FEATURE_MAX}
              </span>
            </div>
            {picked.length === 0 ? (
              <p className="rounded border border-dashed border-bz-border px-3 py-4 text-center text-[12px] text-bz-muted">
                Tick {meta.plural} on the left.
              </p>
            ) : (
              <ol className="flex flex-col gap-1">
                {picked.map((id, i) => {
                  const t = byKey.get(`${kind}:${id}`);
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-1.5 rounded border border-bz-border bg-bz-bg px-2 py-1 text-[12px]"
                    >
                      <span className="mono w-4 shrink-0 text-[10.5px] text-bz-muted">{i + 1}</span>
                      <span className={cn("min-w-0 flex-1 truncate", !t && "text-[oklch(0.45_0.1_60)]")}>
                        {t?.name ?? (initialLabels.get(id) || "Unpublished record")}
                        {!t ? " · not live" : ""}
                      </span>
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="rounded p-0.5 text-bz-muted hover:text-bz-ink disabled:opacity-30"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={i === picked.length - 1}
                        onClick={() => move(i, 1)}
                        className="rounded p-0.5 text-bz-muted hover:text-bz-ink disabled:opacity-30"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => toggle(id)}
                        className="rounded p-0.5 text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[11px] uppercase tracking-widest text-bz-muted-2">Show them as</legend>
            {FEATURE_LAYOUTS.map((l) => (
              <label
                key={l}
                className={cn(
                  "flex cursor-pointer gap-2.5 rounded-lg border p-2 transition-colors",
                  layout === l ? "border-bz-navy bg-bz-surface-2" : "border-bz-border hover:border-bz-ink-2",
                )}
              >
                <input
                  type="radio"
                  name="feature-layout"
                  value={l}
                  checked={layout === l}
                  onChange={() => setLayout(l)}
                  className="sr-only"
                />
                <LayoutSketch layout={l} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-bz-ink">{FEATURE_LAYOUT_META[l].label}</span>
                  <span className="block text-[11px] leading-snug text-bz-muted">{FEATURE_LAYOUT_META[l].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={picked.length === 0}>
          {request.pos === null
            ? `Insert ${picked.length || ""} ${picked.length === 1 ? meta.noun : meta.plural}`.replace(/\s+/g, " ")
            : "Save block"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** A thumbnail-sized drawing of each layout, so the choice is visual. */
export function LayoutSketch({ layout }: { layout: FeatureLayout }) {
  if (layout === "grid") {
    return (
      <span aria-hidden className="grid h-9 w-12 shrink-0 grid-cols-2 gap-0.5 rounded border border-bz-border p-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rounded-[2px] bg-bz-border" />
        ))}
      </span>
    );
  }
  if (layout === "list") {
    return (
      <span aria-hidden className="flex h-9 w-12 shrink-0 flex-col justify-center gap-1 rounded border border-bz-border px-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="size-1.5 rounded-[1px] bg-bz-teal" />
            <span className="h-1 flex-1 rounded-full bg-bz-border" />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span aria-hidden className="flex h-9 w-12 shrink-0 flex-col gap-0.5 rounded border border-bz-border p-0.5">
      <span className="flex-1 rounded-[2px] bg-bz-border" />
      <span className="h-1 w-2/3 rounded-full bg-bz-border" />
      <span className="h-1 w-1/3 rounded-full bg-bz-teal" />
    </span>
  );
}

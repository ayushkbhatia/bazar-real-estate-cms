"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArabicTwin } from "../../_fields/arabic-twin";
import { PROPERTY_TYPES } from "@/lib/schemas/property";
import {
  SEARCH_BAR_COPY_KEYS,
  type ResolvedSearchBar,
  type SearchBarCopy,
  type SearchBarTab,
  type SearchBarCopyKey,
} from "@/lib/search-bar";
import {
  MAX_SEARCH_BAR_TABS,
  MAX_SEARCH_BAR_TYPES,
  blankTab,
  type SearchBarTabSaveInput,
} from "@/lib/schemas/search-bar";
import type { SimpleFieldDef } from "@/lib/master-pages/types";
import { resetSearchBar, saveSearchBar } from "./_actions";

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";

type Pane = "copy" | "tabs";

const PANES: { key: Pane; label: string }[] = [
  { key: "tabs", label: "Search tabs" },
  { key: "copy", label: "Labels & CTA" },
];

/** The `SimpleFieldDef` `ArabicTwin` wants, derived rather than hand-built. */
function copyField(key: SearchBarCopyKey, label: string): SimpleFieldDef {
  const spec = SEARCH_BAR_COPY_KEYS.find((k) => k.key === key)!;
  return { key, label, kind: "text", max: spec.max, optional: true };
}

function tabField(key: string, label: string, max: number): SimpleFieldDef {
  return { key, label, kind: "text", max, optional: true };
}

function toSaveTab(tab: SearchBarTab): SearchBarTabSaveInput {
  return {
    key: tab.key,
    label: tab.label,
    label_ar: tab.label_ar ?? null,
    route: tab.route,
    placeholder: tab.placeholder,
    placeholder_ar: tab.placeholder_ar ?? null,
    types: tab.types.map((t) => ({
      value: t.value as SearchBarTabSaveInput["types"][number]["value"],
      label: t.label,
      label_ar: t.label_ar ?? null,
    })),
    beds: tab.beds,
    size: tab.size,
    price: tab.price,
    enabled: tab.enabled,
  };
}

export function SearchBarEditor({
  bar,
  defaults,
}: {
  bar: ResolvedSearchBar;
  /** The catalogue English a blank override falls back to, per copy key. */
  defaults: Record<string, string>;
}) {
  const router = useRouter();
  const [pane, setPane] = useState<Pane>("tabs");
  const [copy, setCopy] = useState<SearchBarCopy>(bar.copy);
  const [tabs, setTabs] = useState<SearchBarTabSaveInput[]>(() =>
    bar.tabs.map(toSaveTab),
  );
  const [open, setOpen] = useState<number | null>(0);
  const [pending, start] = useTransition();

  function patchTab(index: number, patch: Partial<SearchBarTabSaveInput>) {
    setTabs((list) =>
      list.map((tab, i) => (i === index ? { ...tab, ...patch } : tab)),
    );
  }

  function move(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= tabs.length) return;
    setTabs((list) => {
      const out = [...list];
      [out[index], out[next]] = [out[next], out[index]];
      return out;
    });
    setOpen(next);
  }

  function save() {
    start(async () => {
      const result = await saveSearchBar({ key: bar.key, copy, tabs });
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
        return;
      }
      if (result.status === "invalid") {
        toast.error(result.message, {
          description: result.issues.slice(0, 4).join(" · "),
        });
        return;
      }
      toast.error(result.message);
    });
  }

  function revert() {
    start(async () => {
      const result = await resetSearchBar();
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
        return;
      }
      toast.error(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[74ch]">
          <p className="text-[13px] text-bz-muted">{bar.def.description}</p>
          <p className="mt-1 text-[12px] text-bz-muted-2">
            {bar.usingDefaults
              ? "Nothing saved yet — the home page is rendering the built-in setup below."
              : "Saved settings are live on the home page."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-bz-ink"
          >
            View on site <ExternalLink size={12} strokeWidth={1.8} />
          </Link>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || bar.usingDefaults}
            onClick={revert}
          >
            <RotateCcw size={13} strokeWidth={1.8} /> Revert to built-in
          </Button>
          <Button size="sm" disabled={pending} onClick={save}>
            <Save size={13} strokeWidth={1.8} /> Save
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-bz-border">
        {PANES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPane(p.key)}
            className={cn(
              "h-8 px-3 text-[12.5px] -mb-px border-b-2 transition-colors",
              pane === p.key
                ? "border-bz-accent text-bz-ink"
                : "border-transparent text-bz-muted hover:text-bz-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pane === "copy" ? (
        <CopyPane copy={copy} defaults={defaults} onChange={setCopy} />
      ) : (
        <TabsPane
          tabs={tabs}
          open={open}
          setOpen={setOpen}
          onPatch={patchTab}
          onMove={move}
          onRemove={(i) => {
            setTabs((list) => list.filter((_, x) => x !== i));
            setOpen(null);
          }}
          onAdd={() => {
            setTabs((list) => [...list, blankTab()]);
            setOpen(tabs.length);
          }}
        />
      )}
    </div>
  );
}

// ── labels & CTA ─────────────────────────────────────────────────────────

const COPY_LABELS: Record<SearchBarCopyKey, { label: string; help?: string }> = {
  submit_label: { label: "Button" },
  pending_label: {
    label: "While searching",
    help: "What the button says between the click and the results page.",
  },
  type_label: { label: "Property-type field" },
  any_type_label: { label: "Property type — “any” option" },
  beds_label: { label: "Bedrooms field" },
  any_beds_label: { label: "Bedrooms — “any” option" },
  size_label: {
    label: "Size slider",
    help: "The unit (ft² or m²) is appended from the visitor's own preference.",
  },
  price_label: { label: "Price slider" },
};

/**
 * Eight labels, each blank by default.
 *
 * Blank is not missing copy — it is the instruction "use the site's own
 * wording", which already exists in both languages. The placeholder shows what
 * that wording is, so the box reads as an override rather than as a hole.
 */
function CopyPane({
  copy,
  defaults,
  onChange,
}: {
  copy: SearchBarCopy;
  defaults: Record<string, string>;
  onChange: (copy: SearchBarCopy) => void;
}) {
  function patch(patchIn: Partial<SearchBarCopy>) {
    onChange({ ...copy, ...patchIn });
  }

  return (
    <div className="flex flex-col gap-4 max-w-[52ch]">
      <p className="text-[12px] text-bz-muted-2 leading-relaxed">
        Leave a box empty and the search bar uses the site&apos;s own wording,
        shown in grey — already translated, and shared with the filter bar on
        the results pages. Type here only to override it on the home page.
      </p>

      {SEARCH_BAR_COPY_KEYS.map(({ key, max }) => {
        const spec = COPY_LABELS[key];
        const arKey = `${key}_ar` as keyof SearchBarCopy;
        return (
          <div key={key} className="flex flex-col gap-1">
            <Label className="text-[12px]">{spec.label}</Label>
            <input
              className={fieldCls}
              maxLength={max}
              placeholder={defaults[key] ?? ""}
              value={copy[key] ?? ""}
              onChange={(e) => patch({ [key]: e.target.value || null } as Partial<SearchBarCopy>)}
            />
            {spec.help ? (
              <span className="text-[11px] text-bz-muted-2">{spec.help}</span>
            ) : null}
            <ArabicTwin
              field={copyField(key, spec.label)}
              value={(copy[arKey] as string | null) ?? ""}
              onChange={(v) =>
                patch({ [arKey]: v || null } as Partial<SearchBarCopy>)
              }
            />
          </div>
        );
      })}
    </div>
  );
}

// ── tabs ─────────────────────────────────────────────────────────────────

function TabsPane({
  tabs,
  open,
  setOpen,
  onPatch,
  onMove,
  onRemove,
  onAdd,
}: {
  tabs: SearchBarTabSaveInput[];
  open: number | null;
  setOpen: (index: number | null) => void;
  onPatch: (index: number, patch: Partial<SearchBarTabSaveInput>) => void;
  onMove: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-bz-muted-2 max-w-[74ch] leading-relaxed">
        The row of tabs across the top of the search bar, in this order. Each
        one carries its own placeholder, its own property-type list and its own
        slider ceilings — switching tab resets those controls, so a tab is a
        whole search, not a filter on one.
      </p>

      <ul className="flex flex-col gap-2">
        {tabs.map((tab, index) => (
          <li
            key={index}
            className="rounded-lg border border-bz-border bg-bz-surface"
          >
            <div className="flex items-center gap-2 p-2.5">
              <button
                type="button"
                className="flex-1 text-start"
                onClick={() => setOpen(open === index ? null : index)}
                aria-expanded={open === index}
              >
                <span className="text-[13px] font-medium">
                  {tab.label || "Untitled tab"}
                </span>
                <span className="mono text-[11px] text-bz-muted ms-2">
                  {tab.key || "no-key"} · {tab.route}
                </span>
                {!tab.enabled ? (
                  <span className="ms-2 text-[11px] text-bz-muted-2">— off</span>
                ) : null}
              </button>
              <label className="flex items-center gap-1.5 text-[11.5px] text-bz-muted">
                <input
                  type="checkbox"
                  checked={tab.enabled}
                  onChange={(e) => onPatch(index, { enabled: e.target.checked })}
                />
                Show
              </label>
              <button
                type="button"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
                className="p-1 text-bz-muted hover:text-bz-ink disabled:opacity-40"
              >
                <ChevronUp size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={index === tabs.length - 1}
                onClick={() => onMove(index, 1)}
                className="p-1 text-bz-muted hover:text-bz-ink disabled:opacity-40"
              >
                <ChevronDown size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                aria-label="Delete tab"
                onClick={() => onRemove(index)}
                className="p-1 text-bz-muted hover:text-bz-danger"
              >
                <Trash2 size={14} strokeWidth={1.8} />
              </button>
            </div>

            {open === index ? (
              <TabDetail
                tab={tab}
                onPatch={(patch) => onPatch(index, patch)}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={tabs.length >= MAX_SEARCH_BAR_TABS}
          onClick={onAdd}
        >
          <Plus size={13} strokeWidth={1.8} /> Add a tab
        </Button>
        <p className="mt-1.5 text-[11px] text-bz-muted-2">
          The row is sized to its labels rather than to the card, so a fifth tab
          or a long label pushes the bar wider on desktop. Check the home page
          after adding one.
        </p>
      </div>
    </div>
  );
}

function TabDetail({
  tab,
  onPatch,
}: {
  tab: SearchBarTabSaveInput;
  onPatch: (patch: Partial<SearchBarTabSaveInput>) => void;
}) {
  return (
    <div className="border-t border-bz-border p-3 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-[12px]">Label</Label>
          <input
            className={fieldCls}
            maxLength={40}
            value={tab.label}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
          <ArabicTwin
            field={tabField("label", "Label", 40)}
            value={tab.label_ar ?? ""}
            onChange={(v) => onPatch({ label_ar: v || null })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[12px]">Key</Label>
          <input
            className={cn(fieldCls, "mono")}
            maxLength={40}
            value={tab.key}
            onChange={(e) => onPatch({ key: e.target.value })}
          />
          <span className="text-[11px] text-bz-muted-2">
            How the rest of the site names this tab. Renaming one changes which
            tab the Buy, Rent and Off-plan pages open on.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[12px]">Searches</Label>
        <input
          className={cn(fieldCls, "mono")}
          maxLength={120}
          value={tab.route}
          onChange={(e) => onPatch({ route: e.target.value })}
        />
        <span className="text-[11px] text-bz-muted-2">
          A path on this site, like <code className="mono">/buy</code>. The
          filters the visitor picked arrive as a querystring.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[12px]">Search box placeholder</Label>
        <input
          className={fieldCls}
          maxLength={120}
          value={tab.placeholder}
          onChange={(e) => onPatch({ placeholder: e.target.value })}
        />
        <ArabicTwin
          field={tabField("placeholder", "Search box placeholder", 120)}
          value={tab.placeholder_ar ?? ""}
          onChange={(v) => onPatch({ placeholder_ar: v || null })}
        />
      </div>

      <TypeList
        types={tab.types}
        onChange={(types) => onPatch({ types })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={tab.beds}
            onChange={(e) =>
              onPatch({
                beds: e.target.checked,
                // The two controls share a slot: a tab shows beds or size,
                // never both, so turning beds on retires the scale rather than
                // hiding it where it can come back on the next toggle.
                size: e.target.checked ? null : (tab.size ?? { max: 200_000, step: 1_000 }),
              })
            }
          />
          Ask for bedrooms
        </label>
        <span className="text-[11.5px] text-bz-muted-2 self-center">
          Off shows a size slider in the same slot instead — what the commercial
          tab does.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberPair
          label="Price ceiling (AED)"
          help="The top of the slider's range. Steps are what each notch moves by."
          value={tab.price}
          onChange={(price) => onPatch({ price })}
        />
        {tab.beds ? null : (
          <NumberPair
            label="Size ceiling (ft²)"
            help="Stored in ft² whatever the visitor's display unit is; only the labels convert."
            value={tab.size ?? { max: 200_000, step: 1_000 }}
            onChange={(size) => onPatch({ size })}
          />
        )}
      </div>
    </div>
  );
}

function TypeList({
  types,
  onChange,
}: {
  types: SearchBarTabSaveInput["types"];
  onChange: (types: SearchBarTabSaveInput["types"]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[12px]">Property types offered</Label>
      <p className="text-[11px] text-bz-muted-2">
        The dropdown beside the search box. The value on the left is what the
        results page filters on — it has to be one of the site&apos;s property
        types, or the filter is silently ignored.
      </p>
      <ul className="flex flex-col gap-2">
        {types.map((type, index) => (
          <li key={index} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <select
                className={cn(fieldCls, "w-[180px] mono")}
                value={type.value}
                onChange={(e) =>
                  onChange(
                    types.map((t, i) =>
                      i === index
                        ? { ...t, value: e.target.value as typeof t.value }
                        : t,
                    ),
                  )
                }
              >
                {PROPERTY_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                className={fieldCls}
                maxLength={60}
                value={type.label}
                onChange={(e) =>
                  onChange(
                    types.map((t, i) =>
                      i === index ? { ...t, label: e.target.value } : t,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label="Remove property type"
                onClick={() => onChange(types.filter((_, i) => i !== index))}
                className="p-1 text-bz-muted hover:text-bz-danger"
              >
                <Trash2 size={14} strokeWidth={1.8} />
              </button>
            </div>
            <ArabicTwin
              field={tabField(`type-${index}`, type.label || "Property type", 60)}
              value={type.label_ar ?? ""}
              onChange={(v) =>
                onChange(
                  types.map((t, i) =>
                    i === index ? { ...t, label_ar: v || null } : t,
                  ),
                )
              }
            />
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={types.length >= MAX_SEARCH_BAR_TYPES}
          onClick={() =>
            onChange([
              ...types,
              { value: "apartment", label: "Apartment", label_ar: null },
            ])
          }
        >
          <Plus size={13} strokeWidth={1.8} /> Add a type
        </Button>
      </div>
    </div>
  );
}

function NumberPair({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: { max: number; step: number };
  onChange: (value: { max: number; step: number }) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[12px]">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className={cn(fieldCls, "mono")}
          value={value.max}
          onChange={(e) =>
            onChange({ ...value, max: Number(e.target.value) || 0 })
          }
        />
        <span className="text-[11.5px] text-bz-muted-2 shrink-0">step</span>
        <input
          type="number"
          className={cn(fieldCls, "mono w-[110px]")}
          value={value.step}
          onChange={(e) =>
            onChange({ ...value, step: Number(e.target.value) || 0 })
          }
        />
      </div>
      <span className="text-[11px] text-bz-muted-2">{help}</span>
    </div>
  );
}

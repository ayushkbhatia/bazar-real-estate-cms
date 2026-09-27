"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  ExternalLink,
  House,
  MapPin,
  Search,
  type LucideIcon,
} from "lucide-react";
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
import type {
  InternalLinkKind,
  InternalLinkVariant,
} from "@/lib/internal-links/model";
import { OptionBody, filterRecordOptions } from "../_fields/record-picker";
import type { InternalLinkTarget } from "./_link-targets";

/** How the pick lands in the article: a block of either variant, or the selected words. */
export type InternalLinkAs = InternalLinkVariant | "text";

export type InternalLinkRequest = {
  /**
   * `insert` — a new block, or a new text link when words are selected.
   * `edit-block` — re-point or restyle the block at `pos`.
   * `edit-text` — re-point the internal link the cursor is in.
   */
  mode: "insert" | "edit-block" | "edit-text";
  /** Words are selected, so "link the selected text" is on offer. */
  hasTextSelection: boolean;
  initial: { kind: InternalLinkKind; id: string | null; as: InternalLinkAs } | null;
  /** The block being edited. */
  pos?: number;
};

export type InternalLinkChoice = {
  target: InternalLinkTarget;
  as: InternalLinkAs;
};

export const KIND_META: Record<
  InternalLinkKind,
  { tab: string; noun: string; icon: LucideIcon; label: string }
> = {
  area: { tab: "Areas", noun: "area", icon: MapPin, label: "Area guide" },
  development: {
    tab: "Projects",
    noun: "project",
    icon: Building2,
    label: "Project",
  },
  property: { tab: "Listings", noun: "listing", icon: House, label: "Listing" },
};

const KINDS: InternalLinkKind[] = ["area", "development", "property"];

/**
 * The internal-link picker: choose an area, project or listing, and how it
 * should appear.
 *
 * Every published record is already in `targets` — the whole catalogue is a
 * few hundred rows — so searching is instant and needs no round-trip. Typing
 * narrows the list, the arrow keys move through it, Enter inserts; a
 * double-click inserts too.
 */
export function InternalLinkDialog({
  request,
  targets,
  defaultKind = "area",
  onClose,
  onChoose,
  onUnlink,
}: {
  /** `null` while closed. */
  request: InternalLinkRequest | null;
  targets: InternalLinkTarget[];
  /**
   * The tab a new link opens on — the kind the editor inserted last, so a
   * writer linking three listings in a row picks "Listings" once.
   */
  defaultKind?: InternalLinkKind;
  onClose: () => void;
  onChoose: (choice: InternalLinkChoice) => void;
  /** Offered when editing a text link: remove the link, keep the words. */
  onUnlink: () => void;
}) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[680px]">
        {/*
          Mounted only while open, so every open starts from the request it
          was given — a previous search or selection carried into the next
          insert would attach the wrong record.
        */}
        {request ? (
          <PickerForm
            request={request}
            targets={targets}
            defaultKind={defaultKind}
            onClose={onClose}
            onChoose={onChoose}
            onUnlink={onUnlink}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The records that answer the search, best first.
 *
 * Which records match is the shared pickers' rule (`filterRecordOptions`):
 * every word must appear somewhere in the record — name, reference, facts,
 * price — with numbers matched as whole figures, so "5 bed" does not find
 * "6,555 ft²". What this adds is ORDER. Matching reads the detail line too,
 * so "yas island" matches Yas Acres (a community *in* Yas Island) as well as
 * Yas Island itself, and alphabetical order put the wrong one first — one
 * Enter away from being inserted. A record named what was typed comes first,
 * then one whose name starts with it, then one whose name holds every word;
 * ties keep their A–Z order.
 */
function search(
  pool: InternalLinkTarget[],
  query: string,
): InternalLinkTarget[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  const matched = filterRecordOptions(pool, q) as InternalLinkTarget[];
  if (!q) return matched;
  const words = q.split(" ");
  const score = (t: InternalLinkTarget) => {
    const name = t.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (words.every((w) => name.includes(w))) return 2;
    return 3;
  };
  return matched
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => a.s - b.s)
    .map((r) => r.t);
}

function PickerForm({
  request,
  targets,
  defaultKind,
  onClose,
  onChoose,
  onUnlink,
}: {
  request: InternalLinkRequest;
  targets: InternalLinkTarget[];
  defaultKind: InternalLinkKind;
  onClose: () => void;
  onChoose: (choice: InternalLinkChoice) => void;
  onUnlink: () => void;
}) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<InternalLinkKind>(
    request.initial?.kind ?? defaultKind,
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    request.initial?.id ?? null,
  );
  const [as, setAs] = useState<InternalLinkAs>(
    request.initial?.as ?? (request.hasTextSelection ? "text" : "card"),
  );

  const counts = useMemo(() => {
    const out: Record<InternalLinkKind, number> = {
      area: 0,
      development: 0,
      property: 0,
    };
    for (const t of targets) out[t.kind]++;
    return out;
  }, [targets]);

  const visible = useMemo(
    () => search(targets.filter((t) => t.kind === kind), query),
    [targets, kind, query],
  );

  // The highlighted row: the one picked, while it is still in view; else the
  // first match, so "type, Enter" inserts the obvious result.
  const active =
    visible.find((t) => t.id === selectedId) ?? visible[0] ?? null;

  const choices: { value: InternalLinkAs; label: string; hint: string }[] = [];
  if (request.mode !== "edit-text") {
    choices.push(
      {
        value: "card",
        label: "Card",
        hint: "Photo, name and live facts, between paragraphs.",
      },
      {
        value: "compact",
        label: "Compact",
        hint: "One line with a thumbnail — for a see-also.",
      },
    );
  }
  if (request.mode === "edit-text" || request.hasTextSelection) {
    choices.push({
      value: "text",
      label: "Text link",
      hint: "Links the words you selected.",
    });
  }
  const effectiveAs = choices.some((c) => c.value === as)
    ? as
    : choices[0].value;

  const submitLabel =
    request.mode === "edit-block"
      ? "Save block"
      : request.mode === "edit-text"
        ? "Update link"
        : effectiveAs === "text"
          ? "Link selected text"
          : effectiveAs === "compact"
            ? "Insert compact link"
            : "Insert card";

  function submit(target: InternalLinkTarget | null = active) {
    if (!target) return;
    onChoose({ target, as: effectiveAs });
  }

  function move(delta: number) {
    if (visible.length === 0) return;
    const at = active ? visible.indexOf(active) : -1;
    const next = visible[Math.max(0, Math.min(visible.length - 1, at + delta))];
    setSelectedId(next.id);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }

  const meta = KIND_META[kind];
  const optionId = (id: string) => `${listId}-${id}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {request.mode === "insert"
            ? "Link to a page on this site"
            : request.mode === "edit-block"
              ? "Edit link block"
              : "Edit text link"}
        </DialogTitle>
        <DialogDescription>
          Only published pages are listed. The link follows the record, not
          its URL: the card shows the live name, photo and price, keeps working
          if the page is renamed, and disappears — rather than breaking — if
          it is unpublished.
        </DialogDescription>
      </DialogHeader>

      <div
        role="tablist"
        aria-label="What to link to"
        className="grid grid-cols-3 gap-1 rounded-lg border border-bz-border bg-bz-surface-2 p-1"
      >
        {KINDS.map((k) => {
          const Icon = KIND_META[k].icon;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setSelectedId(null);
              }}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-md text-[12.5px] transition-colors",
                kind === k
                  ? "bg-bz-bg text-bz-ink shadow-sm"
                  : "text-bz-muted hover:text-bz-ink",
              )}
            >
              <Icon size={13} strokeWidth={1.8} aria-hidden />
              {KIND_META[k].tab}
              <span className="mono text-[10.5px] text-bz-muted-2">
                {counts[k]}
              </span>
            </button>
          );
        })}
      </div>

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
          aria-activedescendant={active ? optionId(active.id) : undefined}
          aria-label={`Search ${meta.noun}s`}
          placeholder={
            kind === "property"
              ? "Search listings by title, reference or area…"
              : kind === "development"
                ? "Search projects by name, developer or area…"
                : "Search areas and communities…"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="h-9 ps-8 text-[13px]"
        />
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={meta.tab}
        className="max-h-[280px] overflow-y-auto rounded border border-bz-border p-1"
      >
        {visible.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-bz-muted">
            {counts[kind] === 0
              ? `No published ${meta.noun}s yet.`
              : `No ${meta.noun} matches “${query.trim()}”.`}
          </p>
        ) : (
          visible.map((t) => {
            const isActive = active?.id === t.id;
            return (
              <div
                key={t.id}
                id={optionId(t.id)}
                data-id={t.id}
                role="option"
                aria-selected={isActive}
                onClick={() => setSelectedId(t.id)}
                onDoubleClick={() => submit(t)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5",
                  isActive ? "bg-bz-surface-2" : "hover:bg-bz-surface-2/60",
                )}
              >
                {/* The same row the page builder's listing picker draws —
                    photo, reference, facts, price — so a listing reads the
                    same wherever an editor picks one. */}
                <OptionBody item={t} />
                {isActive ? (
                  <Check
                    size={14}
                    strokeWidth={2}
                    aria-hidden
                    className="shrink-0 text-bz-teal"
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {active ? (
        <div className="-mt-1 flex min-w-0 items-center gap-1.5 text-[11.5px] text-bz-muted">
          <span className="shrink-0">Links to</span>
          <a
            href={active.href}
            target="_blank"
            rel="noreferrer"
            className="mono inline-flex min-w-0 items-center gap-1 truncate text-bz-teal hover:text-bz-navy"
          >
            <span className="truncate">{active.href}</span>
            <ExternalLink size={11} aria-hidden className="shrink-0" />
          </a>
        </div>
      ) : null}

      {choices.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[11px] uppercase tracking-widest text-bz-muted-2">
            Show it as
          </legend>
          <div
            className={cn(
              "grid gap-2",
              choices.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
            )}
          >
            {choices.map((c) => (
              <label
                key={c.value}
                className={cn(
                  "flex cursor-pointer gap-2.5 rounded-lg border p-2.5 transition-colors",
                  effectiveAs === c.value
                    ? "border-bz-navy bg-bz-surface-2"
                    : "border-bz-border hover:border-bz-ink-2",
                )}
              >
                <input
                  type="radio"
                  name="internal-link-as"
                  value={c.value}
                  checked={effectiveAs === c.value}
                  onChange={() => setAs(c.value)}
                  className="sr-only"
                />
                <Sketch as={c.value} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-bz-ink">
                    {c.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-bz-muted">
                    {c.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <DialogFooter className="sm:justify-between">
        {request.mode === "edit-text" ? (
          <Button type="button" variant="ghost" onClick={onUnlink}>
            Remove link
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => submit()} disabled={!active}>
            {submitLabel}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/** A thumbnail-sized drawing of each option, so the choice is visual. */
function Sketch({ as }: { as: InternalLinkAs }) {
  if (as === "text") {
    return (
      <span aria-hidden className="flex h-9 w-12 shrink-0 flex-col justify-center gap-1">
        <span className="h-1 w-full rounded-full bg-bz-border" />
        <span className="flex gap-1">
          <span className="h-1 w-3 rounded-full bg-bz-border" />
          <span className="h-1 w-5 rounded-full bg-bz-teal" />
        </span>
        <span className="h-1 w-3/4 rounded-full bg-bz-border" />
      </span>
    );
  }
  if (as === "compact") {
    return (
      <span
        aria-hidden
        className="flex h-9 w-12 shrink-0 items-center gap-1 rounded border border-s-2 border-bz-border border-s-bz-teal px-1"
      >
        <span className="size-4 rounded-sm bg-bz-border" />
        <span className="h-1 flex-1 rounded-full bg-bz-border" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-9 w-12 shrink-0 gap-1 rounded border border-bz-border p-0.5"
    >
      <span className="w-5 rounded-sm bg-bz-border" />
      <span className="flex flex-1 flex-col justify-center gap-0.5">
        <span className="h-1 w-full rounded-full bg-bz-border" />
        <span className="h-1 w-2/3 rounded-full bg-bz-border" />
        <span className="h-1 w-1/2 rounded-full bg-bz-teal" />
      </span>
    </span>
  );
}

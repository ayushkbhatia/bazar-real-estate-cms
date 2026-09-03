"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CARD_LABEL_KINDS,
  CARD_LABEL_KIND_NAME,
  cardLabelId,
  type CardLabel,
  type CardLabelKind,
} from "@/lib/card-labels";
import { updateCardLabels } from "./_actions";

/**
 * /admin/settings/card-labels — the words a card wears over its image.
 *
 * WHAT THE ORDER MEANS, because it is the one non-obvious control here.
 *
 * A card has room for two chips and a property may carry more. The list order
 * is the priority: the first two enabled labels a listing carries are the two
 * it shows. So dragging "Exclusive" above "New launch" is how an operator says
 * which one matters when a listing is both — a decision that used to be a
 * constant in `listing-badge.ts` and is now theirs.
 *
 * WHY IDS ARE INVISIBLE. Every property that carries a label stores its ID, so
 * an id that changed on save would silently untag listings. It is allocated
 * once from the English text and then never touched — which is what makes
 * renaming a label safe, and why there is no field for it on this screen.
 */

const SWATCH: Record<CardLabelKind, string> = {
  ink: "bg-bz-navy text-bz-bg",
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

const MAX_TEXT = 28;

export function CardLabelsForm({ initial }: { initial: CardLabel[] }) {
  const [labels, setLabels] = useState<CardLabel[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();

  function patch(i: number, next: Partial<CardLabel>) {
    setLabels((ls) => ls.map((l, n) => (n === i ? { ...l, ...next } : l)));
  }

  function move(i: number, by: -1 | 1) {
    setLabels((ls) => {
      const j = i + by;
      if (j < 0 || j >= ls.length) return ls;
      const out = [...ls];
      [out[i], out[j]] = [out[j]!, out[i]!];
      return out;
    });
  }

  function add() {
    const text = draft.trim();
    if (!text) return;
    setLabels((ls) => [
      ...ls,
      {
        id: cardLabelId(
          text,
          ls.map((l) => l.id),
        ),
        text: text.slice(0, MAX_TEXT),
        text_ar: "",
        kind: "ink",
        enabled: true,
      },
    ]);
    setDraft("");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateCardLabels({ labels });
      if (res.status === "ok") toast.success(res.message ?? "Saved.");
      else toast.error(res.message);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="serif text-[26px] leading-tight">Card labels</h1>
        <p className="mt-2 text-[13.5px] text-bz-ink-2 leading-relaxed">
          The chips a property or development card wears over its photograph.
          Add as many as you need, then tick them per listing on that listing’s
          own page. A card has room for two, and the order below is the priority
          — a listing carrying three shows the top two.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {labels.map((l, i) => (
          <li
            key={l.id}
            className={cn(
              "rounded-md border border-bz-border bg-bz-surface p-3",
              !l.enabled && "opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-0.5 pt-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="p-1 rounded hover:bg-bz-surface-2 disabled:opacity-30"
                >
                  <ArrowUp size={13} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === labels.length - 1}
                  onClick={() => move(i, 1)}
                  className="p-1 rounded hover:bg-bz-surface-2 disabled:opacity-30"
                >
                  <ArrowDown size={13} strokeWidth={1.8} />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label
                    htmlFor={`cl-text-${l.id}`}
                    className="text-[12px] text-bz-muted"
                  >
                    English
                  </Label>
                  <Input
                    id={`cl-text-${l.id}`}
                    value={l.text}
                    maxLength={MAX_TEXT}
                    onChange={(e) => patch(i, { text: e.target.value })}
                  />
                </div>
                <div>
                  <Label
                    htmlFor={`cl-ar-${l.id}`}
                    className="text-[12px] text-bz-muted"
                  >
                    Arabic{" "}
                    <span className="text-bz-muted-2">
                      — blank uses the English
                    </span>
                  </Label>
                  <Input
                    id={`cl-ar-${l.id}`}
                    dir="rtl"
                    lang="ar"
                    value={l.text_ar}
                    maxLength={MAX_TEXT}
                    onChange={(e) => patch(i, { text_ar: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {CARD_LABEL_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        title={CARD_LABEL_KIND_NAME[k]}
                        aria-label={CARD_LABEL_KIND_NAME[k]}
                        aria-pressed={l.kind === k}
                        onClick={() => patch(i, { kind: k })}
                        className={cn(
                          "h-[22px] px-2 rounded-full text-[11px] font-medium",
                          SWATCH[k],
                          l.kind === k
                            ? "ring-2 ring-offset-1 ring-bz-ink"
                            : "opacity-70",
                        )}
                      >
                        {l.text.trim() || CARD_LABEL_KIND_NAME[k]}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-[13px] cursor-pointer ms-auto">
                    <input
                      type="checkbox"
                      checked={l.enabled}
                      onChange={() => patch(i, { enabled: !l.enabled })}
                      className="rounded"
                    />
                    Shown on cards
                  </label>

                  {l.builtIn ? (
                    // Deleting it would strand every property whose legacy
                    // boolean still resolves to it, and the read would put the
                    // row back regardless. Switching it off is the honest
                    // control and it does what deleting appears to promise.
                    <span className="text-[11.5px] text-bz-muted">
                      Ships with the site — rename or switch off, cannot delete
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setLabels((ls) => ls.filter((_, n) => n !== i))
                      }
                      className="inline-flex items-center gap-1 text-[12.5px] text-bz-muted hover:text-bz-ink"
                    >
                      <Trash2 size={13} strokeWidth={1.8} /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="cl-new" className="text-[12px] text-bz-muted">
            New label
          </Label>
          <Input
            id="cl-new"
            value={draft}
            maxLength={MAX_TEXT}
            placeholder="e.g. New launch"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter inside a text box in a form submits it. Here that would
              // save the whole vocabulary instead of adding the row the
              // operator has just typed, which is the opposite of what the
              // key appears to do.
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={!draft.trim()}
        >
          <Plus size={14} strokeWidth={1.8} /> Add
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Saving…
            </>
          ) : (
            "Save labels"
          )}
        </Button>
        <p className="text-[12px] text-bz-muted">
          Tick labels per listing under “Featured &amp; flags” on a property, or
          “Card labels” on a development.
        </p>
      </div>
    </form>
  );
}

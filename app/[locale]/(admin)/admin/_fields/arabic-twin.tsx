"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { arMax, type SimpleFieldDef } from "@/lib/master-pages";
import { fieldCls } from "./types";

/**
 * The Arabic input for a field, nested under its English sibling.
 *
 * Collapsed by default, and that is the whole design constraint: most editors
 * here do not read Arabic, and 616 strings across the master pages alone means
 * an always-open second box would double the height of every editor for people
 * who will never type in it. Collapsed, an English-only editor's screen is
 * unchanged; expanded, the pairing is unmissable.
 *
 * It sits directly under the English rather than in a block at the bottom, so
 * a translator never has to hold the pairing in their head.
 *
 * The input carries `dir="rtl"` and `lang="ar"` so the caret starts on the
 * right and the Arabic font stack applies — typing Arabic into an LTR box is
 * possible but the cursor behaviour is disorienting enough that people assume
 * it is broken.
 */
export function ArabicTwin({
  field,
  value,
  onChange,
}: {
  field: SimpleFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const filled = value.trim().length > 0;
  // Always collapsed on mount, including when a translation already exists.
  //
  // This started as `useState(filled)` — open the ones that have content — and
  // watching the real editor changed my mind. On a fully translated page that
  // reopens every field at once and doubles the page height for everyone,
  // which is the exact cost the collapse was introduced to avoid. The badge
  // beside the label already answers "is this translated?" at a glance, which
  // is what a translator actually scans for; opening it is a separate
  // intention.
  const [open, setOpen] = useState(false);
  const max = arMax(field);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-1.5 text-[11px] text-bz-muted hover:text-bz-ink transition-colors"
        aria-expanded={open}
      >
        <ChevronRight
          size={11}
          strokeWidth={2}
          className={cn("transition-transform", open && "rotate-90")}
        />
        <span lang="ar" dir="rtl">
          العربية
        </span>
        {/* Status is never colour alone — the a11y spec runs axe against
            production, and a colour-only signal fails it. */}
        {filled ? (
          <span className="text-bz-teal">● set</span>
        ) : (
          <span className="text-bz-muted-2">— not set</span>
        )}
      </button>

      {open ? (
        <div className="mt-1.5 flex flex-col gap-1">
          {field.kind === "textarea" ? (
            <textarea
              className={cn(fieldCls, "resize-y min-h-[64px] leading-[1.75]")}
              dir="rtl"
              lang="ar"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <input
              className={cn(fieldCls, "leading-[1.75]")}
              dir="rtl"
              lang="ar"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10.5px] text-bz-muted-2">
              Blank shows the English.
            </span>
            {max ? (
              <span className="mono text-[10.5px] text-bz-muted-2">
                {value.length}/{max}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

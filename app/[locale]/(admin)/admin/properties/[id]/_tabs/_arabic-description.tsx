"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Loaded on demand, like the English editor beside it. The collapsed toggle is
 * a button and a badge; pulling ProseMirror in to render that would undo the
 * point of collapsing it.
 */
const PropertyDescriptionTab = dynamic(
  () => import("./description").then((m) => m.PropertyDescriptionTab),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] rounded bg-bz-surface-2 animate-pulse" />
    ),
  },
);

/**
 * The Arabic long description, collapsed until asked for.
 *
 * Same three-way choice as the article body, and the same answer. Two editors
 * side by side reads best for correction — which is the real job, since the
 * text arrives from the slot walker and a person fixes it — but a Tiptap
 * instance is tall enough that an editor who does not read Arabic would get a
 * permanently empty one taking half the tab. A single editor with EN/AR tabs
 * needs `setContent` on every switch plus a flush of the outgoing buffer
 * first, and getting that ordering wrong loses work silently.
 *
 * So: collapsed, and not constructed until opened. `useEditor` is a hook and
 * cannot be conditional, which is why this wraps a lazily-imported child
 * rather than branching inside one component.
 */
export function ArabicPropertyDescription({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  // "<p></p>" is what an emptied editor serialises to, so strip tags before
  // deciding whether anything is actually written.
  const filled = value.replace(/<[^>]*>/g, "").trim().length > 0;
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-1.5 text-[11px] text-bz-muted hover:text-bz-ink transition-colors self-start"
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
        {/* Never colour alone — the a11y spec runs axe against production. */}
        {filled ? (
          <span className="text-bz-teal">● set</span>
        ) : (
          <span className="text-bz-muted-2">— not set</span>
        )}
      </button>

      {open ? (
        <div className="flex flex-col gap-1.5">
          <PropertyDescriptionTab
            initialHtml={value}
            onChange={onChange}
            dir="rtl"
            lang="ar"
          />
          <span className="text-[10.5px] text-bz-muted-2">
            Blank shows the English. Use Translate to draft this, then correct
            it — the formatting is preserved for you.
          </span>
        </div>
      ) : null}
    </div>
  );
}

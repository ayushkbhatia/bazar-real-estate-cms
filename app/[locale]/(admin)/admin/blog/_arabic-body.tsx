"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlogMediaOption } from "./_image-insert-dialog";

/**
 * Loaded on demand, like the English editor above it. The collapsed toggle is
 * a button and a badge; pulling ProseMirror and the whole extension set in to
 * render that would undo the point of collapsing it.
 */
const ArticleEditor = dynamic(
  () => import("./_article-editor").then((m) => m.ArticleEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[420px] rounded bg-bz-surface-2 animate-pulse"
        aria-hidden
      />
    ),
  },
);

/**
 * The Arabic article body — a second Tiptap, collapsed until asked for.
 *
 * Three designs were possible and the choice matters more than it looks.
 *
 * Two editors side by side reads best for correction, which is the real job
 * here: the body arrives from the slot walker and a person fixes it rather
 * than writing 9,000 characters from scratch. But a Tiptap instance is 420px
 * tall before content, and an editor who does not read Arabic would get a
 * permanently empty one taking half the screen — the exact cost the collapsed
 * twin pattern exists to avoid on every other field in this CMS.
 *
 * A single editor with EN/AR tabs was the tempting middle. It needs
 * `setContent` on every switch plus a flush of the outgoing buffer into state
 * BEFORE the swap, and getting that ordering wrong loses an editor's work
 * silently. This epic has already produced three silent-data-loss bugs; a
 * switch-and-restore state machine on the one surface holding whole articles
 * is the worst available place to spend that risk again.
 *
 * So: collapsed, and the editor is not constructed until it opens. `useEditor`
 * is a hook and cannot be called conditionally, which is precisely why the
 * editor lives in this child rather than behind a ternary — unmounted means no
 * second ProseMirror instance, no second document, no cost at all for the
 * English-only case.
 */
export function ArabicArticleBody({
  value,
  onChange,
  media,
  onMediaUploaded,
}: {
  value: string;
  onChange: (html: string) => void;
  media: BlogMediaOption[];
  onMediaUploaded: (m: BlogMediaOption) => void;
}) {
  // Blank is not "" — the walker leaves an empty document as "<p></p>".
  const filled = value.replace(/<[^>]*>/g, "").trim().length > 0;
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 flex flex-col gap-2">
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
          <ArticleEditor
            defaultValue={value}
            onChange={onChange}
            media={media}
            onMediaUploaded={onMediaUploaded}
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

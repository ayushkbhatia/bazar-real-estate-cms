"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { ChevronRight, Signpost } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { countMissingBlocks, mirrorBlocks } from "@/lib/internal-links/mirror";
import type { InternalLinkTarget } from "@/lib/internal-links/types";
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
const noSubscription = () => () => {};

/** True in the browser, false on the server and through hydration. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

export function ArabicArticleBody({
  value,
  onChange,
  media,
  onMediaUploaded,
  linkTargets,
  englishHtml,
}: {
  value: string;
  onChange: (html: string) => void;
  media: BlogMediaOption[];
  onMediaUploaded: (m: BlogMediaOption) => void;
  linkTargets: InternalLinkTarget[];
  /** The English body as it stands in the form, for the link-block check. */
  englishHtml: string;
}) {
  // Blank is not "" — the walker leaves an empty document as "<p></p>".
  const filled = value.replace(/<[^>]*>/g, "").trim().length > 0;
  const [open, setOpen] = useState(false);
  // Bumped to rebuild the editor from `value` after the blocks are copied in —
  // the editor reads its content once, at mount.
  const [version, setVersion] = useState(0);

  /*
   * Link blocks the English has and the Arabic does not.
   *
   * Only while the Arabic has words: a blank Arabic body is not served — /ar
   * falls back to the English one, blocks and all. Counted in the browser
   * only, because it parses HTML with `DOMParser`, and the first render has to
   * match the server's.
   */
  const isClient = useIsClient();
  const missing = useMemo(
    () => (isClient && filled ? countMissingBlocks(englishHtml, value) : 0),
    [isClient, filled, englishHtml, value],
  );

  function copyBlocks() {
    const { html, added } = mirrorBlocks(englishHtml, value);
    if (added === 0) return;
    onChange(html);
    setVersion((v) => v + 1);
    setOpen(true);
    toast.success(
      `Added ${added} link block${added === 1 ? "" : "s"} to the Arabic body. Check where ${added === 1 ? "it" : "they"} landed, then save.`,
    );
  }

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

      {missing > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded border border-[oklch(0.8_0.1_75)] bg-[oklch(0.97_0.03_85)] px-3 py-2 text-[12px] text-bz-ink-2">
          <Signpost size={13} strokeWidth={1.8} className="shrink-0" />
          <span className="min-w-0 flex-1">
            The English links {missing} page{missing === 1 ? "" : "s"} the
            Arabic body does not, so Arabic readers won&apos;t see{" "}
            {missing === 1 ? "that card" : "those cards"}.
          </span>
          <button
            type="button"
            onClick={copyBlocks}
            className="shrink-0 rounded border border-bz-border bg-bz-bg px-2.5 py-1 text-[12px] font-medium text-bz-ink hover:border-bz-ink-2"
          >
            Add {missing === 1 ? "it" : "them"} to the Arabic
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-1.5">
          <ArticleEditor
            key={version}
            defaultValue={value}
            onChange={onChange}
            media={media}
            onMediaUploaded={onMediaUploaded}
            linkTargets={linkTargets}
            dir="rtl"
            lang="ar"
          />
          <span className="text-[10.5px] text-bz-muted-2">
            Blank shows the English. Use Translate to draft this, then correct
            it — the formatting is preserved for you. Link blocks need no
            translating: the card is drawn in Arabic from the record itself.
          </span>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { createContext, useContext } from "react";
import Image from "next/image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import {
  ExternalLink,
  GripVertical,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INTERNAL_LINK_VARIANTS,
  type InternalLinkKind,
  type InternalLinkVariant,
} from "@/lib/internal-links/model";
import type { InternalLinkTarget } from "@/lib/internal-links/types";
import {
  InternalLink,
  type InternalLinkAttributes,
} from "@/lib/tiptap/internal-link";
import { KIND_META } from "./_internal-link-dialog";

/**
 * What a block's view needs from the editor around it.
 *
 * Handed down through context rather than through the extension's options:
 * TipTap renders React node views through portals inside `EditorContent`, so
 * context reaches them, and it stays current — options are read once, when
 * the editor is built, and a closure captured then would go stale.
 */
export type InternalLinkEditorApi = {
  /** The picker's record for a block, or null when it is not published. */
  lookup: (kind: InternalLinkKind, id: string) => InternalLinkTarget | null;
  /** Open the picker on the block at `pos`. */
  edit: (pos: number, attrs: InternalLinkAttributes) => void;
};

export const InternalLinkEditorContext =
  createContext<InternalLinkEditorApi | null>(null);

/**
 * The link block as the editor draws it — the same node and the same stored
 * HTML as `InternalLink`, plus a React view. Kept out of lib/tiptap so the
 * schema stays free of React and of this screen's UI.
 */
export const InternalLinkWithView = InternalLink.extend({
  addNodeView() {
    return ReactNodeViewRenderer(InternalLinkView);
  },
});

const VARIANT_LABEL: Record<InternalLinkVariant, string> = {
  card: "Card",
  compact: "Compact",
};

/**
 * A block, as an editor sees it: which record, how it will draw, and the
 * three things they can do to it — restyle, re-point, remove. Drag the grip
 * to move it.
 *
 * It is not a preview of the public card, on purpose. The card's facts are
 * formatted in the reader's currency and language, and a half-faithful copy
 * here would invite "why does the site say something different". What the
 * editor needs is to recognise the record and to know whether it will show
 * at all — so an unpublished target is called out, loudly, in place.
 */
function InternalLinkView({
  node,
  selected,
  getPos,
  deleteNode,
  updateAttributes,
  editor,
}: ReactNodeViewProps) {
  const api = useContext(InternalLinkEditorContext);
  const attrs = node.attrs as InternalLinkAttributes;
  const target =
    api && attrs.kind && attrs.targetId
      ? api.lookup(attrs.kind, attrs.targetId)
      : null;
  const meta = attrs.kind ? KIND_META[attrs.kind] : null;
  const editable = editor.isEditable;

  const edit = () => {
    const pos = getPos();
    if (typeof pos === "number") api?.edit(pos, attrs);
  };

  return (
    <NodeViewWrapper
      // Admin copy stays English and left-to-right inside the Arabic body.
      dir="ltr"
      lang="en"
      data-internal-link-view={attrs.kind ?? ""}
      className={cn(
        "my-4 rounded-lg border bg-bz-surface transition-shadow",
        target ? "border-bz-border" : "border-[oklch(0.8_0.1_75)]",
        selected && "ring-2 ring-bz-accent ring-offset-1",
      )}
    >
      <div className="flex items-center gap-3 p-2 pe-2.5">
        {editable ? (
          <div
            data-drag-handle
            draggable
            role="button"
            tabIndex={-1}
            aria-label="Drag to move"
            title="Drag to move"
            className="flex h-10 w-5 shrink-0 cursor-grab items-center justify-center rounded text-bz-muted-2 hover:bg-bz-surface-2 hover:text-bz-ink active:cursor-grabbing"
          >
            <GripVertical size={14} strokeWidth={1.8} className="pointer-events-none" />
          </div>
        ) : null}

        <div className="relative size-12 shrink-0 overflow-hidden rounded bg-bz-surface-2">
          {target?.thumb ? (
            <Image
              src={target.thumb}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <span aria-hidden className="bz-img absolute inset-0" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-wider text-bz-muted">
            {meta?.label ?? "Link"} · {VARIANT_LABEL[attrs.variant] ?? "Card"}
          </div>
          <div className="truncate text-[14px] font-medium leading-snug text-bz-ink">
            {target?.name ?? attrs.label ?? "Unknown record"}
          </div>
          {target ? (
            <a
              href={target.href}
              target="_blank"
              rel="noreferrer"
              className="mono inline-flex max-w-full items-center gap-1 truncate text-[11px] text-bz-teal no-underline hover:text-bz-navy"
            >
              <span className="truncate">{target.detail || target.href}</span>
              <ExternalLink size={10} className="pointer-events-none shrink-0" />
            </a>
          ) : (
            <div className="flex items-center gap-1 text-[11.5px] text-[oklch(0.45_0.1_60)]">
              <TriangleAlert size={12} className="shrink-0" />
              <span className="truncate">
                Not live — this {meta?.noun ?? "record"} is unpublished, so the
                block is hidden on the site.
              </span>
            </div>
          )}
        </div>

        {editable ? (
          <div className="flex shrink-0 items-center gap-1">
            <div
              role="group"
              aria-label="Show as"
              className="hidden items-center rounded-md border border-bz-border p-0.5 sm:flex"
            >
              {INTERNAL_LINK_VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={attrs.variant === v}
                  onClick={() => updateAttributes({ variant: v })}
                  className={cn(
                    "h-6 rounded px-2 text-[11px] transition-colors",
                    attrs.variant === v
                      ? "bg-bz-navy text-bz-bg"
                      : "text-bz-muted hover:text-bz-ink",
                  )}
                >
                  {VARIANT_LABEL[v]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={edit}
              aria-label="Change what this links to"
              title="Change what this links to"
              className="flex size-7 items-center justify-center rounded text-bz-ink-2 hover:bg-bz-surface-2"
            >
              <Pencil size={13} strokeWidth={1.8} className="pointer-events-none" />
            </button>
            <button
              type="button"
              onClick={() => deleteNode()}
              aria-label="Remove this block"
              title="Remove this block"
              className="flex size-7 items-center justify-center rounded text-bz-ink-2 hover:bg-bz-surface-2 hover:text-[oklch(0.45_0.13_28)]"
            >
              <Trash2 size={13} strokeWidth={1.8} className="pointer-events-none" />
            </button>
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

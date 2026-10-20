"use client";

import { createContext, useContext } from "react";
import Image from "next/image";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { GripVertical, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_LAYOUTS, type FeatureKind } from "@/lib/content-assets/email-feature";
import { EmailFeature, type EmailFeatureAttributes } from "@/lib/tiptap/email-feature";
import { FEATURE_KIND_META, FEATURE_LAYOUT_META, type FeatureTarget } from "./_feature-types";
import { LayoutSketch } from "./_feature-dialog";

/**
 * What a featured block's view needs from the editor around it — through
 * context, which reaches TipTap's portalled node views and stays current
 * (extension options are read once, when the editor is built).
 */
export type FeatureEditorApi = {
  /** The picker's record, or null when it is not published. */
  lookup: (kind: FeatureKind, id: string) => FeatureTarget | null;
  /** Open the picker on the block at `pos`. */
  edit: (pos: number, attrs: EmailFeatureAttributes) => void;
};

export const FeatureEditorContext = createContext<FeatureEditorApi | null>(null);

/** The stored node plus the editor's view of it. Kept out of lib/tiptap so the schema stays free of React. */
export const EmailFeatureWithView = EmailFeature.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FeatureView, { trackNodeViewPosition: true });
  },
});

/**
 * A featured block as the editor sees it: which records, in what order, how
 * they will draw, and which are no longer live. Not a copy of the email card
 * — that is in the preview beside the editor, in the reader's language.
 */
function FeatureView({ node, selected, getPos, deleteNode, updateAttributes, editor }: ReactNodeViewProps) {
  const api = useContext(FeatureEditorContext);
  const attrs = node.attrs as EmailFeatureAttributes;
  const meta = attrs.kind ? FEATURE_KIND_META[attrs.kind] : null;
  const editable = editor.isEditable;
  const items = (attrs.ids ?? []).map((id, i) => ({
    id,
    target: attrs.kind && api ? api.lookup(attrs.kind, id) : null,
    label: attrs.labels?.[i] ?? "",
  }));
  const missing = items.filter((i) => !i.target).length;

  const edit = () => {
    const pos = getPos();
    if (typeof pos === "number") api?.edit(pos, attrs);
  };

  return (
    <NodeViewWrapper
      // Admin copy stays English and left-to-right inside the Arabic edition.
      dir="ltr"
      lang="en"
      data-email-feature-view={attrs.kind ?? ""}
      className={cn(
        "my-4 rounded-lg border bg-bz-surface transition-shadow",
        missing ? "border-[oklch(0.8_0.1_75)]" : "border-bz-border",
        selected && "ring-2 ring-bz-accent ring-offset-1",
      )}
    >
      <div className="flex items-center gap-2 border-b border-bz-border px-2 py-1.5">
        {editable ? (
          <div
            data-drag-handle
            draggable
            role="button"
            tabIndex={-1}
            aria-label="Drag to move"
            title="Drag to move"
            className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-bz-muted-2 hover:bg-bz-surface-2 hover:text-bz-ink active:cursor-grabbing"
          >
            <GripVertical size={14} strokeWidth={1.8} className="pointer-events-none" />
          </div>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[10.5px] uppercase tracking-wider text-bz-muted">
          {meta?.heading ?? "Featured"} · {items.length}
        </span>
        {editable ? (
          <>
            <div role="group" aria-label="Layout" className="hidden items-center rounded-md border border-bz-border p-0.5 sm:flex">
              {FEATURE_LAYOUTS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={attrs.layout === l}
                  onClick={() => updateAttributes({ layout: l })}
                  className={cn(
                    "h-6 rounded px-2 text-[11px] transition-colors",
                    attrs.layout === l ? "bg-bz-navy text-bz-bg" : "text-bz-muted hover:text-bz-ink",
                  )}
                >
                  {FEATURE_LAYOUT_META[l].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={edit}
              aria-label="Change what this block features"
              title="Change what this block features"
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
          </>
        ) : null}
      </div>

      <div className="flex gap-3 p-2.5">
        <LayoutSketch layout={attrs.layout} />
        <ul className={cn("grid min-w-0 flex-1 gap-1.5", attrs.layout === "grid" ? "grid-cols-2" : "grid-cols-1")}>
          {items.map(({ id, target, label }) => (
            <li key={id} className="flex min-w-0 items-center gap-2">
              <span className="relative size-8 shrink-0 overflow-hidden rounded border border-bz-border bg-bz-surface-2">
                {target?.detail?.thumb ? (
                  <Image src={target.detail.thumb} alt="" fill sizes="32px" className="object-cover" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium leading-tight text-bz-ink">
                  {target?.name ?? (label || "Unknown record")}
                </span>
                {target ? (
                  <span className="block truncate text-[11px] text-bz-muted">
                    {[target.detail?.code, target.detail?.price ?? target.detail?.sub].filter(Boolean).join(" · ")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-[oklch(0.45_0.1_60)]">
                    <TriangleAlert size={11} className="shrink-0" />
                    Not live — left out of the email
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </NodeViewWrapper>
  );
}

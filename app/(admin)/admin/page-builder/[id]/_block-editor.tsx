"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SectionValues } from "@/lib/master-pages";
import {
  getBlockDef,
  mintBlockId,
  newBlockInstance,
} from "@/lib/page-builder/catalogue";
import type { BlockDef, BlockInstance } from "@/lib/page-builder/types";
import { FieldEditor } from "../../_fields/field-editor";
import type { MediaOption, Seeds } from "../../_fields/types";
import { discardLandingDraft, saveLandingBlocks } from "../_actions";
import { AddBlock } from "./_add-block";

/**
 * The section list.
 *
 * Written fresh rather than reusing `MasterPageEditor`, because four things
 * differ structurally: blocks are added and removed (a master page's section
 * list is fixed), instances are keyed by id rather than by section key so a
 * page can hold three FAQs, reordering is arrow buttons, and there is a
 * catalogue picker. The *field* editing is `FieldEditor` verbatim, which is the
 * expensive half.
 *
 * Arrows rather than drag-and-drop is deliberate: dnd-kit is the one part of
 * the master-page editor that does not work on touch, and this screen is meant
 * to be usable from a phone.
 */
export function BlockEditor({
  pageId,
  initial,
  media: initialMedia,
  seeds,
  hasDraft,
  isPublished,
}: {
  pageId: string;
  initial: BlockInstance[];
  media: MediaOption[];
  seeds: Seeds;
  hasDraft: boolean;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [blocks, setBlocks] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function update(next: BlockInstance[]) {
    setBlocks(next);
    setDirty(true);
  }

  function patch(id: string, next: Partial<BlockInstance>) {
    update(blocks.map((b) => (b.id === id ? { ...b, ...next } : b)));
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= blocks.length) return;
    const next = blocks.slice();
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    update(next);
  }

  function add(def: BlockDef) {
    const instance = newBlockInstance(def);
    update([...blocks, instance]);
    setOpen(instance.id);
  }

  function duplicate(block: BlockInstance) {
    const copy: BlockInstance = {
      ...block,
      id: mintBlockId(),
      values: structuredClone(block.values),
    };
    const index = blocks.findIndex((b) => b.id === block.id);
    const next = blocks.slice();
    next.splice(index + 1, 0, copy);
    update(next);
    setOpen(copy.id);
  }

  function remove(block: BlockInstance) {
    const def = getBlockDef(block.type);
    if (!confirm(`Remove the ${def?.label ?? block.type} section?`)) return;
    update(blocks.filter((b) => b.id !== block.id));
  }

  function onSave() {
    setIssues([]);
    startTransition(async () => {
      const result = await saveLandingBlocks(pageId, blocks);
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else if (result.status === "invalid") {
        setIssues(result.issues);
        toast.error(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  function onDiscard() {
    if (
      !confirm(
        "Throw away every unpublished change and go back to what is live right now?",
      )
    )
      return;
    startTransition(async () => {
      const result = await discardLandingDraft(pageId);
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  const hiddenCount = blocks.filter((b) => !b.enabled).length;
  const usedTypes = blocks.map((b) => b.type);

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-[13.5px] font-medium">Sections</h2>
          <p className="text-[11.5px] text-bz-muted">
            {blocks.length} section{blocks.length === 1 ? "" : "s"}
            {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
            {dirty ? " · unsaved changes" : ""}
          </p>
        </div>
        {hasDraft && !dirty ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={pending}
          >
            <Undo2 size={13} strokeWidth={1.8} /> Discard changes
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={onSave} disabled={pending || !dirty}>
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save draft"}
        </Button>
      </div>

      {isPublished ? (
        <p className="rounded bg-bz-surface-2 px-3 py-2 text-[11.5px] text-bz-muted">
          This page is live. Saving here changes the draft only — visitors keep
          seeing the published version until you press Publish below.
        </p>
      ) : null}

      {issues.length > 0 ? (
        <ul className="rounded border border-[oklch(0.85_0.09_28)] bg-[oklch(0.97_0.02_28)] px-3 py-2.5 flex flex-col gap-1">
          {issues.map((issue) => (
            <li
              key={issue}
              className="text-[11.5px] text-[oklch(0.42_0.13_28)] flex items-start gap-1.5"
            >
              <AlertTriangle size={12} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              {issue}
            </li>
          ))}
        </ul>
      ) : null}

      {blocks.length === 0 ? (
        <p className="text-[12.5px] text-bz-muted">
          Nothing here yet. Add a section to start the page.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              block={block}
              index={index}
              total={blocks.length}
              expanded={open === block.id}
              media={media}
              seeds={seeds}
              onToggleExpand={() => setOpen(open === block.id ? null : block.id)}
              onToggleEnabled={() => patch(block.id, { enabled: !block.enabled })}
              onValues={(values) => patch(block.id, { values })}
              onMove={(delta) => move(index, delta)}
              onDuplicate={() => duplicate(block)}
              onRemove={() => remove(block)}
              onMediaAdded={(m) => setMedia((cur) => [m, ...cur])}
            />
          ))}
        </ul>
      )}

      <AddBlock usedTypes={usedTypes} onAdd={add} />
    </section>
  );
}

function BlockRow({
  block,
  index,
  total,
  expanded,
  media,
  seeds,
  onToggleExpand,
  onToggleEnabled,
  onValues,
  onMove,
  onDuplicate,
  onRemove,
  onMediaAdded,
}: {
  block: BlockInstance;
  index: number;
  total: number;
  expanded: boolean;
  media: MediaOption[];
  seeds: Seeds;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onValues: (v: SectionValues) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMediaAdded: (m: MediaOption) => void;
}) {
  const def = getBlockDef(block.type);

  // A block this build doesn't recognise. It is kept, not dropped — its copy
  // exists nowhere else — but there is no field editor to render for it, so the
  // row says so and offers only reorder, hide and remove.
  if (!def) {
    return (
      <li className="rounded-lg border border-dashed border-bz-border bg-bz-surface-2 px-3 py-2.5 flex items-center gap-2">
        <span className="mono text-[10.5px] text-bz-muted-2 w-5">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium">Unavailable section</span>
          <span className="block text-[11.5px] text-bz-muted truncate">
            <span className="mono">{block.type}</span> isn&apos;t part of this
            version of the site. Its content is kept and will render again if the
            section returns.
          </span>
        </div>
        <MoveButtons index={index} total={total} label="section" onMove={onMove} />
        <IconButton label="Remove section" onClick={onRemove} danger>
          <Trash2 size={13} strokeWidth={1.7} />
        </IconButton>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "border border-bz-border rounded-lg bg-bz-surface",
        !block.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <span className="mono text-[10.5px] text-bz-muted-2 w-5">{index + 1}</span>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 min-w-0 text-left"
        >
          <span className="text-[13.5px] font-medium">{def.label}</span>
          <span className="block text-[11.5px] text-bz-muted truncate">
            {summarise(block.values) ?? def.description}
          </span>
        </button>

        <MoveButtons index={index} total={total} label={def.label} onMove={onMove} />

        <IconButton
          label={block.enabled ? `Hide ${def.label}` : `Show ${def.label}`}
          onClick={onToggleEnabled}
        >
          {block.enabled ? (
            <Eye size={13} strokeWidth={1.7} />
          ) : (
            <EyeOff size={13} strokeWidth={1.7} />
          )}
        </IconButton>

        <IconButton label={`Duplicate ${def.label}`} onClick={onDuplicate}>
          <Copy size={13} strokeWidth={1.7} />
        </IconButton>

        <IconButton label={`Remove ${def.label}`} onClick={onRemove} danger>
          <Trash2 size={13} strokeWidth={1.7} />
        </IconButton>

        <IconButton
          label={expanded ? "Collapse" : "Expand"}
          onClick={onToggleExpand}
        >
          <ChevronDown
            size={14}
            strokeWidth={1.7}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </IconButton>
      </div>

      {expanded ? (
        <div className="border-t border-bz-border px-3 py-3 flex flex-col gap-3">
          {def.dataNote ? (
            <p className="text-[11.5px] text-bz-muted bg-bz-surface-2 rounded px-2.5 py-2">
              {def.dataNote}
            </p>
          ) : null}
          {def.fields.map((field) => (
            <FieldEditor
              key={field.key}
              field={field}
              value={block.values[field.key]}
              media={media}
              onMediaAdded={onMediaAdded}
              seeds={seeds}
              onChange={(v) => onValues({ ...block.values, [field.key]: v })}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

function MoveButtons({
  index,
  total,
  label,
  onMove,
}: {
  index: number;
  total: number;
  label: string;
  onMove: (delta: number) => void;
}) {
  return (
    <>
      <IconButton
        label={`Move ${label} up`}
        onClick={() => onMove(-1)}
        disabled={index === 0}
      >
        <ChevronUp size={13} strokeWidth={1.7} />
      </IconButton>
      <IconButton
        label={`Move ${label} down`}
        onClick={() => onMove(1)}
        disabled={index === total - 1}
      >
        <ChevronDown size={13} strokeWidth={1.7} />
      </IconButton>
    </>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      // 44px on touch, tighter on a pointer — the row holds seven of these and
      // a phone still has to be able to hit the right one.
      className={cn(
        "h-11 w-11 md:h-7 md:w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink disabled:opacity-30 disabled:hover:text-bz-muted",
        danger && "hover:text-[oklch(0.45_0.13_28)]",
      )}
    >
      {children}
    </button>
  );
}

/** First bit of real copy in the block, so a collapsed row is identifiable. */
function summarise(values: SectionValues): string | null {
  for (const key of ["title", "heading", "caption", "body"]) {
    const v = values[key];
    if (typeof v === "string" && v.trim() !== "") {
      return v.trim().replace(/\s+/g, " ").slice(0, 80);
    }
  }
  return null;
}

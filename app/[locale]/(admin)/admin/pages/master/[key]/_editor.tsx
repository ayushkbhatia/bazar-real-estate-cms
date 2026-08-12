"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { arKey } from "@/lib/master-pages";
import type {
  MasterPageKey,
  SectionDef,
  SectionValues,
  StoredSection,
} from "@/lib/master-pages";
import { FieldEditor } from "../../../_fields/field-editor";
import type { MediaOption, Seeds } from "../../../_fields/types";
import { saveMasterPage, resetMasterPage } from "./_actions";

/**
 * Save/reset are injected so the same editor drives master pages and
 * record-backed sub-pages (development project pages) without a second copy.
 */
export type SectionSaveResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

export type SectionActions = {
  save: (id: string, sections: StoredSection[]) => Promise<SectionSaveResult>;
  reset: (id: string) => Promise<SectionSaveResult>;
};

const MASTER_ACTIONS: SectionActions = {
  save: (id, sections) =>
    saveMasterPage(id as MasterPageKey, sections) as Promise<SectionSaveResult>,
  reset: (id) => resetMasterPage(id as MasterPageKey) as Promise<SectionSaveResult>,
};

export type EditorSection = {
  key: string;
  def: SectionDef;
  enabled: boolean;
  values: SectionValues;
};

export function MasterPageEditor({
  pageKey,
  pageLabel,
  path,
  initial,
  media: initialMedia,
  seeds,
  usingDefaults,
  actions = MASTER_ACTIONS,
  allowReorder = true,
  resetLabel = "Reset to defaults",
}: {
  /** Master page key, or the record slug for a sub-page. */
  pageKey: string;
  pageLabel: string;
  path: string;
  initial: EditorSection[];
  media: MediaOption[];
  seeds: Seeds;
  usingDefaults: boolean;
  actions?: SectionActions;
  /**
   * Sub-pages keep the template's order — their anchor sub-nav points at
   * section ids in document order.
   */
  allowReorder?: boolean;
  resetLabel?: string;
}) {
  // Uploads from an image field append here, so a freshly uploaded asset is
  // pickable straight away without a page refresh.
  const [media, setMedia] = useState(initialMedia);
  const router = useRouter();
  const [sections, setSections] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function update(next: EditorSection[]) {
    setSections(next);
    setDirty(true);
  }

  function setSection(key: string, patch: Partial<EditorSection>) {
    update(sections.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.key === active.id);
    const to = sections.findIndex((s) => s.key === over.id);
    if (from < 0 || to < 0) return;
    update(arrayMove(sections, from, to));
  }

  function onSave() {
    startTransition(async () => {
      const payload: StoredSection[] = sections.map((s) => ({
        key: s.key,
        enabled: s.enabled,
        values: s.values,
      }));
      const result = await actions.save(pageKey, payload);
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else if (result.status === "invalid") {
        toast.error(result.message, {
          description: result.issues.slice(0, 4).join("\n"),
        });
      } else {
        toast.error(result.message);
      }
    });
  }

  function onReset() {
    if (
      !confirm(
        `Reset ${pageLabel} to the copy shipped in code? Every edit on this page is discarded.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await actions.reset(pageKey);
      if (result.status === "ok") {
        toast.success("Reset to defaults.");
        setDirty(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  const hiddenCount = sections.filter((s) => !s.enabled).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[12.5px] text-bz-muted me-auto">
          {sections.length} sections
          {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
          {usingDefaults ? " · never edited — showing the copy from code" : ""}
          {dirty ? " · unsaved changes" : ""}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={pending}>
          <RotateCcw size={13} strokeWidth={1.8} />
          {resetLabel}
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={pending || !dirty}>
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.key)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-2">
            {sections.map((section, index) => (
              <SectionRow
                key={section.key}
                section={section}
                index={index}
                expanded={open === section.key}
                onToggleExpand={() =>
                  setOpen(open === section.key ? null : section.key)
                }
                onToggleEnabled={() =>
                  setSection(section.key, { enabled: !section.enabled })
                }
                allowReorder={allowReorder}
                onValues={(values) => setSection(section.key, { values })}
                media={media}
                onMediaAdded={(m) => setMedia((cur) => [m, ...cur])}
                seeds={seeds}
                path={path}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SectionRow({
  section,
  index,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onValues,
  media,
  onMediaAdded,
  seeds,
  path,
  allowReorder,
}: {
  section: EditorSection;
  index: number;
  allowReorder: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onValues: (v: SectionValues) => void;
  media: MediaOption[];
  onMediaAdded: (m: MediaOption) => void;
  seeds: Seeds;
  path: string;
}) {
  const locked = section.def.locked === true || !allowReorder;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.key, disabled: locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "border border-bz-border rounded-lg bg-bz-surface",
        !section.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {locked ? (
          <span
            className="h-7 w-7 inline-flex items-center justify-center text-bz-muted-2"
            title={
              allowReorder
                ? "This section is fixed in place"
                : "Section order is fixed by the page template"
            }
          >
            <Lock size={13} strokeWidth={1.7} />
          </span>
        ) : (
          <button
            type="button"
            className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink cursor-grab active:cursor-grabbing"
            aria-label={`Reorder ${section.def.label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} strokeWidth={1.7} />
          </button>
        )}

        <span className="mono text-[10.5px] text-bz-muted-2 w-5">
          {index + 1}
        </span>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 min-w-0 text-start"
        >
          <span className="text-[13.5px] font-medium">{section.def.label}</span>
          <span className="block text-[11.5px] text-bz-muted truncate">
            {section.def.description}
          </span>
        </button>

        {section.def.fields.length === 0 ? (
          <span className="text-[11px] text-bz-muted-2">No editable copy</span>
        ) : null}

        <button
          type="button"
          onClick={onToggleEnabled}
          disabled={section.def.locked === true}
          aria-label={section.enabled ? "Hide section" : "Show section"}
          title={
            section.def.locked === true
              ? "This section can't be hidden"
              : section.enabled
                ? "Hide this section on the live page"
                : "Show this section on the live page"
          }
          className={cn(
            "h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink",
            section.def.locked === true && "opacity-40 cursor-not-allowed",
          )}
        >
          {section.enabled ? (
            <Eye size={13} strokeWidth={1.7} />
          ) : (
            <EyeOff size={13} strokeWidth={1.7} />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink"
        >
          <ChevronDown
            size={14}
            strokeWidth={1.7}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-bz-border px-3 py-3 flex flex-col gap-3">
          {section.def.dataNote ? (
            <p className="text-[11.5px] text-bz-muted bg-bz-surface-2 rounded px-2.5 py-2">
              {section.def.dataNote}
            </p>
          ) : null}
          {section.def.fields.length === 0 ? (
            <p className="text-[12.5px] text-bz-muted">
              Nothing to edit here — this section renders live data. You can
              still reorder it or hide it from{" "}
              <span className="mono text-bz-ink-2">{path}</span>.
            </p>
          ) : (
            section.def.fields.map((field) => (
              <FieldEditor
                key={field.key}
                field={field}
                value={section.values[field.key]}
                media={media}
                onMediaAdded={onMediaAdded}
                seeds={seeds}
                onChange={(v) =>
                  onValues({ ...section.values, [field.key]: v })
                }
                arValue={
                  typeof section.values[arKey(field.key)] === "string"
                    ? (section.values[arKey(field.key)] as string)
                    : ""
                }
                onArChange={(v) =>
                  onValues({ ...section.values, [arKey(field.key)]: v })
                }
              />
            ))
          )}
        </div>
      ) : null}
    </li>
  );
}

export function useMasterSections(initial: EditorSection[]) {
  return useMemo(() => initial, [initial]);
}

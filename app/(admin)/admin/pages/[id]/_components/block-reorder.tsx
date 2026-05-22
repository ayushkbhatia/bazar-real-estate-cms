"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

type Block = {
  id: string;
  kind: string;
  label: string;
};

/**
 * Sprint 7g (backfilled): dnd-kit drag-handle reorder for the pages
 * block list. Replaces the existing ▲▼ arrow buttons. Parent passes
 * blocks + onReorder.
 */
export function BlockReorderList({
  blocks,
  onReorder,
  onRemove,
}: {
  blocks: Block[];
  onReorder: (next: Block[]) => void;
  onRemove?: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(blocks, oldIdx, newIdx));
  }

  return (
    <div>
      <Eyebrow>Blocks · {blocks.length}</Eyebrow>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="mt-2 flex flex-col gap-1.5">
            {blocks.map((b) => (
              <SortableRow key={b.id} block={b} onRemove={onRemove} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({
  block,
  onRemove,
}: {
  block: Block;
  onRemove?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-bz-border bg-bz-bg px-3 py-2 flex items-center gap-2 text-[13px]"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag handle"
        className="text-bz-muted hover:text-bz-ink cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={13} strokeWidth={1.7} />
      </button>
      <span className="text-[10.5px] uppercase tracking-wider text-bz-accent">
        {block.kind}
      </span>
      <span className="flex-1 truncate text-bz-ink">{block.label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          aria-label="Remove block"
          className="text-bz-muted hover:text-bz-danger"
        >
          <Trash2 size={12} strokeWidth={1.7} />
        </button>
      ) : null}
    </li>
  );
}

"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { setEnquiryStatus } from "./_actions";
import type { EnquiryListRow } from "@/lib/queries/enquiries";
import type { Database } from "@/db/types";

type EnquiryStatus = Database["public"]["Enums"]["enquiry_status"];

export const KANBAN_COLUMNS: Array<{
  status: EnquiryStatus;
  label: string;
  accent: string;
}> = [
  { status: "new", label: "New", accent: "oklch(0.55 0.13 240)" },
  { status: "qualified", label: "Qualified", accent: "var(--bz-accent)" },
  {
    status: "viewing_scheduled",
    label: "Viewing",
    accent: "oklch(0.5 0.1 60)",
  },
  { status: "offer", label: "Offer", accent: "var(--bz-ink)" },
  { status: "closed_won", label: "Won", accent: "oklch(0.45 0.12 145)" },
  { status: "closed_lost", label: "Lost", accent: "oklch(0.55 0.14 28)" },
];

export function KanbanBoard({ rows }: { rows: EnquiryListRow[] }) {
  const [items, setItems] = useState<EnquiryListRow[]>(rows);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const dndId = useId();

  const columns = useMemo(() => {
    const map = new Map<EnquiryStatus, EnquiryListRow[]>();
    for (const col of KANBAN_COLUMNS) map.set(col.status, []);
    for (const row of items) {
      map.get(row.status)?.push(row);
    }
    return map;
  }, [items]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const enquiryId = String(active.id);
    const destStatus = (
      typeof over.data.current?.status === "string"
        ? over.data.current.status
        : over.id
    ) as EnquiryStatus;
    if (!destStatus) return;

    const row = items.find((r) => r.id === enquiryId);
    if (!row || row.status === destStatus) return;

    // Optimistic update.
    const previous = items;
    setItems((prev) =>
      prev.map((r) => (r.id === enquiryId ? { ...r, status: destStatus } : r)),
    );

    startTransition(async () => {
      const result = await setEnquiryStatus(enquiryId, destStatus);
      if (result.status !== "ok") {
        setItems(previous);
        toast.error(result.message);
      } else {
        toast.success(`Moved to ${labelFor(destStatus)}`);
      }
    });
  }

  const activeRow = activeId
    ? items.find((r) => r.id === activeId) ?? null
    : null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "grid gap-3 overflow-x-auto pb-2",
          "grid-cols-[repeat(6,minmax(260px,1fr))]",
          pending && "opacity-95 pointer-events-none",
        )}
        aria-busy={pending}
      >
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            label={col.label}
            accent={col.accent}
            rows={columns.get(col.status) ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeRow ? (
          <div className="w-[260px]">
            <KanbanCardPresentation row={activeRow} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  label,
  accent,
  rows,
}: {
  status: EnquiryStatus;
  label: string;
  accent: string;
  rows: EnquiryListRow[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
    data: { status },
  });
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: accent }}
          />
          <span className="text-[11.5px] font-medium tracking-wider uppercase text-bz-ink-2">
            {label}
          </span>
        </div>
        <span className="text-[11.5px] text-bz-muted mono">{rows.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 flex flex-col gap-2 p-2 rounded-lg border bg-bz-surface min-h-[160px] transition-colors",
          isOver ? "border-bz-ink bg-bz-surface-2" : "border-bz-border",
        )}
      >
        {rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[11.5px] text-bz-muted-2">
            Drop here
          </div>
        ) : (
          rows.map((row) => <KanbanCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function KanbanCard({ row }: { row: EnquiryListRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: row.id });
  const style: React.CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.3 : 1,
      }
    : isDragging
      ? { opacity: 0.3 }
      : undefined;
  return (
    <div ref={setNodeRef} style={style}>
      <KanbanCardPresentation
        row={row}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

type CardPresentationProps = {
  row: EnquiryListRow;
  isOverlay?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
};

function KanbanCardPresentation({
  row,
  isOverlay,
  dragHandleProps,
}: CardPresentationProps) {
  return (
    <article
      className={cn(
        "bg-bz-bg border border-bz-border rounded p-3 flex flex-col gap-1.5",
        isOverlay && "shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/admin/enquiries/${row.id}`}
          className="text-[12.5px] font-medium hover:text-bz-accent truncate flex-1 min-w-0"
        >
          {row.name}
        </Link>
        <button
          type="button"
          className="text-bz-muted hover:text-bz-ink cursor-grab active:cursor-grabbing shrink-0 -mt-0.5"
          aria-label="Drag to reorder"
          {...dragHandleProps}
        >
          <GripVertical size={12} strokeWidth={1.7} />
        </button>
      </div>
      <p className="text-[11.5px] text-bz-muted line-clamp-2 leading-snug">
        {row.brief_raw}
      </p>
      <div className="flex flex-wrap gap-2 text-[10.5px] text-bz-muted mt-1">
        <span className="capitalize">via {row.source.replace(/_/g, " ")}</span>
        {row.properties ? (
          <span className="mono">{row.properties.reference}</span>
        ) : null}
        {row.developments ? <span>{row.developments.name}</span> : null}
        {row.unread_count > 0 ? (
          <span className="inline-flex items-center h-[16px] px-1.5 rounded-full bg-bz-ink text-bz-bg text-[9.5px] font-semibold">
            {row.unread_count}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function labelFor(status: EnquiryStatus): string {
  return (
    KANBAN_COLUMNS.find((c) => c.status === status)?.label ?? status
  );
}

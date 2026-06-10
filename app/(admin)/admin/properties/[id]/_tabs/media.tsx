"use client";

import { useState } from "react";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

type MediaItem = {
  id: string;
  storage_key: string;
  alt_text: string | null;
  role: "hero" | "gallery" | "floor_plan" | "brochure" | "video" | "virtual_tour";
  sort_order: number;
};

/**
 * Sprint 7c (backfilled): Media tab on the property editor. Dnd-kit
 * sortable grid + alt-text edit + set-hero + delete. Controlled —
 * parent passes items + change handler; server action wires Sprint 9.
 */
export function PropertyMediaTab({
  initial,
}: {
  initial: MediaItem[];
}) {
  const [items, setItems] = useState(initial);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      sort_order: idx,
    }));
    setItems(next);
    toast.info("Order updated. Sprint 9 persists this to property_media.");
  }

  function setHero(id: string) {
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, role: "hero" }
          : p.role === "hero"
            ? { ...p, role: "gallery" }
            : p,
      ),
    );
    toast.success("Hero updated.");
  }

  function remove(id: string) {
    if (!confirm("Remove this image from the listing?")) return;
    setItems((prev) => prev.filter((p) => p.id !== id));
    toast.success("Removed.");
  }

  function setAlt(id: string, alt: string) {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, alt_text: alt } : p)),
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-bz-border bg-bz-surface py-16 text-center">
        <Eyebrow className="text-bz-muted">Media</Eyebrow>
        <p className="mt-3 text-[13.5px] text-bz-ink-2">
          No images uploaded yet. Drop files into the media library to
          attach them to this listing.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <Eyebrow>Media · {items.length} files</Eyebrow>
        <p className="text-[11.5px] text-bz-muted">
          Drag to reorder · star to set hero · trash to remove
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <SortableMediaTile
                key={item.id}
                item={item}
                onSetHero={() => setHero(item.id)}
                onRemove={() => remove(item.id)}
                onSetAlt={(v) => setAlt(item.id, v)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableMediaTile({
  item,
  onSetHero,
  onRemove,
  onSetAlt,
}: {
  item: MediaItem;
  onSetHero: () => void;
  onRemove: () => void;
  onSetAlt: (v: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-bz-border bg-bz-surface p-2 flex flex-col gap-2"
    >
      <div className="relative aspect-[4/3] rounded overflow-hidden">
        {item.storage_key ? (
          <Image
            src={mediaPublicUrl(item.storage_key)}
            alt={item.alt_text ?? "Listing photo"}
            fill
            sizes="200px"
            className="object-cover"
          />
        ) : (
          <PlaceholderImage
            label={item.id.slice(0, 8)}
            className="w-full h-full"
          />
        )}
        {item.role === "hero" ? (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 h-5 px-1.5 rounded bg-bz-ink text-bz-bg text-[9.5px] uppercase tracking-wider">
            <Star size={9} strokeWidth={2} fill="currentColor" />
            Hero
          </span>
        ) : null}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag handle"
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded bg-white/90 text-bz-ink flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={11} strokeWidth={1.7} />
        </button>
      </div>
      <Input
        value={item.alt_text ?? ""}
        onChange={(e) => onSetAlt(e.target.value)}
        placeholder="Alt text"
        className="h-8 text-[12px]"
      />
      <div className="flex items-center justify-between gap-1">
        {item.role !== "hero" ? (
          <button
            type="button"
            onClick={onSetHero}
            className="inline-flex items-center gap-1 text-[11.5px] text-bz-ink-2 hover:text-bz-accent"
          >
            <Star size={11} strokeWidth={1.7} />
            Set hero
          </button>
        ) : (
          <span className="text-[11.5px] text-bz-muted">Hero image</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove image"
          className="text-bz-muted hover:text-bz-danger"
        >
          <Trash2 size={12} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { GripVertical, Star, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mediaPublicUrl } from "@/lib/media";
import {
  uploadPropertyPhoto,
  setPropertyHero,
  detachPropertyPhoto,
  reorderPropertyMedia,
  setPropertyMediaAlt,
} from "./_actions";

export type PropertyMediaItem = {
  /** media_assets.id (the media id used by every action). */
  id: string;
  storage_key: string;
  alt_text: string | null;
  role: "hero" | "gallery" | "floor_plan" | "brochure" | "video" | "virtual_tour";
  sort_order: number;
};

type Props = {
  propertyId: string;
  initial: PropertyMediaItem[];
};

/**
 * Media library for a single property. Shows EVERY attached photo (not just the
 * hero), with drag-to-reorder, set-hero, remove, and alt-text — all persisted.
 * Uploading drops files into the shared media library and attaches them here.
 *
 * Mutations that change the hero or the photo count call router.refresh() so
 * the sibling PublishCard's "hero image" pre-flight check re-reads from the
 * server (the gate lives on server-rendered props).
 */
export function PropertyMediaLibrary({ propertyId, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PropertyMediaItem[]>(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dndId = useId();

  // Reconcile with the server list after router.refresh() (new uploads, hero
  // moves, removals) without an effect. The server hands down a fresh `initial`
  // reference only when it re-renders; local-only re-renders keep the same ref,
  // so optimistic edits survive between refreshes.
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setItems(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploading(true);
    let added = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadMsg(`Uploading ${i + 1} of ${files.length}…`);
        const fd = new FormData();
        fd.set("file", files[i]);
        const res = await uploadPropertyPhoto(propertyId, fd);
        if (res.status === "ok") added++;
        else toast.error(res.message);
      }
      if (added > 0) {
        toast.success(
          `${added} photo${added === 1 ? "" : "s"} added to this property and the media library.`,
        );
        router.refresh();
      }
    } finally {
      setUploading(false);
      setUploadMsg(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
    startTransition(async () => {
      const res = await reorderPropertyMedia(
        propertyId,
        next.map((i) => i.id),
      );
      if (res.status === "error") {
        toast.error(res.message);
        setItems(items); // rollback
      }
    });
  }

  function setHero(id: string) {
    const prev = items;
    setItems((cur) =>
      cur.map((p) =>
        p.id === id
          ? { ...p, role: "hero" }
          : p.role === "hero"
            ? { ...p, role: "gallery" }
            : p,
      ),
    );
    startTransition(async () => {
      const res = await setPropertyHero(propertyId, id);
      if (res.status === "ok") {
        toast.success("Hero updated.");
        router.refresh();
      } else {
        toast.error(res.message);
        setItems(prev); // rollback
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this photo from the listing?")) return;
    const prev = items;
    setItems((cur) => cur.filter((p) => p.id !== id));
    startTransition(async () => {
      const res = await detachPropertyPhoto(propertyId, id);
      if (res.status === "ok") {
        toast.success("Photo removed.");
        router.refresh();
      } else {
        toast.error(res.message);
        setItems(prev); // rollback
      }
    });
  }

  function setAltLocal(id: string, alt: string) {
    setItems((cur) =>
      cur.map((p) => (p.id === id ? { ...p, alt_text: alt } : p)),
    );
  }

  function persistAlt(id: string, alt: string) {
    void (async () => {
      const res = await setPropertyMediaAlt(id, alt);
      if (res.status === "error") toast.error(res.message);
    })();
  }

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-medium">
          Media{items.length > 0 ? ` · ${items.length}` : ""}
        </h3>
        <p className="text-[11.5px] text-bz-muted">
          Drag to reorder · star to set hero · trash to remove
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!uploading) void handleFiles(e.dataTransfer.files);
        }}
        className="rounded-lg border border-dashed border-bz-border bg-bz-bg px-4 py-5 flex flex-col items-center gap-2 text-center"
      >
        <UploadCloud size={20} className="text-bz-muted" strokeWidth={1.6} />
        <div className="text-[13px] text-bz-ink">Drag photos here, or</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? uploadMsg ?? "Uploading…" : "Upload photos"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <p className="text-[11px] text-bz-muted">
          JPG, PNG, WebP, AVIF or GIF · up to 10 MB each. Added to the{" "}
          <Link href="/admin/media" className="underline hover:text-bz-ink">
            media library
          </Link>{" "}
          too. The first photo becomes the hero when none is set.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bz-border bg-bz-surface py-10 text-center">
          <Eyebrow className="text-bz-muted">No photos yet</Eyebrow>
          <p className="mt-2 text-[13px] text-bz-muted">
            Upload photos above to build this listing&apos;s gallery.
          </p>
        </div>
      ) : (
        <DndContext
          id={dndId}
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
                  disabled={pending}
                  onSetHero={() => setHero(item.id)}
                  onRemove={() => remove(item.id)}
                  onAltChange={(v) => setAltLocal(item.id, v)}
                  onAltCommit={(v) => persistAlt(item.id, v)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableMediaTile({
  item,
  disabled,
  onSetHero,
  onRemove,
  onAltChange,
  onAltCommit,
}: {
  item: PropertyMediaItem;
  disabled: boolean;
  onSetHero: () => void;
  onRemove: () => void;
  onAltChange: (v: string) => void;
  onAltCommit: (v: string) => void;
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
        onChange={(e) => onAltChange(e.target.value)}
        onBlur={(e) => onAltCommit(e.target.value)}
        placeholder="Alt text"
        className="h-8 text-[12px]"
      />
      <div className="flex items-center justify-between gap-1">
        {item.role !== "hero" ? (
          <button
            type="button"
            onClick={onSetHero}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-[11.5px] text-bz-ink-2 hover:text-bz-accent disabled:opacity-50"
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
          disabled={disabled}
          aria-label="Remove photo"
          className="text-bz-muted hover:text-bz-danger disabled:opacity-50"
        >
          <Trash2 size={12} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}

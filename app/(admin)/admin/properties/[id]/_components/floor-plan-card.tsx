"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mediaPublicUrl } from "@/lib/media";
import { uploadToLibrary } from "../../../media/_upload-client";
import {
  clearPropertyFloorPlan,
  setPropertyFloorPlan,
  setPropertyMediaAlt,
} from "../_actions";

export type FloorPlanItem = {
  /** media_assets.id */
  id: string;
  storage_key: string;
  alt_text: string | null;
};

/**
 * The listing's floor plan, uploaded from the Details tab.
 *
 * Saves on its own rather than through the form submit — same shape as the
 * LocationPicker and the media library, both of which persist immediately. The
 * plan is `property_media.role = 'floor_plan'`, which the public "Unit layout"
 * section and the gallery's Floor plan tab already read; before this card there
 * was no way to write that role, so every listing fell back to the "ask your
 * advisor" empty state.
 *
 * One plan per listing: uploading again replaces the previous one.
 */
export function FloorPlanCard({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: FloorPlanItem | null;
}) {
  const router = useRouter();
  const [item, setItem] = useState<FloorPlanItem | null>(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reconcile with the server after router.refresh() without an effect — the
  // same trick the media library uses, so a local edit isn't clobbered by a
  // re-render that carries the same `initial` reference.
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setItem(initial);
  }

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadToLibrary(file, { folder: "listings" });
      if (uploaded.status === "error") {
        toast.error(uploaded.message);
        return;
      }
      const res = await setPropertyFloorPlan(propertyId, uploaded.id);
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      setItem(res.media);
      toast.success(res.message);
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function remove() {
    if (!confirm("Remove the floor plan from this listing?")) return;
    const prev = item;
    setItem(null);
    startTransition(async () => {
      const res = await clearPropertyFloorPlan(propertyId);
      if (res.status === "ok") {
        toast.success(res.message ?? "Floor plan removed.");
        router.refresh();
      } else {
        toast.error(res.message);
        setItem(prev); // rollback
      }
    });
  }

  function persistAlt(alt: string) {
    if (!item) return;
    void (async () => {
      const res = await setPropertyMediaAlt(item.id, alt);
      if (res.status === "error") toast.error(res.message);
    })();
  }

  return (
    <div className="rounded-lg border border-bz-border bg-bz-bg p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-medium">Floor plan</h3>
          <p className="mt-1 text-[11.5px] text-bz-muted">
            Shown on the listing page as “Unit layout”, and in the gallery’s
            Floor plan tab. One per listing.
          </p>
        </div>
        {item ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending || uploading}
            className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-danger disabled:opacity-50"
          >
            <Trash2 size={12} strokeWidth={1.7} />
            Remove
          </button>
        ) : null}
      </div>

      {item ? (
        <div className="flex flex-col gap-3">
          <div className="relative aspect-[16/10] max-w-[480px] rounded-md overflow-hidden border border-bz-border bg-bz-surface">
            <Image
              src={mediaPublicUrl(item.storage_key)}
              alt={item.alt_text ?? "Floor plan"}
              fill
              sizes="480px"
              className="object-contain p-3"
            />
          </div>
          <div className="flex flex-col gap-1.5 max-w-[480px]">
            <Label htmlFor="floor_plan_alt">Alt text</Label>
            <Input
              id="floor_plan_alt"
              defaultValue={item.alt_text ?? ""}
              onBlur={(e) => persistAlt(e.target.value)}
              placeholder="Floor plan — 2 bed, 1,240 ft²"
              className="h-9 text-[13px]"
            />
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || pending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Replace floor plan"}
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading) void handleFiles(e.dataTransfer.files);
          }}
          className="rounded-lg border border-dashed border-bz-border bg-bz-surface px-4 py-6 flex flex-col items-center gap-2 text-center"
        >
          <LayoutGrid size={20} className="text-bz-muted" strokeWidth={1.6} />
          <div className="text-[13px] text-bz-ink">
            No floor plan yet. Drag one here, or
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={14} strokeWidth={1.7} />
            {uploading ? "Uploading…" : "Add floor plan"}
          </Button>
          <p className="text-[11px] text-bz-muted">
            JPG, PNG, WebP or AVIF · up to 10 MB. Added to the{" "}
            <Link href="/admin/media" className="underline hover:text-bz-ink">
              media library
            </Link>{" "}
            too. PDFs aren’t supported here — export the plan as an image.
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}

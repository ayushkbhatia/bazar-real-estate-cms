"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import { toast } from "sonner";

/**
 * Sprint 7f (backfilled): 21:9 cover image picker for the blog editor.
 * Stores the media_assets row id in `articles.hero_image_id`.
 *
 * The picker today opens a media-library popover stub; Sprint 9 wires
 * the real media-asset search. For new uploads we pass the file ref to
 * the parent which calls the existing upload server action.
 */
export function ArticleCoverPicker({
  initialKey,
  onPick,
  onClear,
  onUpload,
}: {
  initialKey: string | null;
  onPick?: (mediaAssetId: string) => void;
  onClear?: () => void;
  onUpload?: (file: File) => Promise<void> | void;
}) {
  const [storageKey, setStorageKey] = useState<string | null>(initialKey);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (onUpload) {
      await onUpload(f);
    } else {
      toast.info(
        `${f.name} queued — Sprint 9 wires the media-asset upload.`,
      );
    }
    e.target.value = "";
  }

  function clear() {
    setStorageKey(null);
    if (onClear) onClear();
    // Discourage no-op if Sprint 9 hasn't wired persistence.
    if (!onClear) toast.info("Cover cleared (UI only — wires Sprint 9).");
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <Eyebrow>Cover image · 21:9</Eyebrow>
        {storageKey ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-danger"
          >
            <X size={11} strokeWidth={1.7} />
            Remove
          </button>
        ) : null}
      </div>

      {storageKey ? (
        <div className="relative aspect-[21/9] rounded-md overflow-hidden border border-bz-border">
          <Image
            src={mediaPublicUrl(storageKey)}
            alt="Cover preview"
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <label className="block cursor-pointer">
          <div className="relative aspect-[21/9] rounded-md border-2 border-dashed border-bz-border bg-bz-surface hover:border-bz-border-strong transition-colors flex items-center justify-center">
            <div className="text-center text-bz-muted">
              <ImagePlus
                size={20}
                strokeWidth={1.5}
                className="mx-auto mb-1.5"
              />
              <span className="text-[13px]">
                Upload or pick from media library
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        </label>
      )}

      <p className="mt-2 text-[11px] text-bz-muted">
        21:9 ratio — appears as the article hero and in the
        OpenGraph image (Sprint 5d).
      </p>

      {/* Picker stub — keeps the surface complete; Sprint 9 wires the
          media-library search panel. */}
      {storageKey ? null : (
        <button
          type="button"
          onClick={() => {
            if (onPick) onPick("stub");
            else toast.info("Media-library picker activates with Sprint 9.");
          }}
          className="mt-2 text-[11.5px] text-bz-muted hover:text-bz-ink-2 underline underline-offset-2"
        >
          Pick from existing media
        </button>
      )}

      {void mediaPublicUrl}
      {void PlaceholderImage}
    </div>
  );
}

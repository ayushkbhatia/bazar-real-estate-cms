"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaOption } from "../_fields/types";
import { uploadToLibrary } from "../media/_upload-client";

/**
 * A library image plus the storage key the article body persists.
 *
 * `MediaOption.url` alone is not enough: it is a fully-qualified Supabase URL
 * that embeds the project ref, and the body stores the key so the public
 * renderer can rebuild the URL against whatever project is current. See
 * lib/tiptap/figure-image.ts.
 */
export type BlogMediaOption = MediaOption & { storage_key?: string | null };

export type InsertedImage = {
  src: string;
  mediaKey: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  caption: string;
};

/**
 * Intrinsic size of an image, read by loading it in the background.
 *
 * The `width`/`height` attributes they become are what let the browser reserve
 * the right box before the bytes arrive — without them every in-body image is a
 * layout shift on the public article. Resolves to nulls rather than rejecting:
 * a missing size hint is a small regression, a failed insert is a broken
 * feature.
 */
function measure(
  src: string,
): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({ width: null, height: null });
      return;
    }
    const probe = new window.Image();
    let settled = false;
    const done = (width: number | null, height: number | null) => {
      if (settled) return;
      settled = true;
      resolve({ width, height });
    };
    probe.onload = () =>
      done(probe.naturalWidth || null, probe.naturalHeight || null);
    probe.onerror = () => done(null, null);
    // Storage can be slow or cold; don't hold the insert hostage on it.
    window.setTimeout(() => done(null, null), 5000);
    probe.src = src;
  });
}

type DialogProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  media: BlogMediaOption[];
  onUploaded: (m: BlogMediaOption) => void;
  onInsert: (image: InsertedImage) => void;
};

export function ImageInsertDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        {/*
          The form is mounted only while the dialog is open, so every open
          starts from blank state. Carrying the previous selection over would
          silently attach the wrong image to the next insert.
        */}
        {props.open ? <ImageInsertForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ImageInsertForm({
  onOpenChange,
  media,
  onUploaded,
  onInsert,
}: DialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [inserting, setInserting] = useState(false);

  const images = useMemo(() => {
    const term = query.trim().toLowerCase();
    const onlyImages = media.filter(
      (m) => !m.mime || m.mime.startsWith("image/"),
    );
    if (!term) return onlyImages;
    return onlyImages.filter((m) => m.filename.toLowerCase().includes(term));
  }, [media, query]);

  const picked = media.find((m) => m.id === selected) ?? null;

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    // Body images live under `blog/` so the media library stays sortable by
    // where a file is actually used.
    const result = await uploadToLibrary(file, { folder: "blog" });
    setUploading(false);
    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    const option: BlogMediaOption = {
      id: result.id,
      filename: file.name,
      url: result.url,
      mime: file.type,
      storage_key: result.storage_key,
    };
    onUploaded(option);
    setSelected(result.id);
    toast.success(`Uploaded "${file.name}".`);
  }

  async function insert() {
    if (!picked) return;
    setInserting(true);
    const { width, height } = await measure(picked.url);
    setInserting(false);
    onInsert({
      src: picked.url,
      mediaKey: picked.storage_key ?? null,
      alt: alt.trim(),
      width,
      height,
      caption: caption.trim(),
    });
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Insert an image</DialogTitle>
        <DialogDescription>
          Pick one from the media library or upload a new file. It is inserted
          where the cursor is.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by filename…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 text-[12.5px]"
        />
        <label
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded border border-bz-border px-2.5 h-8 text-[12px] cursor-pointer hover:bg-bz-surface-2 transition-colors",
            uploading && "opacity-50 cursor-not-allowed",
          )}
        >
          <Upload size={12} strokeWidth={1.8} />
          {uploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="max-h-[240px] overflow-y-auto rounded border border-bz-border p-2">
        {images.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-bz-muted">
            {media.length === 0
              ? "The media library is empty — upload a file to get started."
              : "No images match that filename."}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {images.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                aria-pressed={selected === m.id}
                title={m.filename}
                className={cn(
                  "relative aspect-[4/3] rounded overflow-hidden border-2 transition-colors bg-bz-surface-2",
                  selected === m.id
                    ? "border-bz-navy"
                    : "border-transparent hover:border-bz-border",
                )}
              >
                <Image
                  src={m.url}
                  alt={m.filename}
                  fill
                  sizes="140px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="figure-alt">Alt text</Label>
          <Input
            id="figure-alt"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="What the image shows, for screen readers"
            className="h-8 text-[12.5px]"
          />
          <span className="text-[11px] text-bz-muted-2">
            Leave blank only if the image is decorative and the surrounding copy
            already says everything it shows.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="figure-caption">Caption (optional)</Label>
          <Input
            id="figure-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Shown under the image"
            className="h-8 text-[12.5px]"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void insert()}
          disabled={!picked || inserting}
        >
          {inserting ? "Inserting…" : "Insert image"}
        </Button>
      </DialogFooter>
    </>
  );
}

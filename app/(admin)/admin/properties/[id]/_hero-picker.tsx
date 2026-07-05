"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImagePlus, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mediaPublicUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import {
  setPropertyHero,
  uploadPropertyPhoto,
  type UploadedPhoto,
} from "./_actions";

export type HeroState = {
  id: string;
  storage_key: string;
  filename: string;
} | null;

export type MediaOption = {
  id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
};

type Props = {
  propertyId: string;
  initial: HeroState;
  media: MediaOption[];
};

export function HeroPicker({ propertyId, initial, media }: Props) {
  const [hero, setHero] = useState<HeroState>(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Photos uploaded in-dialog this session, shown ahead of the library.
  const [uploaded, setUploaded] = useState<MediaOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const libraryImages = media.filter((m) => m.mime_type.startsWith("image/"));
  // Uploaded-this-session first, then the library — de-duped by id.
  const seen = new Set<string>();
  const images = [...uploaded, ...libraryImages].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  function commit(next: HeroState) {
    startTransition(async () => {
      const result = await setPropertyHero(propertyId, next?.id ?? null);
      if (result.status === "ok") {
        setHero(next);
        setOpen(false);
        toast.success(result.message ?? "Hero updated.");
      } else {
        toast.error(result.message);
      }
    });
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploading(true);
    const done: UploadedPhoto[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadMsg(`Uploading ${i + 1} of ${files.length}…`);
        const fd = new FormData();
        fd.set("file", files[i]);
        const res = await uploadPropertyPhoto(propertyId, fd);
        if (res.status === "ok") {
          done.push(res.photo);
        } else {
          toast.error(res.message);
        }
      }
      if (done.length > 0) {
        setUploaded((prev) => [...done, ...prev]);
        // The action promotes the first upload to hero when the listing had
        // none; reflect that here so the card + pre-flight update.
        const newHero = done.find((p) => p.became_hero);
        if (newHero) {
          setHero({
            id: newHero.id,
            storage_key: newHero.storage_key,
            filename: newHero.filename,
          });
        }
        toast.success(
          `${done.length} photo${done.length === 1 ? "" : "s"} added to this property and the media library.`,
        );
      }
    } finally {
      setUploading(false);
      setUploadMsg(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-medium">Hero image</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <ImagePlus size={14} strokeWidth={1.8} />
              {hero ? "Change" : "Choose"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Property photos</DialogTitle>
              <DialogDescription>
                Upload photos straight to this listing (they&apos;re added to
                the{" "}
                <Link
                  href="/admin/media"
                  className="underline hover:text-bz-ink"
                >
                  media library
                </Link>{" "}
                too), or pick an existing image as the hero.
              </DialogDescription>
            </DialogHeader>

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
              <div className="text-[13px] text-bz-ink">
                Drag photos here, or
              </div>
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
                JPG, PNG, WebP, AVIF or GIF · up to 10 MB each. The first photo
                becomes the hero when none is set.
              </p>
            </div>

            {images.length === 0 ? (
              <div className="py-12 text-center text-bz-muted text-[13px]">
                No images uploaded yet.
              </div>
            ) : (
              <ul className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {images.map((m) => {
                  const selected = hero?.id === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => commit({
                          id: m.id,
                          storage_key: m.storage_key,
                          filename: m.filename,
                        })}
                        className={cn(
                          "relative w-full aspect-[4/3] rounded-md overflow-hidden border-2 transition-colors",
                          selected
                            ? "border-bz-accent ring-2 ring-bz-accent/30"
                            : "border-transparent hover:border-bz-border-strong",
                        )}
                        aria-pressed={selected}
                      >
                        <Image
                          src={mediaPublicUrl(m.storage_key)}
                          alt={m.filename}
                          fill
                          sizes="(max-width: 768px) 33vw, 25vw"
                          className="object-cover"
                        />
                      </button>
                      <div className="text-[10.5px] text-bz-muted truncate mt-1">
                        {m.filename}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <DialogFooter className="flex flex-row justify-between sm:justify-between">
              {hero ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => commit(null)}
                  disabled={pending}
                >
                  Remove hero
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {hero ? (
        <div className="flex items-stretch gap-4">
          <div className="relative w-40 aspect-[4/3] rounded-md overflow-hidden border border-bz-border flex-shrink-0">
            <Image
              src={mediaPublicUrl(hero.storage_key)}
              alt={hero.filename}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col justify-between gap-2">
            <div>
              <div className="text-[13.5px]">{hero.filename}</div>
              <div className="mono text-[11px] text-bz-muted mt-0.5">
                {hero.storage_key}
              </div>
            </div>
            <button
              type="button"
              onClick={() => commit(null)}
              disabled={pending}
              className="self-start text-[12px] text-bz-muted hover:text-bz-ink inline-flex items-center gap-1"
            >
              <X size={11} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-bz-muted">
          No hero set. Listing cards and the property page will fall back to a
          striped placeholder until you choose one.
        </p>
      )}
    </div>
  );
}

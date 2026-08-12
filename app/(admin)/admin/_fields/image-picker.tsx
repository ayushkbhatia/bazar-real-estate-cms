"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadToLibrary } from "../media/_upload-client";
import { fieldCls, type MediaOption } from "./types";

/**
 * Pick a media asset by id, with inline upload.
 *
 * The bare-id sibling of the field editor's `image` arm: this one is for
 * columns that hold a `media_id` directly (a development's cover, a blog post's
 * hero, a developer's logo) rather than an `ImageValue` inside a section
 * document. It used to live in the development sub-page editor and was
 * deep-imported by seven unrelated screens.
 */
export function ImagePicker({
  label,
  help,
  value,
  media,
  onChange,
  onUploaded,
  folder = "brand",
}: {
  label: string;
  help?: string;
  value: string | null;
  media: MediaOption[];
  onChange: (id: string | null) => void;
  onUploaded: (m: MediaOption) => void;
  folder?: "listings" | "brand" | "blog" | "team" | "documents";
}) {
  const [busy, setBusy] = useState(false);
  const picked = media.find((m) => m.id === value);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const result = await uploadToLibrary(file, { folder });
    setBusy(false);
    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(`Uploaded "${file.name}" to the media library.`);
    onUploaded({
      id: result.id,
      filename: file.name,
      url: result.url,
      mime: result.mime,
    });
    onChange(result.id);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <span className="text-[11.5px] font-medium text-bz-ink-2">{label}</span>
        {help ? (
          <span className="block text-[10.5px] text-bz-muted-2">{help}</span>
        ) : null}
      </div>
      <div className="flex items-start gap-2.5">
        <div className="relative h-16 w-24 flex-shrink-0 rounded overflow-hidden bg-bz-surface-2 border border-bz-border">
          {picked ? (
            <Image
              src={picked.url}
              alt={picked.filename}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-bz-muted-2">
              No image
            </span>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <select
            className={fieldCls}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">None — placeholder art</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.filename}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink cursor-pointer">
              <Upload size={11} strokeWidth={1.8} />
              {busy ? "Uploading…" : "Upload new"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {value ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
              >
                <X size={11} /> Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

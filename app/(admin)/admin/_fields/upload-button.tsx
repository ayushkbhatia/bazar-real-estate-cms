"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadToLibrary } from "../media/_upload-client";
import type { MediaOption } from "./types";

/**
 * Upload straight from a section's image field. Goes through the same
 * `uploadToLibrary` helper the media library uses, so the file lands in
 * Storage *and* gets a `media_assets` row — the section stores that row's id,
 * which is what keeps section images visible to the library's usage index.
 */
export function UploadButton({
  onUploaded,
  accept = "image/*",
  label = "Upload new",
  folder = "brand",
}: {
  onUploaded: (m: MediaOption) => void;
  accept?: string;
  label?: string;
  folder?: "listings" | "brand" | "blog" | "team" | "documents";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const result = await uploadToLibrary(file, { folder });
    setBusy(false);
    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(`Uploaded "${file.name}" to the media library.`);
    // Carry the mime through so the freshly uploaded asset appears in the
    // right picker straight away, without a page refresh.
    onUploaded({
      id: result.id,
      filename: file.name,
      url: result.url,
      mime: result.mime,
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink disabled:opacity-50"
      >
        <Upload size={11} strokeWidth={1.8} />
        {busy ? "Uploading…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

/**
 * Hero video upload. Same transport as `UploadButton` — the difference is the
 * policy it uploads under (`hero_video`: MP4/WebM, marketing roles and up).
 */
export function VideoUploadButton({
  onUploaded,
}: {
  onUploaded: (m: MediaOption) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;

    setBusy(true);
    try {
      const done = await uploadToLibrary(file, {
        folder: "brand",
        kind: "hero_video",
      });
      if (done.status === "error") {
        toast.error(done.message);
        return;
      }

      toast.success(`Uploaded "${file.name}" to the media library.`);
      onUploaded({
        id: done.id,
        filename: file.name,
        url: done.url,
        mime: done.mime,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink disabled:opacity-50"
      >
        <Upload size={11} strokeWidth={1.8} />
        {busy ? "Uploading…" : "Upload video"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

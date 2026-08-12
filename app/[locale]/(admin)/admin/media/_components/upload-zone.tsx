"use client";

import { useState, useRef } from "react";
import { Upload, FileUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Sprint 7d (backfilled): drag-and-drop upload zone for the media
 * library. Wires to the existing upload form action (the parent passes
 * onFiles). When no handler is passed, files toast a clear note.
 */
export function MediaUploadZone({
  onFiles,
  accept = "image/*,application/pdf,video/mp4",
}: {
  onFiles?: (files: File[]) => Promise<void> | void;
  accept?: string;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(files: File[]) {
    if (files.length === 0) return;
    if (onFiles) {
      await onFiles(files);
      return;
    }
    toast.info(
      `${files.length} file${files.length === 1 ? "" : "s"} queued. Sprint 9 wires the bulk upload action.`,
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(Array.from(e.dataTransfer.files));
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "rounded-lg border-2 border-dashed transition-colors cursor-pointer",
        over
          ? "border-bz-accent bg-bz-accent-soft/40"
          : "border-bz-border bg-bz-surface hover:border-bz-border-strong",
      )}
    >
      <div className="px-6 py-8 text-center">
        <Upload
          size={20}
          strokeWidth={1.5}
          className={cn(
            "mx-auto mb-2",
            over ? "text-bz-accent" : "text-bz-muted",
          )}
        />
        <p className="text-[13.5px] text-bz-ink-2">
          Drop files here, or{" "}
          <span className="text-bz-ink underline underline-offset-2">
            browse
          </span>
        </p>
        <p className="text-[11.5px] text-bz-muted mt-1">
          JPG, PNG, WebP, PDF, MP4 · 10 MB per file
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-bz-muted">
          <FileUp size={11} strokeWidth={1.7} />
          Multi-file uploads · drag handles after upload set sort order
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={(e) => {
          handle(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

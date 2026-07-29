"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { uploadMedia } from "../../media/_actions";

export type PhotoOption = { id: string; filename: string; url: string };

/**
 * Advisor portrait, picked from the media library or uploaded in place.
 *
 * `staff.photo_url` is a URL column, not a media id, so this stores the
 * asset's public URL — which keeps every existing external URL working and
 * needs no migration. Uploads still land in `media_assets`, so they show up in
 * the library, and the usage index matches them back to the advisor by
 * storage key.
 */
export function AgentPhotoField({
  value,
  options,
  onChange,
  error,
}: {
  value: string;
  options: PhotoOption[];
  onChange: (url: string) => void;
  error?: string;
}) {
  const [library, setLibrary] = useState(options);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const picked = library.find((o) => o.url === value);
  const isExternal = value !== "" && !picked;

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("folder", "team");
    const result = await uploadMedia(form);
    setBusy(false);
    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(`Uploaded "${file.name}" to the media library.`);
    setLibrary((cur) => [
      { id: result.id, filename: file.name, url: result.url },
      ...cur,
    ]);
    onChange(result.url);
  }

  return (
    <div>
      <Label htmlFor="photo_select">Photo</Label>
      <div className="mt-1.5 flex items-start gap-3">
        <div className="relative h-[100px] w-20 flex-shrink-0 overflow-hidden rounded border border-bz-border bg-bz-surface-2">
          {value ? (
            <Image
              src={value}
              alt={picked?.filename ?? "Advisor portrait"}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-bz-muted-2">
              No photo
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          <select
            id="photo_select"
            className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[13px]"
            value={picked?.url ?? ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">No photo</option>
            {isExternal ? (
              <option value={value}>Current photo (external link)</option>
            ) : null}
            {library.map((o) => (
              <option key={o.id} value={o.url}>
                {o.filename}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink disabled:opacity-50"
            >
              <Upload size={11} strokeWidth={1.8} />
              {busy ? "Uploading…" : "Upload new"}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
              >
                <X size={11} /> Remove
              </button>
            ) : null}
          </div>

          {isExternal ? (
            <p className="text-[11px] text-bz-muted">
              This photo lives outside the media library. Uploading a new one
              replaces it.
            </p>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error ? <p className="text-[12px] text-bz-danger mt-1">{error}</p> : null}
    </div>
  );
}

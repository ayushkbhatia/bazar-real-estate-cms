"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MediaOption } from "../../../master/[key]/_editor";
import { uploadToLibrary } from "../../../../media/_upload-client";
import { setDevelopmentImages } from "../_actions";

/**
 * Cover and site-plan imagery. These live on the `developments` row rather
 * than in the section document — the public page and the developments editor
 * both already read them from there, and one fact in two places drifts.
 */
export function DevelopmentImagesCard({
  slug,
  media: initialMedia,
  heroImageId,
  masterplanId,
}: {
  slug: string;
  media: MediaOption[];
  heroImageId: string | null;
  masterplanId: string | null;
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [hero, setHero] = useState(heroImageId);
  const [plan, setPlan] = useState(masterplanId);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const result = await setDevelopmentImages(slug, {
        hero_image_id: hero,
        masterplan_id: plan,
      });
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-[13.5px] font-medium">Page images</h2>
          <p className="text-[11.5px] text-bz-muted">
            Pick from the media library or upload — uploads are added to the
            library automatically.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onSave} disabled={pending || !dirty}>
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save images"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImagePicker
          label="Cover image"
          help="The full-width hero at the top of the project page."
          value={hero}
          media={media}
          onChange={(id) => {
            setHero(id);
            setDirty(true);
          }}
          onUploaded={(m) => setMedia((cur) => [m, ...cur])}
        />
        <ImagePicker
          label="Site plan"
          help="Shown in the Master plan section."
          value={plan}
          media={media}
          onChange={(id) => {
            setPlan(id);
            setDirty(true);
          }}
          onUploaded={(m) => setMedia((cur) => [m, ...cur])}
        />
      </div>
    </section>
  );
}

export function ImagePicker({
  label,
  help,
  value,
  media,
  onChange,
  onUploaded,
}: {
  label: string;
  help?: string;
  value: string | null;
  media: MediaOption[];
  onChange: (id: string | null) => void;
  onUploaded: (m: MediaOption) => void;
}) {
  const [busy, setBusy] = useState(false);
  const picked = media.find((m) => m.id === value);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const result = await uploadToLibrary(file, { folder: "brand" });
    setBusy(false);
    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(`Uploaded "${file.name}" to the media library.`);
    onUploaded({ id: result.id, filename: file.name, url: result.url });
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
            className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]"
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

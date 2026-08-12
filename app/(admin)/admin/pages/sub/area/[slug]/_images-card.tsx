"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MediaOption } from "../../../../_fields/types";
import { ImagePicker } from "../../../../_fields/image-picker";
import { setAreaImages } from "../_actions";

/**
 * The guide's cover image. Stored on the `areas` row, which is where the
 * public page already reads it from.
 */
export function AreaImagesCard({
  slug,
  media: initialMedia,
  heroImageId,
}: {
  slug: string;
  media: MediaOption[];
  heroImageId: string | null;
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [hero, setHero] = useState(heroImageId);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const result = await setAreaImages(slug, { hero_image_id: hero });
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
          {pending ? "Saving…" : "Save image"}
        </Button>
      </div>

      <div className="max-w-md">
        <ImagePicker
          label="Cover image"
          help="The wide 21:9 image under the intro."
          value={hero}
          media={media}
          onChange={(id) => {
            setHero(id);
            setDirty(true);
          }}
          onUploaded={(m) => setMedia((cur) => [m, ...cur])}
        />
      </div>
    </section>
  );
}

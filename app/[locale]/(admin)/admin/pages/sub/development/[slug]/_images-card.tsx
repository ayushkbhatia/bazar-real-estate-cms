"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "../../../../_fields/image-picker";
import type { MediaOption } from "../../../../_fields/types";
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
        <div className="me-auto">
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
          help="The card art wherever this project is listed — off-plan, the home page, search. Also the hero band at the top of the project page, unless the Hero section below carries its own banner."
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MediaOption } from "../../pages/master/[key]/_editor";
import { ImagePicker } from "../../pages/sub/development/[slug]/_images-card";
import { setDeveloperLogo } from "../_actions";

/**
 * The developer's logo, stored on the `developers` row.
 *
 * Saves on its own — same split as the area cover image — so picking an asset
 * takes effect without submitting the record form. The 30 launch partners ship
 * with trimmed PNGs in /public/developers and those still win on the public
 * page; this is what gives a developer added in the CMS a mark of its own
 * instead of initials.
 */
export function DeveloperLogoCard({
  developerId,
  media: initialMedia,
  logoId,
  shippedLogoUrl = null,
}: {
  developerId: string;
  media: MediaOption[];
  logoId: string | null;
  /**
   * The mark that ships in /public/developers for this developer, if any.
   * Shown as the current logo while nothing is uploaded — otherwise the card
   * reads as "no logo" for the 30 launch partners whose profiles clearly have
   * one.
   */
  shippedLogoUrl?: string | null;
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [logo, setLogo] = useState(logoId);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const result = await setDeveloperLogo(developerId, logo);
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
          <h2 className="text-[13.5px] font-medium">Logo</h2>
          <p className="text-[11.5px] text-bz-muted">
            Pick from the media library or upload — uploads are added to the
            library automatically. A transparent PNG on a square canvas sits
            best in the card grid.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save logo"}
        </Button>
      </div>

      {shippedLogoUrl && !logo ? (
        <div className="flex items-center gap-3 rounded border border-bz-border bg-bz-surface-2 p-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-white">
            {/* Not next/image: this is a static file whose intrinsic size the
                card doesn't need, and the box is fixed either way. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shippedLogoUrl}
              alt=""
              className="h-full w-full object-contain p-1"
            />
          </span>
          <span className="text-[12px] text-bz-ink-2 leading-relaxed">
            <span className="block text-bz-ink">Currently using the built-in logo</span>
            This developer ships with artwork in the site&apos;s own files, which
            is what the public page shows today. Pick or upload a file below to
            replace it.
          </span>
        </div>
      ) : null}

      <div className="max-w-md">
        <ImagePicker
          label="Logo"
          help={
            shippedLogoUrl
              ? "Replaces the built-in logo on /developers and the profile hero."
              : "Shown on /developers and on the profile hero."
          }
          value={logo}
          media={media}
          onChange={(id) => {
            setLogo(id);
            setDirty(true);
          }}
          onUploaded={(m) => setMedia((cur) => [m, ...cur])}
        />
      </div>
    </section>
  );
}

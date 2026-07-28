"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import type { MediaOption } from "../../../master/[key]/_editor";
import { ImagePicker } from "../[slug]/_images-card";
import { createDevelopmentPage } from "../_actions";

type Option = { id: string; name: string };

export function NewDevelopmentPageForm({
  developers,
  areas,
  media: initialMedia,
}: {
  developers: Option[];
  areas: Option[];
  media: MediaOption[];
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [name, setName] = useState("");
  // Blank until touched, so it keeps tracking the name; typing pins it.
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [developerId, setDeveloperId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [tagline, setTagline] = useState("");
  const [heroId, setHeroId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(name);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await createDevelopmentPage({
        name,
        slug: effectiveSlug,
        developer_id: developerId,
        area_id: areaId || null,
        tagline: tagline.trim() || null,
        hero_image_id: heroId,
      });
      if (result.status === "error") {
        toast.error(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }
      toast.success("Project page created.");
      router.push(`/admin/pages/sub/development/${result.slug}`);
    });
  }

  const fieldCls =
    "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[13px]";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 max-w-2xl">
      <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Project name</Label>
          <Input
            id="name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <FieldError message={errors.name} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Page link</Label>
          <div className="flex items-center gap-2">
            <span className="mono text-[12.5px] text-bz-muted">
              /developments/
            </span>
            <Input
              id="slug"
              value={effectiveSlug}
              placeholder="auto-generated from the name"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </div>
          <span className="text-[11.5px] text-bz-muted">
            Lowercase letters, numbers and hyphens. This is the public URL, so
            it&apos;s worth getting right before the page goes live.
          </span>
          <FieldError message={errors.slug} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="developer">Developer</Label>
            <select
              id="developer"
              className={fieldCls}
              value={developerId}
              onChange={(e) => setDeveloperId(e.target.value)}
            >
              <option value="">Choose a developer</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.developer_id} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="area">Area</Label>
            <select
              id="area"
              className={fieldCls}
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              <option value="">Unset</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={tagline}
            placeholder="One line under the project name"
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <ImagePicker
          label="Cover image"
          help="The hero at the top of the page. You can change it later."
          value={heroId}
          media={media}
          onChange={setHeroId}
          onUploaded={(m) => setMedia((cur) => [m, ...cur])}
        />
      </div>

      <div className="flex items-center gap-3">
        <p className="text-[12px] text-bz-muted mr-auto">
          The page starts unpublished — nothing appears on the public site until
          you publish the project.
        </p>
        <Button type="submit" disabled={pending}>
          <Plus size={14} strokeWidth={1.8} />
          {pending ? "Creating…" : "Create page"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

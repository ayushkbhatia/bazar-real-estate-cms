"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fieldCls } from "../../_fields/types";
import { PRESETS } from "@/lib/page-builder/presets";
import { getBlockDef } from "@/lib/page-builder/catalogue";
import { slugifyTitle } from "@/lib/schemas/landing-page";
import { createLandingPage } from "../_actions";

export function NewLandingForm() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  // Until someone types in the URL box it tracks the title. After that it
  // stops, because an editor who has set a campaign URL does not want it
  // rewritten when they fix a typo in the title.
  const [slugTouched, setSlugTouched] = useState(false);
  const [preset, setPreset] = useState("off_plan_launch");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugifyTitle(title);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      // A successful create redirects, so only failures return here.
      const result = await createLandingPage({
        title,
        slug: effectiveSlug,
        preset,
      });
      if (result.status === "invalid") {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
      } else if (result.status !== "ok") {
        toast.error(result.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lp-title" className="text-[11.5px] font-medium text-bz-ink-2">
            Page title
          </label>
          <input
            id="lp-title"
            className={fieldCls}
            value={title}
            autoFocus
            placeholder="Saadiyat Lagoons launch"
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="text-[10.5px] text-bz-muted-2">
            Used in the browser tab and in search results.
          </p>
          {errors.title ? (
            <span className="text-[11px] text-[oklch(0.45_0.13_28)]">
              {errors.title}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="lp-slug" className="text-[11.5px] font-medium text-bz-ink-2">
            URL
          </label>
          <div className="flex items-center gap-1.5">
            <span className="mono text-[12.5px] text-bz-muted shrink-0">
              bazar.ae/lp/
            </span>
            <input
              id="lp-slug"
              className={cn(fieldCls, "mono")}
              value={effectiveSlug}
              placeholder="saadiyat-lagoons-launch"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
            />
          </div>
          <p className="text-[10.5px] text-bz-muted-2">
            Lowercase letters, digits and hyphens. No slashes — this is one path
            segment.
          </p>
          {errors.slug ? (
            <span className="text-[11px] text-[oklch(0.45_0.13_28)]">
              {errors.slug}
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-3">
        <div>
          <h2 className="text-[13.5px] font-medium">Starting layout</h2>
          <p className="text-[11.5px] text-bz-muted">
            A preset just drops sections in for you. Everything stays editable.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => setPreset(p.key)}
                  aria-pressed={active}
                  className={cn(
                    "w-full text-start rounded-lg border px-3.5 py-3 transition-colors",
                    active
                      ? "border-bz-teal bg-bz-surface-2"
                      : "border-bz-border hover:border-bz-muted-2",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium">{p.label}</span>
                    {active ? (
                      <Check size={14} strokeWidth={2} className="text-bz-teal" />
                    ) : null}
                  </span>
                  <span className="block text-[11.5px] text-bz-muted mt-0.5">
                    {p.description}
                  </span>
                  {p.blocks.length > 0 ? (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {p.blocks.map((key, i) => (
                        <span
                          key={`${key}-${i}`}
                          className="inline-flex items-center h-[20px] px-2 rounded-full bg-bz-surface-2 border border-bz-border text-[10.5px] text-bz-ink-2"
                        >
                          {getBlockDef(key)?.label ?? key}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || title.trim() === ""}>
          {pending ? "Creating…" : "Create landing page"}
        </Button>
        <span className="text-[11.5px] text-bz-muted">
          Created as a draft. Nothing is public until you publish it.
        </span>
      </div>
    </form>
  );
}

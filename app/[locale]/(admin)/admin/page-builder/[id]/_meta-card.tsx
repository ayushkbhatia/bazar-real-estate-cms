"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArabicTwin } from "../../_fields/arabic-twin";
import { fieldCls } from "../../_fields/types";
import { updateLandingMeta } from "../_actions";
import { SearchResultPreview } from "../../_fields/search-appearance";
import {
  SEO_DESCRIPTION_DISPLAY,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_DISPLAY,
  SEO_TITLE_MAX,
} from "@/lib/schemas/seo";

type Meta = {
  title: string;
  title_ar: string | null;
  slug: string;
  meta_title: string;
  meta_description: string;
  noindex: boolean;
};

export function LandingMetaCard({
  id,
  initial,
  faviconUrl,
  brandName,
}: {
  id: string;
  initial: Meta;
  faviconUrl: string | null;
  brandName: string;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function set<K extends keyof Meta>(key: K, value: Meta[K]) {
    setMeta((m) => ({ ...m, [key]: value }));
    setDirty(true);
  }

  function onSave() {
    setErrors({});
    startTransition(async () => {
      const result = await updateLandingMeta(id, { ...meta });
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else if (result.status === "invalid") {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="me-auto">
          <h2 className="text-[13.5px] font-medium">Page details</h2>
          <p className="text-[11.5px] text-bz-muted">
            Title, URL and how the page appears in search.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onSave} disabled={pending || !dirty}>
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save details"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Page title" error={errors.title}>
          <input
            className={fieldCls}
            value={meta.title}
            onChange={(e) => set("title", e.target.value)}
          />
          <ArabicTwin
            field={{ key: "title_ar", label: "Page title", kind: "text", max: 160 }}
            value={meta.title_ar ?? ""}
            onChange={(v) => set("title_ar", v || null)}
          />
        </Field>

        <Field
          label="URL"
          help="Changing this breaks any advert already pointing at the old address."
          error={errors.slug}
        >
          <div className="flex items-center gap-1.5">
            <span className="mono text-[12px] text-bz-muted shrink-0">/lp/</span>
            <input
              className={cn(fieldCls, "mono")}
              value={meta.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase())}
            />
          </div>
        </Field>

        <Field
          label="Search title"
          help={counterHelp(meta.meta_title, SEO_TITLE_DISPLAY, SEO_TITLE_MAX)}
          error={errors.meta_title}
        >
          <input
            className={fieldCls}
            value={meta.meta_title}
            placeholder={meta.title}
            onChange={(e) => set("meta_title", e.target.value)}
          />
        </Field>

        <Field
          label="Search description"
          help={counterHelp(
            meta.meta_description,
            SEO_DESCRIPTION_DISPLAY,
            SEO_DESCRIPTION_MAX,
          )}
          error={errors.meta_description}
        >
          <textarea
            className={cn(fieldCls, "resize-y min-h-[64px]")}
            value={meta.meta_description}
            onChange={(e) => set("meta_description", e.target.value)}
          />
        </Field>
      </div>

      {/*
        The rehearsal. A landing page is usually built against a paid campaign,
        where the result row is the first thing a click ever sees — and the
        noindex box below means it is sometimes not seen at all, which the
        preview says out loud rather than leaving to be inferred.
      */}
      {meta.noindex ? (
        <p className="rounded border border-bz-border bg-bz-surface-2 px-3 py-2 text-[11.5px] text-bz-muted">
          Hidden from search — this page asks not to be indexed, so the title
          and description above will not appear in a result.
        </p>
      ) : (
        <SearchResultPreview
          path={`/lp/${meta.slug || "your-slug"}`}
          title={meta.meta_title}
          description={meta.meta_description}
          /* /lp/[slug] falls back to the page title, and publishes no
             description at all when the field is blank. */
          fallbackTitle={meta.title}
          fallbackDescription={null}
          faviconUrl={faviconUrl}
          brandName={brandName}
        />
      )}

      <label className="flex items-start gap-2.5 text-[12.5px] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={meta.noindex}
          onChange={(e) => set("noindex", e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-bz-accent"
        />
        <span>
          Keep this page out of search results
          <span className="block text-[11px] text-bz-muted-2">
            Usual choice for a paid-advert landing page, so it doesn&apos;t
            compete with the main site in Google.
          </span>
        </span>
      </label>
    </section>
  );
}

function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-bz-ink-2">{label}</span>
        {help ? (
          <span className="text-[10.5px] text-bz-muted-2">{help}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <span className="text-[11px] text-[oklch(0.45_0.13_28)]">{error}</span>
      ) : null}
    </div>
  );
}

/**
 * The counter beside a search field.
 *
 * It reports two different limits and they are not the same thing: `max` is
 * what the validator will reject, `display` is where Google stops showing the
 * copy. Only the second one matters most of the time, which is why it is the
 * one that gets words.
 */
function counterHelp(value: string, display: number, max: number): string {
  const n = value.length;
  if (n === 0) return `0/${max}`;
  if (n > max) return `${n}/${max} — too long to save`;
  if (n > display) return `${n}/${max} — cut in results past ~${display}`;
  return `${n}/${max}`;
}

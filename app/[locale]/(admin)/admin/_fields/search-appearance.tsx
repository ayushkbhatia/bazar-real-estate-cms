"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SEO_DESCRIPTION_DISPLAY,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_DISPLAY,
  SEO_TITLE_MAX,
  type SearchAppearance,
  type SearchAppearanceInput,
} from "@/lib/schemas/seo";
import { fieldCls } from "./types";

/**
 * Where the copy is cut, and whether it was.
 *
 * Truncated at a word boundary, because that is what Google does — it does not
 * slice mid-word — so a preview that hard-cuts at character 60 would show a
 * fragment no visitor will ever see and send the editor rewriting the wrong
 * thing.
 */
function clip(text: string, limit: number): { shown: string; cut: boolean } {
  if (text.length <= limit) return { shown: text, cut: false };
  const hard = text.slice(0, limit);
  const space = hard.lastIndexOf(" ");
  return { shown: (space > limit * 0.6 ? hard.slice(0, space) : hard), cut: true };
}

/** `/services/sell` → `bazar.ae › services › sell`, the way a result reads. */
function crumb(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return ["bazarrealestate.ae", ...parts].join(" › ");
}

export type SearchPreviewProps = {
  /** Path on the site, leading slash. Drawn as the result's breadcrumb. */
  path: string;
  /** The current meta title, or "" to fall through to `fallbackTitle`. */
  title: string;
  /** The current meta description, or "" to fall through. */
  description: string;
  /** What the page publishes today when the field is blank. */
  fallbackTitle: string;
  fallbackDescription: string | null;
  /** The site icon, from Brand & identity. Null draws the generic globe. */
  faviconUrl: string | null;
  brandName: string;
};

/**
 * A Google result, rehearsed.
 *
 * This is the whole point of the feature, not decoration around the inputs.
 * The two failures it catches are invisible in a bare text field: copy that
 * reads well in a 70-character box but is cut mid-thought at Google's ~60,
 * and a page that has no description at all and therefore lets Google invent
 * one from the body. Both are otherwise only discoverable by searching for
 * your own site days after a re-crawl.
 *
 * The result is drawn from the same values the public route will publish,
 * including the fallbacks — so a blank field shows what visitors see today
 * rather than an empty box, and it is labelled as a fallback so nobody reads
 * inherited copy as authored copy.
 */
export function SearchResultPreview({
  path,
  title,
  description,
  fallbackTitle,
  fallbackDescription,
  faviconUrl,
  brandName,
}: SearchPreviewProps) {
  const usingTitleFallback = title.trim() === "";
  const usingDescriptionFallback = description.trim() === "";

  const effectiveTitle = usingTitleFallback ? fallbackTitle : title.trim();
  const effectiveDescription = usingDescriptionFallback
    ? (fallbackDescription ?? "")
    : description.trim();

  const t = clip(effectiveTitle, SEO_TITLE_DISPLAY);
  const d = clip(effectiveDescription, SEO_DESCRIPTION_DISPLAY);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
        <div className="max-w-[600px]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-bz-border bg-bz-bg">
              {faviconUrl ? (
                /* Plain <img>: 20px is below every optimizer breakpoint, so
                   next/image would only add a request for the same bytes. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={faviconUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 object-contain"
                />
              ) : (
                <span className="size-3 rounded-full bg-bz-muted-2" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] text-bz-ink">
                {brandName}
              </span>
              <span className="mono block truncate text-[11px] text-bz-muted">
                {crumb(path)}
              </span>
            </span>
          </div>

          <span
            className={cn(
              "mt-2 block text-[17px] leading-snug",
              usingTitleFallback ? "text-bz-muted" : "text-bz-accent",
            )}
          >
            {t.shown}
            {t.cut ? <span className="text-bz-muted-2">…</span> : null}
          </span>

          {effectiveDescription ? (
            <span
              className={cn(
                "mt-1 block text-[12.5px] leading-relaxed",
                usingDescriptionFallback ? "text-bz-muted-2" : "text-bz-ink-2",
              )}
            >
              {d.shown}
              {d.cut ? <span className="text-bz-muted-2">…</span> : null}
            </span>
          ) : (
            /*
              No description anywhere is a real state with a real consequence,
              so it is spelled out rather than left as blank space: Google
              writes its own snippet from the page body, and what it picks is
              not something anyone here gets to choose.
            */
            <span className="mt-1 block text-[12.5px] leading-relaxed text-bz-danger">
              No description — Google will write its own snippet from the page
              body.
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-bz-muted">
        Approximate. Google cuts on rendered width, not character count, and
        rewrites a title or snippet whenever it judges the query is better
        served by something else.
        {usingTitleFallback || usingDescriptionFallback ? (
          <>
            {" "}
            Greyed text is the fallback this page publishes today, not saved
            copy.
          </>
        ) : null}
      </p>
    </div>
  );
}

/** A counter that stays quiet until it has something to say. */
function Counter({
  value,
  display,
  max,
}: {
  value: string;
  display: number;
  max: number;
}) {
  const n = value.trim().length;
  if (n === 0) return null;
  const over = n > max;
  const cut = n > display;
  return (
    <span
      className={cn(
        "text-[11px]",
        over ? "text-bz-danger" : cut ? "text-bz-ink-2" : "text-bz-muted",
      )}
    >
      {n}/{max}
      {over
        ? " — too long to save"
        : cut
          ? ` — cut in results past ~${display}`
          : null}
    </span>
  );
}

/**
 * The Arabic input for a meta field.
 *
 * Deliberately not `ArabicTwin` from this same folder: that component takes a
 * master-page `SimpleFieldDef` and derives its cap from the registry, and the
 * SEO bag has no field definition — it is two loose strings in jsonb. Same
 * collapsed-by-default behaviour and the same rtl/lang attributes, because an
 * editor should not have to learn a second interaction for the same job.
 */
function ArabicMetaField({
  label,
  value,
  onChange,
  max,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  rows?: number;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const filled = value.trim().length > 0;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] text-bz-muted hover:text-bz-ink transition-colors"
        aria-expanded={open}
        aria-controls={id}
      >
        <span lang="ar" dir="rtl">
          العربية
        </span>
        {/* Never colour alone — the a11y spec runs axe against production. */}
        {filled ? (
          <span className="text-bz-teal">● set</span>
        ) : (
          <span className="text-bz-muted-2">— not set</span>
        )}
      </button>
      {open ? (
        <div className="mt-1.5">
          <label className="sr-only" htmlFor={id}>
            {label} (Arabic)
          </label>
          {rows ? (
            <textarea
              id={id}
              dir="rtl"
              lang="ar"
              rows={rows}
              maxLength={max}
              className={fieldCls}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <input
              id={id}
              dir="rtl"
              lang="ar"
              maxLength={max}
              className={fieldCls}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Deliberately wider than `"ok" | "error"`: the master-page actions answer with
 * an `"invalid"` status too, and every editor's action type is slightly
 * different. Anything that is not `"ok"` is surfaced as its own message.
 */
export type SaveSearchAppearance = (
  input: SearchAppearanceInput,
) => Promise<{ status: string; message?: string }>;

/**
 * The card every page editor under Pages & blocks mounts.
 *
 * Self-contained — its own state and its own save — rather than fields spliced
 * into whichever form each editor already has. Those forms are all different
 * (react-hook-form here, a hand-rolled reducer there, a section document
 * somewhere else), and threading two more fields through five of them would
 * have produced five subtly different SEO editors. One card with one server
 * action per screen keeps the behaviour identical everywhere, which is the
 * point of putting it in each page's own editor rather than in one global
 * screen.
 */
export function SearchAppearanceCard({
  initial,
  path,
  fallbackTitle,
  fallbackDescription,
  faviconUrl,
  brandName,
  onSave,
  description,
}: {
  initial: SearchAppearance;
  onSave: SaveSearchAppearance;
  /** Copy explaining what this particular page falls back to. */
  description?: string;
} & Omit<SearchPreviewProps, "title" | "description">) {
  const titleId = useId();
  const descriptionId = useId();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial.meta_title ?? "");
  const [body, setBody] = useState(initial.meta_description ?? "");
  const [titleAr, setTitleAr] = useState(initial.meta_title_ar ?? "");
  const [bodyAr, setBodyAr] = useState(initial.meta_description_ar ?? "");

  function submit() {
    startTransition(async () => {
      const result = await onSave({
        meta_title: title,
        meta_description: body,
        meta_title_ar: titleAr,
        meta_description_ar: bodyAr,
      });
      if (result.status === "ok")
        toast.success(result.message ?? "Search appearance saved.");
      else toast.error(result.message ?? "Could not save.");
    });
  }

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-[14px] font-medium">Search appearance</h2>
        <p className="mt-1 text-[13px] text-bz-muted max-w-[70ch] leading-relaxed">
          {description ??
            "The title and description Google shows for this page. Leave either blank to keep what the page publishes today."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={titleId}>Search title</Label>
          <Counter
            value={title}
            display={SEO_TITLE_DISPLAY}
            max={SEO_TITLE_MAX}
          />
        </div>
        <input
          id={titleId}
          className={fieldCls}
          maxLength={SEO_TITLE_MAX}
          value={title}
          placeholder={fallbackTitle}
          onChange={(e) => setTitle(e.target.value)}
        />
        <ArabicMetaField
          label="Search title"
          value={titleAr}
          onChange={setTitleAr}
          max={Math.round(SEO_TITLE_MAX * 1.5)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={descriptionId}>Search description</Label>
          <Counter
            value={body}
            display={SEO_DESCRIPTION_DISPLAY}
            max={SEO_DESCRIPTION_MAX}
          />
        </div>
        <textarea
          id={descriptionId}
          rows={3}
          className={fieldCls}
          maxLength={SEO_DESCRIPTION_MAX}
          value={body}
          placeholder={fallbackDescription ?? "One sentence on what this page offers."}
          onChange={(e) => setBody(e.target.value)}
        />
        <ArabicMetaField
          label="Search description"
          value={bodyAr}
          onChange={setBodyAr}
          max={Math.round(SEO_DESCRIPTION_MAX * 1.5)}
          rows={3}
        />
      </div>

      <SearchResultPreview
        path={path}
        title={title}
        description={body}
        fallbackTitle={fallbackTitle}
        fallbackDescription={fallbackDescription}
        faviconUrl={faviconUrl}
        brandName={brandName}
      />

      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save search appearance"}
        </Button>
      </div>
    </section>
  );
}

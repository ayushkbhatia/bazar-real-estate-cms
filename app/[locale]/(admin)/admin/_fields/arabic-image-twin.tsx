"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageValue } from "@/lib/master-pages";
import { fieldCls, type MediaOption } from "./types";
import { UploadButton } from "./upload-button";

/**
 * The Arabic rendering of an image, nested under its English sibling.
 *
 * The text twin next door swaps a string; this swaps the asset. It exists for
 * the images whose artwork *is* copy — the "List your property" card, where
 * the words are baked into the picture and so stay English under `lang="ar"`
 * no matter how much of the page around them is translated.
 *
 * Same shape as `ArabicTwin` on purpose: collapsed on mount, with a set /
 * not-set badge beside the label. An editor who never touches Arabic sees one
 * extra line, not a second picker.
 *
 * Its own alt text comes with it. A different picture needs a different
 * description, and `applyLocale` reads `alt_ar` in the same swap, so leaving
 * it out would describe the English artwork to an Arabic screen reader.
 */
export function ArabicImageTwin({
  value,
  options,
  onChange,
  onMediaAdded,
}: {
  value: ImageValue;
  /** Already filtered to images by the caller. */
  options: MediaOption[];
  onChange: (v: ImageValue) => void;
  onMediaAdded: (m: MediaOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const picked = options.find((m) => m.id === value.media_id_ar);
  const filled = Boolean(value.media_id_ar);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-1.5 text-[11px] text-bz-muted hover:text-bz-ink transition-colors"
        aria-expanded={open}
      >
        <ChevronRight
          size={11}
          strokeWidth={2}
          className={cn("transition-transform", open && "rotate-90")}
        />
        <span lang="ar" dir="rtl">
          العربية
        </span>
        {/* Status is never colour alone — the a11y spec runs axe against
            production, and a colour-only signal fails it. */}
        {filled ? (
          <span className="text-bz-teal">● set</span>
        ) : (
          <span className="text-bz-muted-2">— not set</span>
        )}
      </button>

      {open ? (
        <div className="mt-1.5 flex items-start gap-2.5">
          <div className="relative h-14 w-20 flex-shrink-0 rounded overflow-hidden bg-bz-surface-2 border border-bz-border">
            {picked ? (
              <Image
                src={picked.url}
                alt={picked.filename}
                fill
                sizes="80px"
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
              className={fieldCls}
              value={value.media_id_ar ?? ""}
              onChange={(e) =>
                onChange({ ...value, media_id_ar: e.target.value || null })
              }
            >
              <option value="">Same as English</option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.filename}
                </option>
              ))}
            </select>
            <input
              className={cn(fieldCls, "leading-[1.75]")}
              dir="rtl"
              lang="ar"
              placeholder="نص بديل"
              value={value.alt_ar ?? ""}
              onChange={(e) =>
                onChange({ ...value, alt_ar: e.target.value || null })
              }
            />
            <div className="flex items-center gap-3">
              <UploadButton
                onUploaded={(m) => {
                  onMediaAdded(m);
                  onChange({ ...value, media_id_ar: m.id });
                }}
              />
              {value.media_id_ar ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...value, media_id_ar: null })}
                  className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
                >
                  <X size={11} /> Use the English image
                </button>
              ) : null}
            </div>
            <span className="text-[10.5px] text-bz-muted-2">
              Blank shows the English image on /ar.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

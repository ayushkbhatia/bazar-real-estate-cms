"use client";

import Image from "next/image";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isFileField,
  isImageField,
  isListField,
  isSelectField,
  isToggleField,
  isVideoField,
  type FieldDef,
  type ImageValue,
  type ItemValue,
  type SectionValues,
  type SimpleFieldDef,
  arKey,
  isTranslatable,
} from "@/lib/master-pages";
import { ArabicTwin } from "./arabic-twin";
import { UploadButton, VideoUploadButton } from "./upload-button";
import { fieldCls, type MediaOption, type Seeds } from "./types";

/**
 * The field editor, generated from a `FieldDef`.
 *
 * Extracted out of the master-page editor so the page builder drives the same
 * inputs. The two differ in how a document is *shaped* — a fixed section list
 * versus an open block catalogue — not in what a field means, so forking this
 * would have meant maintaining every field kind twice.
 */
export function FieldEditor({
  field,
  value,
  onChange,
  media,
  onMediaAdded,
  seeds,
  arValue,
  onArChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: SectionValues[string]) => void;
  media: MediaOption[];
  onMediaAdded: (m: MediaOption) => void;
  seeds: Seeds;
  /**
   * The Arabic twin's stored value, and its setter. Optional so a caller that
   * has no bilingual document (or does not want the twin) is unaffected.
   *
   * Passed in rather than derived here because only the caller knows the whole
   * values bag. List sub-fields are the exception — this component owns the
   * item object, so it wires their twins itself and the call sites need no
   * change for them, which is most of why the twins are derived rather than
   * declared.
   */
  arValue?: string;
  onArChange?: (v: string) => void;
}) {
  if (isListField(field)) {
    const items = Array.isArray(value)
      ? (value as Record<string, ItemValue>[])
      : [];
    const seedCurrent = field.seedKey
      ? (seeds[field.seedKey]?.current ?? [])
      : [];
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel label={field.label} help={field.help} />
        {items.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11.5px] text-bz-muted">
              Empty — the section keeps the list it ships with. Add one to take
              over the whole list.
            </p>
            {seedCurrent.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  onChange(
                    seedCurrent.slice(0, field.max).map((s) => ({
                      enabled: true,
                      name: s.name,
                      href: s.href,
                      slug: s.slug,
                      image: { media_id: null, alt: null, label: s.slug },
                    })),
                  )
                }
              >
                <Plus size={12} strokeWidth={1.8} /> Load the{" "}
                {Math.min(seedCurrent.length, field.max)}{" "}
                {field.itemLabel}
                {Math.min(seedCurrent.length, field.max) === 1 ? "" : "s"} on
                the page
              </Button>
            ) : null}
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded border border-bz-border bg-bz-surface-2 p-2.5 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="mono text-[10.5px] uppercase tracking-wider text-bz-muted">
                  {field.itemLabel} {i + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${field.itemLabel} ${i + 1}`}
                  onClick={() =>
                    onChange(items.filter((_, idx) => idx !== i))
                  }
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                >
                  <Trash2 size={12} strokeWidth={1.7} />
                </button>
              </div>
              {field.fields.map((sub) => (
                <ScalarField
                  key={sub.key}
                  field={sub}
                  value={item[sub.key]}
                  media={media}
                  onMediaAdded={onMediaAdded}
                  seeds={seeds}
                  onChange={(v) => {
                    const next = items.slice();
                    next[i] = { ...item, [sub.key]: v };
                    onChange(next);
                  }}
                  arValue={
                    typeof item[arKey(sub.key)] === "string"
                      ? (item[arKey(sub.key)] as string)
                      : ""
                  }
                  onArChange={(v) => {
                    const next = items.slice();
                    next[i] = { ...item, [arKey(sub.key)]: v };
                    onChange(next);
                  }}
                />
              ))}
            </li>
          ))}
        </ul>
        {items.length < field.max ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              onChange([
                ...items,
                Object.fromEntries(
                  field.fields.map((f) => [
                    f.key,
                    isToggleField(f)
                      ? true
                      : isImageField(f)
                        ? { media_id: null, alt: null, label: null }
                        : "",
                  ]),
                ) as Record<string, ItemValue>,
              ])
            }
          >
            <Plus size={12} strokeWidth={1.8} /> Add {field.itemLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ScalarField
      field={field}
      value={value as ItemValue}
      onChange={onChange}
      media={media}
      onMediaAdded={onMediaAdded}
      seeds={seeds}
      arValue={arValue}
      onArChange={onArChange}
    />
  );
}

export function ScalarField({
  field,
  value,
  onChange,
  media,
  onMediaAdded,
  seeds,
  arValue,
  onArChange,
}: {
  field: Exclude<FieldDef, { kind: "list" }>;
  value: ItemValue | undefined;
  onChange: (v: ItemValue) => void;
  media: MediaOption[];
  onMediaAdded: (m: MediaOption) => void;
  seeds: Seeds;
  /**
   * The Arabic twin's value and setter. Optional, so a caller with no
   * bilingual document is unaffected.
   *
   * This is the shared leaf for both a top-level field and a list item's
   * sub-fields, which is why wiring it here covers list items with no change
   * at either editor call site — the payoff for deriving twins rather than
   * declaring them.
   */
  arValue?: string;
  onArChange?: (v: string) => void;
}) {
  if (isSelectField(field)) {
    // Two option sources. `options` is a closed set declared in code (column
    // counts, banner variants) and can't go stale; `optionsKey` is a pick from
    // live records, which can be unpublished after the fact.
    const fromRecords = field.optionsKey
      ? (seeds[field.optionsKey]?.options ?? [])
      : null;
    const options =
      field.options?.map((o) => ({ value: o.value, label: o.label })) ??
      (fromRecords ?? []).map((o) => ({ value: o.slug, label: o.name }));
    const picked = typeof value === "string" ? value : "";
    const missing =
      fromRecords !== null &&
      picked !== "" &&
      !options.some((o) => o.value === picked);
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={field.label} help={field.help} />
        <select
          className={fieldCls}
          value={picked}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{field.placeholder ?? "Choose one"}</option>
          {/* A pick whose record has since been unpublished or renamed stays
              selectable, so saving doesn't silently drop it. */}
          {missing ? (
            <option value={picked}>{picked} (no longer available)</option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {missing ? (
          <span className="text-[11px] text-[oklch(0.45_0.13_28)]">
            This record isn&apos;t published any more — it won&apos;t appear on
            the page.
          </span>
        ) : null}
      </div>
    );
  }

  if (isToggleField(field)) {
    const on = value !== false;
    return (
      <label className="flex items-center gap-2 text-[12.5px] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-bz-accent"
        />
        <span className={cn(!on && "text-bz-muted")}>
          {on ? field.label : `${field.label} — hidden`}
        </span>
      </label>
    );
  }

  if (isFileField(field)) {
    const accept = field.accept ?? "application/pdf";
    const v: ImageValue =
      value && typeof value === "object"
        ? (value as ImageValue)
        : { media_id: null, alt: null, label: null };
    // Documents only. Without this the brochure picker would list every photo
    // in the library, which is a long way to scroll to find one PDF.
    const options = media.filter((m) => (m.mime ?? "").startsWith(accept));
    const picked = options.find((m) => m.id === v.media_id) ??
      media.find((m) => m.id === v.media_id);
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={field.label} help={field.help} />
        <div className="flex flex-col gap-2">
          <select
            className={fieldCls}
            value={v.media_id ?? ""}
            onChange={(e) =>
              onChange({ ...v, media_id: e.target.value || null })
            }
          >
            <option value="">— none —</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.filename}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 flex-wrap">
            <UploadButton accept={accept} label="Upload PDF" onUploaded={(m) => {
              onMediaAdded(m);
              onChange({ ...v, media_id: m.id });
            }} />
            {picked ? (
              <a
                href={picked.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
              >
                <FileText size={11} /> {picked.filename}
              </a>
            ) : null}
            {v.media_id ? (
              <button
                type="button"
                onClick={() => onChange({ ...v, media_id: null })}
                className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
              >
                <X size={11} /> Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (isVideoField(field)) {
    const v: ImageValue =
      value && typeof value === "object"
        ? (value as ImageValue)
        : { media_id: null, alt: null, label: null };
    const options = media.filter((m) => (m.mime ?? "").startsWith("video/"));
    const picked = options.find((m) => m.id === v.media_id);
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={field.label} help={field.help} />
        <div className="flex flex-col gap-2">
          <select
            className={fieldCls}
            value={v.media_id ?? ""}
            onChange={(e) =>
              onChange({ ...v, media_id: e.target.value || null })
            }
          >
            <option value="">Built-in video</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.filename}
              </option>
            ))}
          </select>
          {picked ? (
            <video
              key={picked.url}
              src={picked.url}
              muted
              loop
              playsInline
              controls
              preload="metadata"
              className="w-full max-w-[320px] rounded border border-bz-border bg-bz-surface-2"
            />
          ) : null}
          <div className="flex items-center gap-3 flex-wrap">
            <VideoUploadButton
              onUploaded={(m) => {
                onMediaAdded(m);
                onChange({ ...v, media_id: m.id });
              }}
            />
            {v.media_id ? (
              <button
                type="button"
                onClick={() => onChange({ ...v, media_id: null })}
                className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
              >
                <X size={11} /> Use the built-in video
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (isImageField(field)) {
    const v: ImageValue =
      value && typeof value === "object"
        ? (value as ImageValue)
        : { media_id: null, alt: null, label: null };
    // PDFs and video share this list now, so filter them out of the picker.
    const imageOptions = media.filter(
      (m) => !m.mime || m.mime.startsWith("image/"),
    );
    const picked = imageOptions.find((m) => m.id === v.media_id);
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={field.label} help={field.help} />
        <div className="flex items-start gap-2.5">
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
              value={v.media_id ?? ""}
              onChange={(e) =>
                onChange({ ...v, media_id: e.target.value || null })
              }
            >
              <option value="">Placeholder art</option>
              {imageOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.filename}
                </option>
              ))}
            </select>
            <input
              className={fieldCls}
              placeholder="Alt text (for screen readers)"
              value={v.alt ?? ""}
              onChange={(e) => onChange({ ...v, alt: e.target.value || null })}
            />
            <div className="flex items-center gap-3">
              <UploadButton
                onUploaded={(m) => {
                  onMediaAdded(m);
                  onChange({ ...v, media_id: m.id });
                }}
              />
              {v.media_id ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...v, media_id: null })}
                  className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
                >
                  <X size={11} /> Use placeholder instead
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Everything above returns, so only the simple text kinds reach here.
  const simple = field as SimpleFieldDef;
  const text = typeof value === "string" ? value : "";
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel
        label={simple.label}
        help={simple.help}
        count={simple.max ? `${text.length}/${simple.max}` : undefined}
      />
      {field.kind === "textarea" ? (
        <textarea
          className={cn(fieldCls, "resize-y min-h-[64px]")}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={fieldCls}
          value={text}
          placeholder={field.kind === "link" ? "/buy/search" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {onArChange && isTranslatable(field) ? (
        <ArabicTwin
          field={simple}
          value={arValue ?? ""}
          onChange={onArChange}
        />
      ) : null}
    </div>
  );
}

export function FieldLabel({
  label,
  help,
  count,
}: {
  label: string;
  help?: string;
  count?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11.5px] font-medium text-bz-ink-2">{label}</span>
      {count ? (
        <span className="mono text-[10.5px] text-bz-muted-2">{count}</span>
      ) : null}
      {help && !count ? (
        <span className="text-[10.5px] text-bz-muted-2">{help}</span>
      ) : null}
    </div>
  );
}

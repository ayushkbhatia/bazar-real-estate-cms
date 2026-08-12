"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Crop, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  LOGO_STYLES,
  LOGO_STYLE_DESCRIPTION,
  LOGO_STYLE_LABEL,
  type LogoStyle,
} from "@/lib/schemas/site-settings";
import { uploadToLibrary } from "../media/_upload-client";
import { trimTransparentPadding, type TrimResult } from "./_trim-client";

export type LogoOption = { id: string; filename: string; url: string };

/** What actually happened to the file, so the toast does not overstate it. */
function trimNote(trim: Extract<TrimResult, { status: "trimmed" }>): string {
  const padding = Math.round((1 - trim.coverage) * 100);
  const size = `Now ${trim.width}×${trim.height}.`;
  return padding >= 2
    ? `Cropped ${padding}% transparent padding. ${size}`
    : `Resized for the web. ${size}`;
}

/**
 * Shared picker behind both brand-image fields.
 *
 * Same contract as the advisor portrait picker: the settings columns are URL
 * columns rather than media ids, so this stores the asset's public URL. That
 * keeps an externally-hosted file working with no migration, and uploads still
 * land in `media_assets` (folder `brand`), so the file shows up in the library
 * and the usage index can match it back by storage key.
 */
function BrandImagePicker({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  previewClassName,
  help,
  error,
  children,
}: {
  label: string;
  value: string;
  options: LogoOption[];
  onChange: (url: string) => void;
  emptyLabel: string;
  /** Preview box geometry — a favicon is square, a lockup is not. */
  previewClassName: string;
  help: ReactNode;
  error?: string;
  /** Extra controls shown under the field once a file is chosen. */
  children?: ReactNode;
}) {
  const selectId = useId();
  const [library, setLibrary] = useState(options);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const picked = library.find((o) => o.url === value);
  const isExternal = value !== "" && !picked;

  async function store(file: File, note?: string) {
    const result = await uploadToLibrary(file, { folder: "brand" });
    if (result.status === "error") {
      toast.error(result.message);
      return false;
    }
    toast.success(
      note
        ? `Uploaded "${file.name}". ${note}`
        : `Uploaded "${file.name}" to the media library.`,
    );
    setLibrary((cur) => [
      { id: result.id, filename: file.name, url: result.url },
      ...cur,
    ]);
    onChange(result.url);
    return true;
  }

  /**
   * Brand art is exported on an artboard, so most uploads carry a wide
   * transparent margin. `object-contain` fits that whole canvas, which is what
   * makes a logo look small in a box that is not small — and for the favicon,
   * drawn by the browser at 16px, sizing cannot compensate at all. So the
   * padding comes off here, once, and every surface downstream draws ink
   * rather than air. Art that already fills its canvas is uploaded untouched.
   */
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const trim = await trimTransparentPadding(file, file.name);
    if (trim.status === "trimmed") {
      const pct = Math.round((1 - trim.coverage) * 100);
      await store(trim.file, `Trimmed ${pct}% transparent padding.`);
    } else {
      await store(file);
    }
    setBusy(false);
  }

  /** Same trim, for a file that is already in the library. */
  async function trimCurrent() {
    if (!value) return;
    setBusy(true);
    const name = picked?.filename ?? "logo.png";
    const trim = await trimTransparentPadding(value, name);
    setBusy(false);

    if (trim.status === "error") {
      toast.error(trim.message);
      return;
    }
    if (trim.status === "unchanged") {
      toast.info(
        trim.reason === "already-tight"
          ? "No transparent padding to trim — this file already fills its canvas."
          : trim.reason === "blank"
            ? "That image is fully transparent."
            : "That file is not a raster image.",
      );
      return;
    }

    setBusy(true);
    await store(trim.file, trimNote(trim));
    setBusy(false);
  }

  return (
    <div className="col-span-2">
      <Label htmlFor={selectId}>{label}</Label>
      <div className="mt-1.5 flex items-start gap-3">
        {/*
          Checkerboard behind the preview: brand art is usually a transparent
          PNG, and a white swatch on a white card hides exactly the mistake an
          operator needs to catch before saving.
        */}
        <div
          className={cn(
            "relative flex-shrink-0 overflow-hidden rounded border border-bz-border bg-bz-surface-2",
            previewClassName,
          )}
          style={{
            backgroundImage:
              "linear-gradient(45deg, rgba(128,128,128,.16) 25%, transparent 25%, transparent 75%, rgba(128,128,128,.16) 75%), linear-gradient(45deg, rgba(128,128,128,.16) 25%, transparent 25%, transparent 75%, rgba(128,128,128,.16) 75%)",
            backgroundSize: "12px 12px",
            backgroundPosition: "0 0, 6px 6px",
          }}
        >
          {value ? (
            <Image
              src={value}
              alt={picked?.filename ?? label}
              fill
              sizes="80px"
              className="object-contain p-1.5"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-center text-[10px] text-bz-muted-2">
              None
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          <select
            id={selectId}
            className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[13px]"
            value={picked?.url ?? ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{emptyLabel}</option>
            {isExternal ? (
              <option value={value}>Current file (external link)</option>
            ) : null}
            {library.map((o) => (
              <option key={o.id} value={o.url}>
                {o.filename}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink disabled:opacity-50"
            >
              <Upload size={11} strokeWidth={1.8} />
              {busy ? "Uploading…" : "Upload new"}
            </button>
            {value ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void trimCurrent()}
                  className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink disabled:opacity-50"
                  title="Crop the transparent margin off this file and save the result as a new asset."
                >
                  <Crop size={11} strokeWidth={1.8} /> Trim padding
                </button>
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
                >
                  <X size={11} /> Remove
                </button>
              </>
            ) : null}
          </div>

          <p className="text-[11px] text-bz-muted">{help}</p>

          {isExternal ? (
            <p className="text-[11px] text-bz-muted">
              This file lives outside the media library. Uploading a new one
              replaces it.
            </p>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/avif,image/jpeg"
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {error ? <p className="text-[12px] text-bz-danger mt-1">{error}</p> : null}

      {value ? children : null}
    </div>
  );
}

/** The logo that renders in the public top bar. */
export function LogoField({
  value,
  style,
  options,
  onChange,
  onStyleChange,
  error,
}: {
  value: string;
  style: LogoStyle;
  options: LogoOption[];
  onChange: (url: string) => void;
  onStyleChange: (style: LogoStyle) => void;
  error?: string;
}) {
  return (
    <BrandImagePicker
      label="Logo"
      value={value}
      options={options}
      onChange={onChange}
      emptyLabel="No logo — use the type wordmark"
      previewClassName="h-20 w-20"
      error={error}
      help={
        <>
          PNG, WebP or AVIF with a transparent background. The top bar draws it
          44px tall, so anything above ~256px on the long edge is only weight.
          Artboard padding is cropped off on upload — export it however you
          like. SVG is not accepted: the media library rejects it because an SVG
          can carry script.
        </>
      }
    >
      {/* Only meaningful once there is a logo — with none, both options render
          the same wordmark and the choice is noise. */}
      <div className="mt-3">
        <Label>Placement</Label>
        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LOGO_STYLES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onStyleChange(option)}
              aria-pressed={style === option}
              className={cn(
                "text-start rounded border px-3 py-2 transition-colors",
                style === option
                  ? "border-bz-accent bg-bz-surface-2"
                  : "border-bz-border hover:bg-bz-surface-2",
              )}
            >
              <span className="block text-[13px] text-bz-ink">
                {LOGO_STYLE_LABEL[option]}
              </span>
              <span className="block text-[11px] text-bz-muted mt-0.5">
                {LOGO_STYLE_DESCRIPTION[option]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </BrandImagePicker>
  );
}

/** The browser-tab icon. */
export function FaviconField({
  value,
  options,
  onChange,
  error,
}: {
  value: string;
  options: LogoOption[];
  onChange: (url: string) => void;
  error?: string;
}) {
  return (
    <BrandImagePicker
      label="Favicon"
      value={value}
      options={options}
      onChange={onChange}
      emptyLabel="No favicon — use the built-in default"
      previewClassName="h-20 w-20"
      error={error}
      help={
        <>
          Square PNG, 512×512 or smaller. This is read at 16px in a tab strip,
          so a full lockup turns to mud — use the mark alone. Artboard padding
          is cropped off on upload, which matters more here than anywhere: the
          browser fixes the size, so margin in the file is the one thing that
          makes a favicon small. Browsers cache favicons hard — expect to
          hard-refresh, or to see the old one for a while.
        </>
      }
    >
      {/* Tab-strip rehearsal at true size. A favicon that looks fine in the
          80px preview and illegible here is the whole failure mode. */}
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-t border border-b-0 border-bz-border bg-bz-surface-2 px-2.5 py-1.5">
          {/* Plain <img>: 16px is below every optimizer breakpoint, so
              next/image would only add a request for the same bytes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" width={16} height={16} className="size-4 object-contain" />
          <span className="text-[11px] text-bz-ink">Bazar Real Estate</span>
        </span>
        <span className="text-[11px] text-bz-muted">Tab preview, actual size</span>
      </div>
    </BrandImagePicker>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ImagePlus, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import {
  logoWarning,
  type EmailBrand,
} from "@/lib/content-assets/email-brand";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import {
  ImageInsertDialog,
  type BlogMediaOption,
} from "../../blog/_image-insert-dialog";
import {
  EmailFrame,
  InboxHeader,
  ViewportToggle,
  type EmailViewport,
} from "../emails/_email-frame";
import { previewEmailDesign, saveEmailDesign } from "../emails/_actions";

const COLOURS: { key: keyof EmailBrand; label: string; hint: string }[] = [
  { key: "buttonColor", label: "Button", hint: "Fill of every call-to-action button." },
  { key: "buttonTextColor", label: "Button text", hint: "Keep it readable on the button colour." },
  { key: "linkColor", label: "Links", hint: "Also the rule beside quoted messages." },
  { key: "textColor", label: "Text", hint: "Body copy and the wordmark." },
  { key: "mutedColor", label: "Muted text", hint: "Footer and small print." },
  { key: "backgroundColor", label: "Background", hint: "Behind the whole message." },
];

const inputCls =
  "w-full border border-bz-border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent";

/** Relative luminance, for the contrast warning on the button. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return 21;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function EmailDesignForm({
  initial,
  defaults,
  siteLogo,
  media: initialMedia,
  emails,
  initialKey,
  initialPreview,
  canWrite,
  from,
  replyTo,
}: {
  initial: EmailBrand;
  defaults: EmailBrand;
  siteLogo: { url: string; mediaKey: string | null } | null;
  media: BlogMediaOption[];
  emails: { key: string; label: string }[];
  initialKey: string;
  initialPreview: RenderedEmail;
  canWrite: boolean;
  from: string;
  replyTo: string;
}) {
  const router = useRouter();
  const [brand, setBrand] = useState<EmailBrand>(initial);
  const [saved, setSaved] = useState<EmailBrand>(initial);
  const [media, setMedia] = useState(initialMedia);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailKey, setEmailKey] = useState(initialKey);
  // Which language the preview — and the wording fields — are showing. The
  // logo and the colours have no language, so the toggle moves only the words.
  const [lang, setLang] = useState<EmailLocale>("en");
  const [preview, setPreview] = useState<RenderedEmail>(initialPreview);
  const [viewport, setViewport] = useState<EmailViewport>("desktop");
  const [rendering, setRendering] = useState(false);
  const [saving, startSave] = useTransition();
  const request = useRef(0);

  const dirty = JSON.stringify(brand) !== JSON.stringify(saved);

  useEffect(() => {
    const id = ++request.current;
    const t = window.setTimeout(async () => {
      setRendering(true);
      try {
        const next = await previewEmailDesign(emailKey, brand, lang);
        if (id === request.current && next) setPreview(next);
      } finally {
        if (id === request.current) setRendering(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [brand, emailKey, lang]);

  function set<K extends keyof EmailBrand>(key: K, value: EmailBrand[K]) {
    setBrand((b) => ({ ...b, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  const logoPreviewUrl =
    (brand.logoMediaKey
      ? media.find((m) => m.storage_key === brand.logoMediaKey)?.url
      : null) ??
    brand.logoUrl ??
    (brand.logoMediaKey && siteLogo?.mediaKey === brand.logoMediaKey ? siteLogo.url : null);
  const warning = logoWarning(logoPreviewUrl ?? null);
  const buttonContrast = contrast(brand.buttonColor, brand.buttonTextColor);

  function save() {
    setErrors({});
    startSave(async () => {
      const result = await saveEmailDesign({
        ...brand,
        logoUrl: brand.logoUrl ?? "",
      });
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      setSaved(brand);
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,660px)] gap-6 items-start">
      <div className="flex flex-col gap-5 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Wording language"
            className="inline-flex items-center rounded-md border border-bz-border bg-bz-bg p-0.5"
          >
            {(
              [
                ["en", "English"],
                ["ar", "العربية"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                lang={value}
                onClick={() => setLang(value)}
                aria-pressed={lang === value}
                className={cn(
                  "h-6 px-2.5 rounded text-[12px] transition-colors",
                  lang === value
                    ? "bg-bz-navy text-bz-bg font-medium"
                    : "text-bz-ink-2 hover:text-bz-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-bz-muted">
            The logo and the colours are one design in both languages; only the
            words have a language.
          </span>
        </div>

        <p className="text-[13px] text-bz-muted max-w-[70ch]">
          The frame around every email the site sends — all eighteen, whether
          they use Bazar&apos;s built-in wording or yours. Nothing changes until
          you save.
        </p>

        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
          <Eyebrow>Header</Eyebrow>
          <div role="radiogroup" aria-label="Header style" className="grid grid-cols-2 gap-2">
            {(
              [
                ["wordmark", "Wordmark", "The brand name set in type."],
                ["logo", "Logo image", "An image from the media library."],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={brand.headerStyle === value}
                onClick={() => set("headerStyle", value)}
                className={cn(
                  "text-start rounded-md border p-3 transition-colors",
                  brand.headerStyle === value
                    ? "border-bz-navy bg-bz-bg ring-1 ring-bz-navy"
                    : "border-bz-border hover:border-bz-border-strong",
                )}
              >
                <div className="text-[13px] font-medium">{label}</div>
                <div className="text-[11.5px] text-bz-muted mt-0.5">{hint}</div>
              </button>
            ))}
          </div>

          {brand.headerStyle === "logo" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-[72px] w-[180px] rounded border border-dashed border-bz-border flex items-center justify-center overflow-hidden" style={{ background: brand.backgroundColor }}>
                  {logoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreviewUrl} alt={brand.logoAlt} className="max-h-[60px] max-w-[160px] object-contain" />
                  ) : (
                    <span className="text-[11.5px] text-bz-muted">No logo chosen</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    <ImagePlus size={13} strokeWidth={1.8} />
                    {logoPreviewUrl ? "Change logo" : "Choose logo"}
                  </Button>
                  {siteLogo ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBrand((b) => ({
                          ...b,
                          logoMediaKey: siteLogo.mediaKey,
                          logoUrl: siteLogo.mediaKey ? null : siteLogo.url,
                        }));
                      }}
                      className="text-[12px] text-bz-ink-2 underline text-start"
                    >
                      Use the website&apos;s logo
                    </button>
                  ) : null}
                  {logoPreviewUrl ? (
                    <button
                      type="button"
                      onClick={() => setBrand((b) => ({ ...b, logoMediaKey: null, logoUrl: null }))}
                      className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink text-start"
                    >
                      <X size={11} strokeWidth={1.8} /> Remove
                    </button>
                  ) : null}
                </div>
              </div>
              {warning ? (
                <p className="flex gap-2 text-[12px] text-[oklch(0.45_0.1_60)]">
                  <AlertTriangle size={13} strokeWidth={1.8} className="shrink-0 mt-0.5" />
                  {warning}
                </p>
              ) : null}
              {!logoPreviewUrl ? (
                <p className="text-[12px] text-bz-muted">
                  Until a logo is chosen, emails keep the wordmark.
                </p>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-bz-ink-2">
                    Width · <span className="mono">{brand.logoWidth}px</span>
                  </span>
                  <input
                    type="range"
                    min={60}
                    max={320}
                    step={4}
                    value={brand.logoWidth}
                    onChange={(e) => set("logoWidth", Number(e.target.value))}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-bz-ink-2">Alt text</span>
                  <input
                    value={brand.logoAlt}
                    onChange={(e) => set("logoAlt", e.target.value)}
                    className={inputCls}
                  />
                  <span className="text-[11px] text-bz-muted">
                    Shown by inboxes that block images until asked.
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-bz-ink-2">
                  Wordmark {lang === "ar" ? "· Arabic" : "· English"}
                </span>
                <input
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  value={lang === "ar" ? brand.wordmarkAr : brand.wordmark}
                  onChange={(e) =>
                    set(lang === "ar" ? "wordmarkAr" : "wordmark", e.target.value)
                  }
                  placeholder={lang === "ar" ? defaults.wordmarkAr : defaults.wordmark}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-bz-ink-2">Beside it</span>
                <input
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  value={lang === "ar" ? brand.taglineAr : brand.tagline}
                  onChange={(e) =>
                    set(lang === "ar" ? "taglineAr" : "tagline", e.target.value)
                  }
                  placeholder={lang === "ar" ? defaults.taglineAr : defaults.tagline}
                  className={inputCls}
                />
              </label>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-[12px] font-medium text-bz-ink-2">Align</span>
            <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
              {(["left", "center"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set("headerAlign", a)}
                  aria-pressed={brand.headerAlign === a}
                  className={cn(
                    "h-6 px-2.5 rounded text-[12px] capitalize transition-colors",
                    brand.headerAlign === a ? "bg-bz-navy text-bz-bg font-medium" : "text-bz-ink-2 hover:text-bz-ink",
                  )}
                >
                  {a === "center" ? "Centre" : "Left"}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
          <Eyebrow>Colours</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            {COLOURS.map(({ key, label, hint }) => {
              const value = brand[key] as string;
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <label htmlFor={`colour-${key}`} className="text-[12px] font-medium text-bz-ink-2">
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${label} colour picker`}
                      value={/^#[0-9a-f]{6}$/i.test(value) ? value : (defaults[key] as string)}
                      onChange={(e) => set(key, e.target.value.toUpperCase() as never)}
                      className="h-8 w-10 shrink-0 cursor-pointer rounded border border-bz-border bg-bz-bg p-0.5"
                    />
                    <input
                      id={`colour-${key}`}
                      value={value}
                      onChange={(e) => set(key, e.target.value as never)}
                      className={cn(inputCls, "mono text-[12.5px]")}
                      maxLength={7}
                    />
                  </div>
                  <span className={cn("text-[11px]", errors[key] ? "text-[oklch(0.45_0.13_28)]" : "text-bz-muted")}>
                    {errors[key] || hint}
                  </span>
                </div>
              );
            })}
          </div>
          {buttonContrast < 4.5 ? (
            <p className="flex gap-2 text-[12px] text-[oklch(0.45_0.1_60)]">
              <AlertTriangle size={13} strokeWidth={1.8} className="shrink-0 mt-0.5" />
              Button text and button colour contrast is {buttonContrast.toFixed(1)}:1 — below the
              4.5:1 that keeps a button readable for everyone.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
          <Eyebrow>Footer</Eyebrow>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-bz-ink-2">Company details</span>
            <textarea
              dir={lang === "ar" ? "rtl" : "ltr"}
              value={lang === "ar" ? brand.footerTextAr : brand.footerText}
              onChange={(e) =>
                set(lang === "ar" ? "footerTextAr" : "footerText", e.target.value)
              }
              rows={3}
              placeholder={lang === "ar" ? defaults.footerTextAr : defaults.footerText}
              className={cn(inputCls, "resize-y")}
            />
            <span className="text-[11px] text-bz-muted">
              One line per line. Registered name and ORN belong here — every email carries them.
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-bz-ink-2">Link text</span>
              <input
                dir={lang === "ar" ? "rtl" : "ltr"}
                value={lang === "ar" ? brand.footerLinkLabelAr : brand.footerLinkLabel}
                onChange={(e) =>
                  set(
                    lang === "ar" ? "footerLinkLabelAr" : "footerLinkLabel",
                    e.target.value,
                  )
                }
                placeholder={
                  lang === "ar" ? defaults.footerLinkLabelAr : defaults.footerLinkLabel
                }
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-bz-ink-2">Link address</span>
              <input
                value={brand.footerLinkUrl}
                onChange={(e) => set("footerLinkUrl", e.target.value)}
                placeholder="The site's own address"
                className={cn(inputCls, "mono text-[12.5px]")}
              />
              {errors.footerLinkUrl ? (
                <span className="text-[11px] text-[oklch(0.45_0.13_28)]">{errors.footerLinkUrl}</span>
              ) : null}
            </label>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-6 min-w-0">
        <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={save} disabled={!canWrite || saving || !dirty}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.8} />}
              Save design
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setBrand(defaults)}
              disabled={JSON.stringify(brand) === JSON.stringify(defaults)}
            >
              <RotateCcw size={13} strokeWidth={1.8} />
              Bazar&apos;s original design
            </Button>
          </div>
          <p className="text-[11.5px] text-bz-muted">
            {canWrite
              ? dirty
                ? "Unsaved — the preview shows your changes; emails still send the saved design."
                : "Saved. Every email the site sends uses this design."
              : "Only an administrator can change the email design."}
          </p>
        </section>

        <section className="rounded-lg border border-bz-border bg-bz-surface-2 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-bz-border bg-bz-surface">
            <select
              value={emailKey}
              onChange={(e) => setEmailKey(e.target.value)}
              aria-label="Email to preview"
              className="h-7 border border-bz-border rounded px-2 text-[12px] bg-bz-bg max-w-[260px]"
            >
              {emails.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
            </select>
            {rendering ? <Loader2 size={12} className="animate-spin text-bz-muted" aria-label="Updating preview" /> : null}
            <div className="ms-auto">
              <ViewportToggle value={viewport} onChange={setViewport} />
            </div>
          </div>
          <InboxHeader from={from} replyTo={replyTo} to="Amira Haddad <amira@example.com>" subject={preview.subject} />
          <EmailFrame html={preview.html} viewport={viewport} title="Email design preview" className="py-4" />
        </section>
      </div>

      <ImageInsertDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        media={media}
        onUploaded={(m) => setMedia((list) => [m, ...list])}
        folder="brand"
        captionless
        onInsert={({ src, mediaKey, alt }) => {
          setBrand((b) => ({
            ...b,
            headerStyle: "logo",
            logoMediaKey: mediaKey,
            logoUrl: mediaKey ? null : src,
            logoAlt: alt || b.logoAlt,
          }));
        }}
      />
    </div>
  );
}

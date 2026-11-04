"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  ImageIcon,
  Loader2,
  Palette,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BLOCKS, blockDef, isTranslatable } from "@/lib/newsletter/blocks/catalogue";
import { PRESETS } from "@/lib/newsletter/blocks/presets";
import { BAZAR_SWATCHES } from "@/lib/newsletter/blocks/palette";
import { SETTINGS_FIELDS, blockId, newBlock } from "@/lib/newsletter/blocks/document";
import {
  BLOCK_CATEGORIES,
  type Block,
  type Design,
  type DesignSettings,
  type FieldDef,
  type ImageValue,
  type Props,
  type RecordsValue,
  type ScalarFieldDef,
} from "@/lib/newsletter/blocks/types";
import type { BlogMediaOption } from "../../blog/_image-insert-dialog";
import { uploadToLibrary } from "../../media/_upload-client";
import { mediaPublicUrl } from "@/lib/media";
import { FeatureDialog, type FeatureRequest } from "../../content-assets/emails/_feature-dialog";
import { FEATURE_KIND_META, type FeatureTarget } from "../../content-assets/emails/_feature-types";

const INPUT = "w-full border border-bz-border rounded px-2 py-1.5 text-[13px] bg-bz-bg outline-none focus:border-bz-accent disabled:opacity-60";
const LABEL = "text-[11.5px] font-medium text-bz-ink-2";

type Lang = "en" | "ar";

/**
 * The block designer: a newsletter built from the block library
 * (lib/newsletter/blocks) — add, reorder, duplicate and remove blocks, fill
 * each one's words, images, links and colours, and set the page's colours and
 * typefaces. The preview beside it is the real email, rendered by the server.
 *
 * In the Arabic tab only the words show — images, colours and links are one
 * design in both languages — each with its English beside it to translate from.
 */
export function BlockDesigner({
  design,
  onChange,
  lang,
  locked,
  media,
  onMediaUploaded,
  records,
}: {
  design: Design;
  onChange: (next: Design) => void;
  lang: Lang;
  locked: boolean;
  media: BlogMediaOption[];
  onMediaUploaded: (m: BlogMediaOption) => void;
  records: FeatureTarget[];
}) {
  const [open, setOpen] = useState<string | null>(design.blocks[0]?.id ?? null);
  const [adding, setAdding] = useState<{ after: number } | null>(null);
  const [styling, setStyling] = useState(false);

  function setBlocks(blocks: Block[]) {
    onChange({ ...design, blocks });
  }
  function updateBlock(id: string, props: Props) {
    setBlocks(design.blocks.map((b) => (b.id === id ? { ...b, props } : b)));
  }
  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= design.blocks.length) return;
    const next = [...design.blocks];
    [next[index], next[to]] = [next[to]!, next[index]!];
    setBlocks(next);
  }
  function duplicate(index: number) {
    const copy = { ...structuredClone(design.blocks[index]!), id: blockId() };
    const next = [...design.blocks];
    next.splice(index + 1, 0, copy);
    setBlocks(next);
    setOpen(copy.id);
  }
  function remove(index: number) {
    const b = design.blocks[index]!;
    if (!window.confirm(`Remove the ${blockDef(b.type)?.label.toLowerCase() ?? "block"}?`)) return;
    setBlocks(design.blocks.filter((_, i) => i !== index));
  }
  function insert(type: string, props: Props, after: number) {
    const block = newBlock(type, props);
    const next = [...design.blocks];
    next.splice(after + 1, 0, block);
    setBlocks(next);
    setOpen(block.id);
    setAdding(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {lang === "ar" ? (
        <p className="rounded-md border border-bz-border bg-bz-surface-2 px-3 py-2 text-[12px] text-bz-ink-2">
          Arabic: only the words show here, each with its English. Images, colours and links are shared by both
          editions, and the Arabic email is drawn right to left.
        </p>
      ) : null}

      {lang === "en" ? (
        <div className="rounded-md border border-bz-border bg-bz-bg">
          <button
            type="button"
            onClick={() => setStyling((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-bz-ink-2"
            aria-expanded={styling}
          >
            <Palette size={13} strokeWidth={1.8} />
            Page colours and typefaces
            {styling ? <ChevronDown size={13} className="ms-auto" /> : <ChevronRight size={13} className="ms-auto" />}
          </button>
          {styling ? (
            <SettingsEditor
              settings={design.settings}
              locked={locked}
              onChange={(settings) => onChange({ ...design, settings })}
            />
          ) : null}
        </div>
      ) : null}

      {design.blocks.length === 0 ? (
        <div className="rounded-md border border-dashed border-bz-border p-8 text-center text-[12.5px] text-bz-muted">
          No blocks yet. Add a hero, a heading, a row of features — anything from the library.
        </div>
      ) : null}

      <ol className="flex flex-col gap-2">
        {design.blocks.map((block, index) => {
          const def = blockDef(block.type);
          if (!def) return null;
          const expanded = open === block.id;
          const summary = blockSummary(block, lang);
          return (
            <li key={block.id} className={cn("rounded-md border bg-bz-surface", expanded ? "border-bz-navy" : "border-bz-border")}>
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : block.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-start py-1"
                  aria-expanded={expanded}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="mono text-[11px] text-bz-muted w-5">{index + 1}</span>
                  <span className="text-[12.5px] font-medium text-bz-ink whitespace-nowrap">{def.label}</span>
                  {summary ? <span className="text-[12px] text-bz-muted truncate">· {summary}</span> : null}
                </button>
                {!locked && lang === "en" ? (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                      <ArrowUp size={13} />
                    </IconButton>
                    <IconButton label="Move down" onClick={() => move(index, 1)} disabled={index === design.blocks.length - 1}>
                      <ArrowDown size={13} />
                    </IconButton>
                    <IconButton label="Duplicate" onClick={() => duplicate(index)}>
                      <Copy size={13} />
                    </IconButton>
                    <IconButton label="Add a block below" onClick={() => setAdding({ after: index })}>
                      <Plus size={13} />
                    </IconButton>
                    <IconButton label="Remove" onClick={() => remove(index)}>
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                ) : null}
              </div>
              {expanded ? (
                <div className="border-t border-bz-border px-3 py-3">
                  <FieldList
                    fields={def.fields}
                    props={block.props}
                    lang={lang}
                    locked={locked}
                    media={media}
                    onMediaUploaded={onMediaUploaded}
                    records={records}
                    onChange={(props) => updateBlock(block.id, props)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {!locked && lang === "en" ? (
        <Button variant="outline" onClick={() => setAdding({ after: design.blocks.length - 1 })} className="self-start">
          <Plus size={14} strokeWidth={1.8} /> Add a block
        </Button>
      ) : null}

      <BlockLibrary
        open={adding !== null}
        onClose={() => setAdding(null)}
        onPick={(type, props) => insert(type, props, adding?.after ?? design.blocks.length - 1)}
      />
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="size-7 grid place-items-center rounded text-bz-ink-2 hover:bg-bz-surface-2 hover:text-bz-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** A short line naming what a block says, for its collapsed row. */
function blockSummary(block: Block, lang: Lang): string {
  const p = block.props;
  for (const key of ["heading", "label", "text", "quote", "name", "company", "subheading", "eyebrow"]) {
    const v = lang === "ar" ? p[`${key}_ar`] || p[key] : p[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 60);
  }
  if (block.type === "records" && p.records && typeof p.records === "object") {
    const r = p.records as RecordsValue;
    return `${r.ids.length} ${FEATURE_KIND_META[r.kind].plural}`;
  }
  return "";
}

// ── The library ──────────────────────────────────────────────────

function BlockLibrary({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (type: string, props: Props) => void }) {
  const [category, setCategory] = useState<string>(BLOCK_CATEGORIES[0]);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRESETS.filter((p) => {
      const def = blockDef(p.type);
      if (!def) return false;
      if (q) return `${p.label} ${p.description} ${def.label}`.toLowerCase().includes(q);
      return def.category === category;
    });
  }, [category, query]);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of PRESETS) {
      const c = blockDef(p.type)?.category;
      if (c) out[c] = (out[c] ?? 0) + 1;
    }
    return out;
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>Add a block</DialogTitle>
          <DialogDescription>
            {`${PRESETS.length} ready-made blocks across ${BLOCKS.length} kinds. Pick one — everything in it can be changed once it's in the email.`}
          </DialogDescription>
        </DialogHeader>
        <label className="relative">
          <Search size={13} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-bz-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — hero, amenities, button, footer…"
            className={cn(INPUT, "ps-8")}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-4 min-h-[380px]">
          {!query ? (
            <nav className="flex sm:flex-col gap-1 overflow-x-auto" aria-label="Block categories">
              {BLOCK_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded px-2.5 py-1.5 text-[12.5px] text-start whitespace-nowrap",
                    category === c ? "bg-bz-navy text-bz-bg" : "text-bz-ink-2 hover:bg-bz-surface-2",
                  )}
                >
                  {c}
                  <span className={cn("mono text-[10.5px]", category === c ? "text-bz-bg/75" : "text-bz-muted")}>{counts[c] ?? 0}</span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="hidden sm:block" />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 content-start max-h-[440px] overflow-y-auto">
            {shown.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.type, p.props)}
                className="rounded-md border border-bz-border p-3 text-start hover:border-bz-navy hover:bg-bz-surface-2"
              >
                <span className="block text-[13px] font-medium text-bz-ink">{p.label}</span>
                <span className="block text-[11.5px] leading-snug text-bz-muted mt-0.5">{p.description}</span>
                <span className="block text-[10.5px] text-bz-muted-2 mt-1.5">{blockDef(p.type)?.label}</span>
              </button>
            ))}
            {shown.length === 0 ? <p className="text-[12.5px] text-bz-muted">Nothing matches.</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page settings ────────────────────────────────────────────────

function SettingsEditor({ settings, locked, onChange }: { settings: DesignSettings; locked: boolean; onChange: (s: DesignSettings) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-bz-border px-3 py-3">
      {SETTINGS_FIELDS.map((f) =>
        f.kind === "font" ? (
          <label key={f.key} className="flex flex-col gap-1">
            <span className={LABEL}>{f.label}</span>
            <select
              value={settings[f.key]}
              disabled={locked}
              onChange={(e) => onChange({ ...settings, [f.key]: e.target.value })}
              className={INPUT}
            >
              <option value="serif">Serif (Instrument Serif, Georgia)</option>
              <option value="sans">Sans serif (Geist, Helvetica)</option>
            </select>
          </label>
        ) : (
          <ColorInput
            key={f.key}
            label={f.label}
            value={settings[f.key]}
            allowBlank={false}
            locked={locked}
            onChange={(v) => onChange({ ...settings, [f.key]: v })}
          />
        ),
      )}
    </div>
  );
}

// ── Fields ───────────────────────────────────────────────────────

type FieldContext = {
  lang: Lang;
  locked: boolean;
  media: BlogMediaOption[];
  onMediaUploaded: (m: BlogMediaOption) => void;
  records: FeatureTarget[];
};

function FieldList({ fields, props, onChange, ...ctx }: FieldContext & { fields: FieldDef[]; props: Props; onChange: (p: Props) => void }) {
  const visible = ctx.lang === "ar" ? fields.filter((f) => isTranslatable(f) || f.kind === "items") : fields;
  const set = (key: string, value: unknown) => onChange({ ...props, [key]: value });
  // Pairs of short fields (colours, selects, numbers) sit two to a row.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3">
      {visible.map((f) => {
        const wide = f.kind === "text" || f.kind === "textarea" || f.kind === "items" || f.kind === "records" || f.kind === "image" || f.kind === "url";
        if (f.kind === "items" && ctx.lang === "ar" && !f.fields.some(isTranslatable)) return null;
        return (
          <div key={f.key} className={wide ? "sm:col-span-2" : undefined}>
            {f.kind === "items" ? (
              <ItemsField field={f} value={props[f.key]} onChange={(v) => set(f.key, v)} {...ctx} />
            ) : f.kind === "records" ? (
              <RecordsField value={(props[f.key] as RecordsValue | null) ?? null} onChange={(v) => set(f.key, v)} {...ctx} />
            ) : (
              <ScalarField field={f} props={props} onChange={onChange} {...ctx} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScalarField({ field: f, props, onChange, lang, locked, media, onMediaUploaded }: FieldContext & { field: ScalarFieldDef; props: Props; onChange: (p: Props) => void }) {
  const translatable = isTranslatable(f);
  const key = lang === "ar" && translatable ? `${f.key}_ar` : f.key;
  const value = props[key];
  const set = (v: unknown) => onChange({ ...props, [key]: v });
  const english = typeof props[f.key] === "string" ? (props[f.key] as string) : "";

  switch (f.kind) {
    case "text":
    case "textarea": {
      if (lang === "ar" && !english.trim()) return null;
      const common = {
        value: typeof value === "string" ? value : "",
        disabled: locked,
        dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const),
        lang,
        placeholder: lang === "ar" ? "" : f.placeholder,
        className: INPUT,
      };
      return (
        <label className="flex flex-col gap-1">
          <span className={LABEL}>{f.label}</span>
          {f.kind === "text" ? (
            <input {...common} onChange={(e) => set(e.target.value)} />
          ) : (
            <textarea {...common} rows={3} onChange={(e) => set(e.target.value)} />
          )}
          {lang === "ar" ? (
            <span className="text-[11px] text-bz-muted" dir="ltr">
              English: {english}
            </span>
          ) : f.help ? (
            <span className="text-[11px] text-bz-muted">{f.help}</span>
          ) : null}
        </label>
      );
    }
    case "url":
      return (
        <label className="flex flex-col gap-1">
          <span className={LABEL}>{f.label}</span>
          <input value={typeof value === "string" ? value : ""} disabled={locked} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} className={INPUT} dir="ltr" />
        </label>
      );
    case "color":
      return <ColorInput label={f.label} value={typeof value === "string" ? value : ""} allowBlank={f.allowBlank !== false} locked={locked} onChange={set} />;
    case "image":
      return (
        <ImageField
          label={f.label}
          help={f.help}
          value={(value as ImageValue | null) ?? null}
          locked={locked}
          media={media}
          onMediaUploaded={onMediaUploaded}
          onChange={set}
        />
      );
    case "select":
      return (
        <label className="flex flex-col gap-1">
          <span className={LABEL}>{f.label}</span>
          <select value={String(value ?? "")} disabled={locked} onChange={(e) => set(e.target.value)} className={INPUT}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "number":
      return (
        <label className="flex flex-col gap-1">
          <span className={LABEL}>
            {f.label} <span className="mono text-bz-muted">{String(value ?? "")}{f.unit ?? ""}</span>
          </span>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step ?? 1}
            value={Number(value ?? f.min)}
            disabled={locked}
            onChange={(e) => set(Number(e.target.value))}
            className="accent-bz-navy"
          />
        </label>
      );
    case "toggle":
      return (
        <label className="flex items-center gap-2 pt-5">
          <input type="checkbox" checked={value === true} disabled={locked} onChange={(e) => set(e.target.checked)} className="accent-bz-navy" />
          <span className="text-[12.5px] text-bz-ink-2">{f.label}</span>
        </label>
      );
  }
}

function ColorInput({ label, value, allowBlank, locked, onChange }: { label: string; value: string; allowBlank: boolean; locked: boolean; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const shown = draft === value || !/^#[0-9a-fA-F]{6}$/.test(draft) ? draft : value;
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          type="color"
          aria-label={`${label}: pick a colour`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
          disabled={locked}
          onChange={(e) => {
            setDraft(e.target.value.toUpperCase());
            onChange(e.target.value.toUpperCase());
          }}
          className="h-7 w-8 rounded border border-bz-border bg-bz-bg p-0.5"
        />
        <input
          value={shown}
          disabled={locked}
          placeholder={allowBlank ? "Page default" : "#003452"}
          onChange={(e) => {
            const v = e.target.value.trim();
            setDraft(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toUpperCase());
            else if (v === "" && allowBlank) onChange("");
          }}
          className={cn(INPUT, "w-[96px] mono text-[12px]")}
          dir="ltr"
        />
        <div className="flex gap-1">
          {BAZAR_SWATCHES.map((s) => (
            <button
              key={s.value}
              type="button"
              title={s.label}
              aria-label={`${label}: ${s.label}`}
              disabled={locked}
              onClick={() => {
                setDraft(s.value);
                onChange(s.value);
              }}
              className={cn("size-5 rounded-full border", value === s.value ? "border-bz-ink ring-1 ring-bz-ink" : "border-bz-border")}
              style={{ background: s.value }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageField({
  label,
  help,
  value,
  locked,
  media,
  onMediaUploaded,
  onChange,
}: {
  label: string;
  help?: string;
  value: ImageValue | null;
  locked: boolean;
  media: BlogMediaOption[];
  onMediaUploaded: (m: BlogMediaOption) => void;
  onChange: (v: ImageValue | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // The key first, as the email does: the stored URL may name another project.
  const thumb = (value?.key ? mediaPublicUrl(value.key) : "") || value?.url || "";

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const result = await uploadToLibrary(file, { folder: "brand" });
    setBusy(false);
    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    const option: BlogMediaOption = { id: result.id, filename: file.name, url: result.url, mime: result.mime, storage_key: result.storage_key };
    onMediaUploaded(option);
    onChange({ url: result.url, key: result.storage_key, alt: "" });
    toast.success(`Uploaded "${file.name}".`);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-28 shrink-0 rounded overflow-hidden border border-bz-border bg-bz-surface-2 grid place-items-center">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- a library thumbnail of any size; next/image would need every Supabase host configured
            <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <ImageIcon size={16} className="text-bz-muted" />
          )}
        </div>
        {!locked ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>
              From the library
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Upload
            </Button>
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                <X size={13} /> Clear
              </Button>
            ) : null}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        ) : null}
      </div>
      {help ? <span className="text-[11px] text-bz-muted">{help}</span> : null}
      <MediaPicker
        open={picking}
        media={media}
        onClose={() => setPicking(false)}
        onPick={(m) => {
          onChange({ url: m.url, key: m.storage_key ?? null, alt: "" });
          setPicking(false);
        }}
      />
    </div>
  );
}

function MediaPicker({ open, media, onClose, onPick }: { open: boolean; media: BlogMediaOption[]; onClose: () => void; onPick: (m: BlogMediaOption) => void }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // SVG never shows in Gmail or Outlook, so it isn't offered.
    const pool = media.filter((m) => !/svg/i.test(m.mime ?? "") && !/\.svg$/i.test(m.filename));
    return (q ? pool.filter((m) => m.filename.toLowerCase().includes(q)) : pool).slice(0, 120);
  }, [media, query]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Pick an image</DialogTitle>
          <DialogDescription>From the media library. Upload a new one from the block instead.</DialogDescription>
        </DialogHeader>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by file name" className={INPUT} />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[420px] overflow-y-auto">
          {shown.map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m)} className="group relative aspect-[4/3] rounded overflow-hidden border border-bz-border hover:border-bz-navy">
              {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnails */}
              <img src={m.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-[10px] text-white truncate opacity-0 group-hover:opacity-100">{m.filename}</span>
            </button>
          ))}
          {shown.length === 0 ? <p className="col-span-full text-[12.5px] text-bz-muted">No images match.</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemsField({ field, value, onChange, ...ctx }: FieldContext & { field: Extract<FieldDef, { kind: "items" }>; value: unknown; onChange: (v: Props[]) => void }) {
  const list = Array.isArray(value) ? (value as Props[]) : [];
  const set = (i: number, item: Props) => onChange(list.map((x, j) => (j === i ? item : x)));
  const move = (i: number, d: number) => {
    const to = i + d;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[i], next[to]] = [next[to]!, next[i]!];
    onChange(next);
  };
  const editable = !ctx.locked && ctx.lang === "en";
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>
        {field.label} <span className="text-bz-muted font-normal">· {list.length} of up to {field.max}</span>
      </span>
      <ol className="flex flex-col gap-2">
        {list.map((item, i) => (
          <li key={i} className="rounded border border-bz-border bg-bz-bg p-2.5">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[11.5px] text-bz-muted me-auto">
                {field.itemLabel} {i + 1}
              </span>
              {editable ? (
                <>
                  <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp size={12} />
                  </IconButton>
                  <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === list.length - 1}>
                    <ArrowDown size={12} />
                  </IconButton>
                  <IconButton label={`Remove ${field.itemLabel.toLowerCase()}`} onClick={() => onChange(list.filter((_, j) => j !== i))} disabled={list.length <= field.min}>
                    <Trash2 size={12} />
                  </IconButton>
                </>
              ) : null}
            </div>
            <FieldList fields={field.fields} props={item} onChange={(p) => set(i, p)} {...ctx} />
          </li>
        ))}
      </ol>
      {editable && list.length < field.max ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => onChange([...list, Object.fromEntries(field.fields.map((f) => [f.key, f.kind === "image" ? null : f.kind === "toggle" ? false : f.kind === "select" ? f.options[0]?.value : ""]))])}
        >
          <Plus size={13} /> Add {field.itemLabel.toLowerCase()}
        </Button>
      ) : null}
    </div>
  );
}

function RecordsField({ value, onChange, records, locked, lang }: FieldContext & { value: RecordsValue | null; onChange: (v: RecordsValue | null) => void }) {
  const [request, setRequest] = useState<FeatureRequest | null>(null);
  if (lang === "ar") {
    return <p className="text-[12px] text-bz-muted">Featured cards draw themselves in Arabic — nothing to translate.</p>;
  }
  const names = value ? value.ids.map((id, i) => records.find((r) => r.kind === value.kind && r.id === id)?.name ?? value.labels[i] ?? id) : [];
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>What to feature</span>
      {value ? (
        <p className="text-[12.5px] text-bz-ink-2">
          {value.ids.length} {FEATURE_KIND_META[value.kind].plural} as {value.layout === "card" ? "cards" : value.layout}: {names.join(", ")}
        </p>
      ) : (
        <p className="text-[12.5px] text-bz-muted">Nothing picked yet — the block is left out until you do.</p>
      )}
      {!locked ? (
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setRequest({ pos: null, initial: value })}>
          {value ? "Change" : "Pick listings, projects or articles"}
        </Button>
      ) : null}
      <FeatureDialog
        request={request}
        targets={records}
        onClose={() => setRequest(null)}
        onChoose={(choice) => {
          onChange({ kind: choice.kind, ids: choice.ids, labels: choice.labels, layout: choice.layout });
          setRequest(null);
        }}
      />
    </div>
  );
}

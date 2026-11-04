/**
 * A block design from loose JSON to something safe to store and render, and
 * the questions asked of one: which records it features, which Arabic is
 * missing, what would stop it sending.
 *
 * `normaliseDesign` is the save boundary (and runs again at render): unknown
 * blocks dropped, every value checked against its field — colours are hex,
 * selects are one of their options, numbers clamped, images on https or the
 * media library, texts capped — so whatever reaches the renderer is a value
 * it expects. Pure; the designer imports it on the client.
 */

import { featureAttrs, normaliseFeatureBlock, type EmailFeatureBlock } from "@/lib/content-assets/email-feature";
import { BLOCKS, blockDef, isTranslatable } from "./catalogue";
import { BAZAR } from "./palette";
import type { Block, BlockDef, Design, DesignSettings, FieldDef, ImageValue, Props, ScalarFieldDef } from "./types";
import { FONT_CHOICES } from "./types";

export const MAX_BLOCKS = 60;
const TEXT_MAX = 300;
const TEXTAREA_MAX = 4000;

export const DEFAULT_SETTINGS: DesignSettings = {
  pageBackground: BAZAR.page,
  contentBackground: BAZAR.white,
  textColor: BAZAR.ink,
  headingColor: BAZAR.navy,
  mutedColor: BAZAR.muted,
  linkColor: BAZAR.teal,
  buttonColor: BAZAR.navy,
  buttonTextColor: BAZAR.white,
  headingFont: "serif",
  bodyFont: "sans",
};

export const SETTINGS_FIELDS: { key: keyof DesignSettings; label: string; kind: "color" | "font" }[] = [
  { key: "pageBackground", label: "Behind the email", kind: "color" },
  { key: "contentBackground", label: "Email background", kind: "color" },
  { key: "textColor", label: "Text", kind: "color" },
  { key: "headingColor", label: "Headings", kind: "color" },
  { key: "mutedColor", label: "Small print", kind: "color" },
  { key: "linkColor", label: "Links", kind: "color" },
  { key: "buttonColor", label: "Buttons", kind: "color" },
  { key: "buttonTextColor", label: "Button text", kind: "color" },
  { key: "headingFont", label: "Heading typeface", kind: "font" },
  { key: "bodyFont", label: "Body typeface", kind: "font" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
/** A media key as lib/media.ts mints it (same shape email-brand trusts). */
const MEDIA_KEY = /^(brand|blog|listings|team)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/;

export function emptyDesign(): Design {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, blocks: [] };
}

/** A short id, unique enough inside one design. */
export function blockId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // Control characters out (line breaks stay, for textareas).
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
}

function cleanImage(v: unknown): ImageValue | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const key = typeof o.key === "string" && MEDIA_KEY.test(o.key) ? o.key : null;
  const url = typeof o.url === "string" && /^https:\/\/[^\s"'<>]+$/.test(o.url.trim()) ? o.url.trim().slice(0, 1000) : "";
  if (!key && !url) return null;
  return { url, key, alt: str(o.alt, TEXT_MAX) };
}

function cleanScalar(f: ScalarFieldDef, v: unknown, fallback: unknown): unknown {
  switch (f.kind) {
    case "text":
      return typeof v === "string" ? str(v, f.max ?? TEXT_MAX).replace(/[\r\n]+/g, " ") : (fallback ?? "");
    case "textarea":
      return typeof v === "string" ? str(v, f.max ?? TEXTAREA_MAX).replace(/\r\n?/g, "\n") : (fallback ?? "");
    case "url":
      return typeof v === "string" ? str(v, 1000).trim() : (fallback ?? "");
    case "color": {
      if (typeof v === "string" && HEX.test(v.trim())) return v.trim().toUpperCase();
      if (v === "" && f.allowBlank) return "";
      return typeof fallback === "string" ? fallback : "";
    }
    case "image":
      return v === undefined ? (fallback ?? null) : cleanImage(v);
    case "select":
      return f.options.some((o) => o.value === v) ? v : (fallback ?? f.options[0]?.value);
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return fallback ?? f.min;
      return Math.min(f.max, Math.max(f.min, Math.round(n)));
    }
    case "toggle":
      return typeof v === "boolean" ? v : Boolean(fallback);
  }
}

function cleanRecords(v: unknown): EmailFeatureBlock | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return normaliseFeatureBlock({
    kind: o.kind,
    ids: Array.isArray(o.ids) ? o.ids : [],
    layout: o.layout,
    labels: Array.isArray(o.labels) ? o.labels : [],
  });
}

/** One field's value (and its Arabic twin) into `out`. */
function cleanField(f: FieldDef, raw: Props, defaults: Props, out: Props): void {
  if (f.kind === "items") {
    const list = Array.isArray(raw[f.key]) ? (raw[f.key] as unknown[]) : (defaults[f.key] as unknown[] | undefined) ?? [];
    out[f.key] = list.slice(0, f.max).map((item) => {
      const src = item && typeof item === "object" ? (item as Props) : {};
      const clean: Props = {};
      for (const sub of f.fields) cleanField(sub, src, {}, clean);
      return clean;
    });
    return;
  }
  if (f.kind === "records") {
    out[f.key] = cleanRecords(raw[f.key]);
    return;
  }
  out[f.key] = cleanScalar(f, raw[f.key], defaults[f.key]);
  if (isTranslatable(f)) {
    const ar = cleanScalar(f, raw[`${f.key}_ar`], "");
    if (ar) out[`${f.key}_ar`] = ar;
  }
}

/** A block's props from loose input, over the block's defaults. */
export function normaliseProps(def: BlockDef, raw: Props): Props {
  const out: Props = {};
  for (const f of def.fields) cleanField(f, raw, def.defaults, out);
  return out;
}

export function normaliseSettings(raw: unknown): DesignSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof DesignSettings)[]) {
    const v = src[key];
    if (key === "headingFont" || key === "bodyFont") {
      if ((FONT_CHOICES as readonly unknown[]).includes(v)) out[key] = v as DesignSettings["headingFont"];
    } else if (typeof v === "string" && HEX.test(v.trim())) {
      out[key] = v.trim().toUpperCase();
    }
  }
  return out;
}

/** Loose JSON → a design the renderer can trust. Null input is an empty design. */
export function normaliseDesign(raw: unknown): Design {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const blocks: Block[] = [];
  for (const b of Array.isArray(src.blocks) ? src.blocks : []) {
    if (blocks.length >= MAX_BLOCKS) break;
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const def = typeof o.type === "string" ? blockDef(o.type) : undefined;
    if (!def) continue;
    let id = typeof o.id === "string" && /^[a-z0-9-]{1,40}$/i.test(o.id) ? o.id : blockId();
    while (seen.has(id)) id = blockId();
    seen.add(id);
    blocks.push({ id, type: def.type, props: normaliseProps(def, o.props && typeof o.props === "object" ? (o.props as Props) : {}) });
  }
  return { version: 1, settings: normaliseSettings(src.settings), blocks };
}

/** A new block of `type`, its defaults under `props`. */
export function newBlock(type: string, props: Props = {}): Block {
  const def = blockDef(type);
  if (!def) throw new Error(`Unknown block type ${type}`);
  return { id: blockId(), type, props: normaliseProps(def, { ...structuredClone(def.defaults), ...structuredClone(props) }) };
}

/** A value in the edition being drawn: the Arabic twin, or the English while it's blank. */
export function localText(props: Props, key: string, locale: "en" | "ar"): string {
  const en = typeof props[key] === "string" ? (props[key] as string) : "";
  if (locale !== "ar") return en;
  const ar = props[`${key}_ar`];
  return typeof ar === "string" && ar.trim() ? ar : en;
}

/** Every featured-records block, as the stored tag the rich-text newsletter uses — what the feature lookup reads. */
export function designFeatureBlocks(design: Design): EmailFeatureBlock[] {
  return design.blocks
    .filter((b) => b.type === "records")
    .map((b) => cleanRecords(b.props.records))
    .filter((r): r is EmailFeatureBlock => r !== null);
}

/** The featured blocks as the HTML the shared feature lookup (lib/newsletter/features.ts) reads records out of. */
export function designFeatureHtml(design: Design | null | undefined): string {
  if (!design) return "";
  return designFeatureBlocks(design)
    .map((b) => {
      const attrs = Object.entries(featureAttrs(b))
        .map(([k, v]) => `${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
        .join(" ");
      return `<div ${attrs}></div>`;
    })
    .join("");
}

export type TextSlot = {
  blockId: string;
  blockLabel: string;
  /** Path to the value in the block's props: ["heading"] or ["items", 2, "title"]. */
  path: (string | number)[];
  label: string;
  kind: "text" | "textarea";
  en: string;
  ar: string;
};

/** Every translatable text with English in it, and its Arabic — for the translator and the completeness check. */
export function textSlots(design: Design): TextSlot[] {
  const out: TextSlot[] = [];
  design.blocks.forEach((b, index) => {
    const def = blockDef(b.type);
    if (!def) return;
    const blockLabel = `${index + 1}. ${def.label}`;
    const visit = (fields: FieldDef[], props: Props, prefix: (string | number)[], itemLabel?: string) => {
      for (const f of fields) {
        if (f.kind === "items") {
          const items = Array.isArray(props[f.key]) ? (props[f.key] as Props[]) : [];
          items.forEach((item, i) => visit(f.fields, item, [...prefix, f.key, i], `${f.itemLabel} ${i + 1}`));
          continue;
        }
        if (!isTranslatable(f) || (f.kind !== "text" && f.kind !== "textarea")) continue;
        const en = typeof props[f.key] === "string" ? (props[f.key] as string).trim() : "";
        if (!en) continue;
        // A field whose block hides it isn't read: the hero's custom logo, a button with no link.
        out.push({
          blockId: b.id,
          blockLabel,
          path: [...prefix, f.key],
          label: itemLabel ? `${itemLabel} › ${f.label}` : f.label,
          kind: f.kind,
          en,
          ar: typeof props[`${f.key}_ar`] === "string" ? (props[`${f.key}_ar`] as string).trim() : "",
        });
      }
    };
    visit(def.fields, b.props, []);
  });
  return out;
}

/** The design with `ar` written into each slot's twin (a translation, or a copy of the English). */
export function withArabic(design: Design, values: Map<TextSlot, string>): Design {
  const next = structuredClone(design);
  for (const [slot, value] of values) {
    const block = next.blocks.find((b) => b.id === slot.blockId);
    if (!block) continue;
    let target: Props = block.props;
    for (const step of slot.path.slice(0, -1)) target = (target as Record<string | number, unknown>)[step] as Props;
    if (target) target[`${slot.path[slot.path.length - 1]}_ar`] = value;
  }
  return next;
}

/** Arabic twins cleared — for "start the Arabic again". */
export function withoutArabic(design: Design): Design {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Props)
          .filter(([k]) => !k.endsWith("_ar"))
          .map(([k, x]) => [k, strip(x)]),
      );
    }
    return v;
  };
  return { ...design, blocks: design.blocks.map((b) => ({ ...b, props: strip(b.props) as Props })) };
}

/** Every link field's value, with where it is — for the "links that go nowhere" check. */
export function linkSlots(design: Design): { blockLabel: string; label: string; value: string }[] {
  const out: { blockLabel: string; label: string; value: string }[] = [];
  design.blocks.forEach((b, index) => {
    const def = blockDef(b.type);
    if (!def) return;
    const blockLabel = `${index + 1}. ${def.label}`;
    const visit = (fields: FieldDef[], props: Props, itemLabel?: string) => {
      for (const f of fields) {
        if (f.kind === "items") {
          ((props[f.key] as Props[] | undefined) ?? []).forEach((item, i) => visit(f.fields, item, `${f.itemLabel} ${i + 1}`));
        } else if (f.kind === "url") {
          const value = typeof props[f.key] === "string" ? (props[f.key] as string).trim() : "";
          if (value) out.push({ blockLabel, label: itemLabel ? `${itemLabel} › ${f.label}` : f.label, value });
        }
      }
    };
    visit(def.fields, b.props);
  });
  return out;
}

/**
 * Whether a link field holds something an inbox may follow: https/http,
 * mailto:, tel:, a page on the site, or a {{token}}. The renderer draws
 * anything else as plain text; this is the check that says so while writing.
 */
export function isUsableLink(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true;
  if (/^\{\{\s*[a-z_]+\s*\}\}/.test(v)) return true;
  return /^(https?:\/\/|mailto:|tel:)[^\s"'<>]+$/i.test(v) || /^\/(?!\/)[^\s"'<>]*$/.test(v);
}

/** A bracketed placeholder a template left — "[Write …]" — still unreplaced. Markdown links don't count. */
export function placeholderIn(text: string): boolean {
  return /\[(?:Write|اكتب)[^\]]*\](?!\()/.test(text);
}

/** Re-exported so callers needn't know where the catalogue lives. */
export { BLOCKS, blockDef };

/**
 * A block design → the email: HTML an inbox can draw, and its plain text.
 *
 * Email HTML is its own dialect. Everything here is tables and inline styles;
 * the one <style> element only stacks columns on a phone (clients that drop
 * it show the desktop layout, which still reads). The column is 600px wide,
 * each block a full-width row with its own background, so a band of colour
 * runs edge to edge of the email the way a launch mailer's does.
 *
 * Arabic: the whole document is `dir="rtl"`, on <html>, <body> and every
 * table (Outlook.com strips it from the document), in fonts the recipient
 * already has; "start" and "end" turn round; nothing Arabic is letter-spaced
 * or upper-cased (spacing breaks the joins between letters).
 *
 * Every value reaching HTML is escaped here; links go through `href`, which
 * allows https, http, mailto, tel, a page on the site, or a {{token}} — and
 * nothing else, so a stored `javascript:` is drawn as plain text.
 */

import { emailLogoUrl, escapeEmailHtml as esc } from "@/lib/email-templates";
import { mediaPublicUrl } from "@/lib/media";
import { emailImageUrl, isMediaKey, type EmailImageOptions } from "@/lib/newsletter/email-image";
import type { EmailBrand } from "@/lib/content-assets/email-brand";
import type { EmailFeatureBlock } from "@/lib/content-assets/email-feature";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import { SOCIAL_NETWORKS } from "./catalogue";
import { localText, normaliseDesign } from "./document";
import type { Block, Design, DesignSettings, ImageValue, Props } from "./types";

export type DesignRenderContext = {
  locale: EmailLocale;
  brand: EmailBrand;
  /** The site's address, no trailing slash: page links and the icons are built on it. */
  siteUrl: string;
  /** {{token}} values — the newsletter's site links and this reader's unsubscribe link. */
  values: Record<string, string>;
  subject: string;
  /** Draws a featured-records block in this edition; without it the block is left out. */
  features?: (block: EmailFeatureBlock) => { html: string; text: string } | null;
  /** The newsletter's own footer (the unsubscribe line), drawn under the last block whatever the design says. */
  footer: { html: string; text: string };
};

export type RenderedDesign = { html: string; text: string };

const COLUMN = 600;
const GUTTER = 40;
const INNER = COLUMN - GUTTER * 2;

const AR_FONT = "'IBM Plex Sans Arabic','Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";
const FONTS = {
  serif: "'Instrument Serif',Georgia,'Times New Roman',serif",
  sans: "Geist,'Helvetica Neue',Helvetica,Arial,sans-serif",
} as const;
const PAD: Record<string, number> = { none: 0, s: 16, m: 32, l: 52 };
const HEADING_PX: Record<string, number> = { s: 20, m: 26, l: 32, xl: 42 };

type Ctx = DesignRenderContext & {
  settings: DesignSettings;
  rtl: boolean;
  text: string[];
};

// ── Small helpers ───────────────────────────────────────────────

function fill(s: string, values: Record<string, string>): string {
  return s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, name: string) => values[name] ?? m);
}

/** A link field's value as an address an inbox may follow, or null. */
export function href(raw: unknown, ctx: Pick<Ctx, "values" | "siteUrl" | "locale">): string | null {
  if (typeof raw !== "string") return null;
  const value = fill(raw.trim(), ctx.values);
  if (!value) return null;
  if (/^(https?:\/\/|mailto:|tel:)[^\s"'<>]+$/i.test(value)) return value;
  if (/^\/(?!\/)[^\s"'<>]*$/.test(value)) {
    const keep = ctx.locale !== "ar" || /^\/(ar(\/|$|[?#])|api\/|_next\/)/.test(value);
    return `${ctx.siteUrl}${keep ? value : `/ar${value === "/" ? "" : value}`}`;
  }
  return null;
}

/**
 * An image field's address. With a size, a media-library image goes through
 * the email image route — resized, re-encoded, cropped or tinted as asked
 * (lib/newsletter/email-image.ts); without one, or with no key, the stored
 * original.
 */
function imageUrl(v: unknown, ctx?: Pick<Ctx, "siteUrl">, size?: EmailImageOptions): string {
  if (!v || typeof v !== "object") return "";
  const img = v as ImageValue;
  if (img.key && ctx && size && isMediaKey(img.key) && mediaPublicUrl(img.key)) {
    return emailImageUrl(ctx.siteUrl, img.key, size);
  }
  return (img.key ? mediaPublicUrl(img.key) : "") || img.url || "";
}

function str(props: Props, key: string): string {
  return typeof props[key] === "string" ? (props[key] as string) : "";
}

/** Escaped, tokens filled, **bold**, [links](…) and line breaks — a paragraph's inline text. */
function inline(raw: string, ctx: Ctx, linkColor: string): string {
  let s = esc(raw);
  s = s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, name: string) => (name in ctx.values ? esc(ctx.values[name]!) : m));
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, target: string) => {
    const to = href(target.replace(/&amp;/g, "&"), ctx);
    return to ? `<a href="${esc(to)}" style="color:${linkColor};text-decoration:underline">${label}</a>` : label;
  });
  return s.replace(/\n/g, "<br>");
}

/** The same text as a reader of the plain-text part sees it. */
function plain(raw: string, ctx: Ctx): string {
  return fill(raw, ctx.values)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, target: string) => {
      const to = href(target, ctx);
      return to ? `${label} (${to})` : label;
    });
}

function paragraphs(raw: string, ctx: Ctx, style: string, linkColor: string): string {
  const list = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return list
    .map((p, i) => `<p style="margin:0 0 ${i === list.length - 1 ? 0 : 14}px 0;${style}">${inline(p, ctx, linkColor)}</p>`)
    .join("");
}

function font(ctx: Ctx, which: "heading" | "body" | "serif" | "sans"): string {
  if (ctx.rtl) return AR_FONT;
  const choice = which === "heading" ? ctx.settings.headingFont : which === "body" ? ctx.settings.bodyFont : which;
  return FONTS[choice];
}

function alignOf(v: unknown, ctx: Ctx): "left" | "center" | "right" {
  if (v === "center") return "center";
  const start = ctx.rtl ? "right" : "left";
  const end = ctx.rtl ? "left" : "right";
  return v === "end" ? end : start;
}

function color(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : fallback;
}

function rgba(hex: string, opacity: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, opacity)).toFixed(2)})`;
}

/** Light icons on a light ink (a dark band), dark ones otherwise. */
function iconTone(ink: string): "light" | "dark" {
  const n = Number.parseInt(ink.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6 ? "light" : "dark";
}

const dirAttr = (ctx: Ctx) => `dir="${ctx.rtl ? "rtl" : "ltr"}"`;
const TABLE = 'role="presentation" cellspacing="0" cellpadding="0" border="0"';

/** One block's row: full width, its own background and vertical padding. */
function row(inner: string, props: Props, ctx: Ctx, opts: { gutter?: boolean; padding?: number } = {}): string {
  const bg = color(props.background, "");
  const pad = opts.padding ?? PAD[String(props.padding ?? "m")] ?? 32;
  const gutter = opts.gutter === false ? 0 : GUTTER;
  return `<tr><td class="${gutter ? "px" : ""}" ${dirAttr(ctx)}${bg ? ` bgcolor="${bg}"` : ""} style="${bg ? `background:${bg};` : ""}padding:${pad}px ${gutter}px">${inner}</td></tr>`;
}

function eyebrow(text: string, ctx: Ctx, align: string, ink: string): string {
  if (!text) return "";
  ctx.text.push(text.toUpperCase());
  const style = ctx.rtl
    ? `font-family:${AR_FONT};font-size:13px;font-weight:600`
    : `font-family:${FONTS.sans};font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase`;
  return `<p style="margin:0 0 10px 0;${style};color:${ink};text-align:${align}">${inline(text, ctx, ink)}</p>`;
}

function headingHtml(text: string, ctx: Ctx, o: { size: unknown; align: string; ink: string; font?: unknown; cls?: string; level?: 1 | 2 }): string {
  if (!text) return "";
  ctx.text.push(text);
  const px = HEADING_PX[String(o.size)] ?? 26;
  const which = o.font === "serif" || o.font === "sans" ? o.font : "heading";
  const family = font(ctx, which);
  const serif = !ctx.rtl && family === FONTS.serif;
  const weight = ctx.rtl ? 700 : serif ? 400 : 600;
  const size = ctx.rtl ? Math.round(px * 0.82) : px;
  const tag = o.level === 1 ? "h1" : "h2";
  return `<${tag}${o.cls ? ` class="${o.cls}"` : ""} style="margin:0 0 12px 0;font-family:${family};font-size:${size}px;line-height:1.2;font-weight:${weight};color:${o.ink};text-align:${o.align}${serif ? ";letter-spacing:-0.01em" : ""}">${inline(text, ctx, o.ink)}</${tag}>`;
}

function bodyStyle(ctx: Ctx, ink: string, align: string, size = 15): string {
  return `font-family:${font(ctx, "body")};font-size:${ctx.rtl ? size + 1 : size}px;line-height:${ctx.rtl ? 1.8 : 1.6};color:${ink};text-align:${align}`;
}

type ButtonSpec = { label: string; url: unknown; fill: string; ink: string; style: unknown; shape?: unknown; fullWidth?: boolean; align: string };

function button(b: ButtonSpec, ctx: Ctx): string {
  const to = href(b.url, ctx);
  if (!b.label || !to) return "";
  ctx.text.push(`${plain(b.label, ctx)}: ${to}`);
  const label = inline(b.label, ctx, b.ink);
  if (b.style === "link") {
    const arrow = ctx.rtl ? "&larr;" : "&rarr;";
    return `<p style="margin:0;text-align:${b.align}"><a href="${esc(to)}" style="font-family:${font(ctx, "body")};font-size:14px;font-weight:600;color:${b.fill};text-decoration:none;border-bottom:1px solid ${b.fill}">${label} ${arrow}</a></p>`;
  }
  const radius = b.shape === "pill" ? 999 : b.shape === "rounded" ? 6 : 0;
  const outline = b.style === "outline";
  const bg = outline ? "transparent" : b.fill;
  const ink = outline ? b.fill : b.ink;
  const type = ctx.rtl
    ? `font-family:${AR_FONT};font-size:14px;font-weight:600`
    : `font-family:${FONTS.sans};font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase`;
  const width = b.fullWidth ? ' width="100%"' : "";
  return `<table ${TABLE} ${dirAttr(ctx)} align="${b.align}"${width} style="margin:${b.align === "center" ? "0 auto" : "0"}"><tr><td align="center"${outline ? "" : ` bgcolor="${bg}"`} style="background:${bg};border-radius:${radius}px;border:1px solid ${b.fill}"><a href="${esc(to)}" style="display:${b.fullWidth ? "block" : "inline-block"};padding:14px 30px;${type};line-height:1.2;color:${ink};text-decoration:none;border-radius:${radius}px">${label}</a></td></tr></table>`;
}

function blockButton(props: Props, ctx: Ctx, align: string, prefix = "button"): string {
  return button(
    {
      label: localText(props, `${prefix}Label`, ctx.locale),
      url: props[`${prefix}Url`],
      fill: color(props[`${prefix}Color`], ctx.settings.buttonColor),
      ink: color(props[`${prefix}TextColor`], ctx.settings.buttonTextColor),
      style: props[`${prefix}Style`] ?? "solid",
      align,
    },
    ctx,
  );
}

function img(v: unknown, alt: string, width: number, ctx: Ctx, o: { rounded?: boolean; link?: unknown; cls?: string } = {}): string {
  const src = imageUrl(v, ctx, { width });
  if (!src) return "";
  const tag = `<img src="${esc(src)}" alt="${esc(alt)}" width="${width}"${o.cls ? ` class="${o.cls}"` : ""} style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none${o.rounded ? ";border-radius:8px" : ""}">`;
  const to = href(o.link, ctx);
  return to ? `<a href="${esc(to)}" style="text-decoration:none">${tag}</a>` : tag;
}

/** Columns that sit side by side on a desktop and stack on a phone. */
function columns(cells: string[], ctx: Ctx, o: { gap?: number; dividers?: string; valign?: string } = {}): string {
  const gap = o.gap ?? 20;
  const width = Math.floor(100 / cells.length);
  const start = ctx.rtl ? "right" : "left";
  const end = ctx.rtl ? "left" : "right";
  const tds = cells
    .map((cell, i) => {
      const divider = o.dividers && i > 0 ? `border-${start}:1px solid ${o.dividers};` : "";
      // Half the gap on each inner edge; the outer edges sit on the block's own margin.
      const pad = `padding-${start}:${i === 0 ? 0 : gap / 2}px;padding-${end}:${i === cells.length - 1 ? 0 : gap / 2}px`;
      return `<td class="col col-gap" width="${width}%" valign="${o.valign ?? "top"}" ${dirAttr(ctx)} style="${divider}${pad};width:${width}%">${cell}</td>`;
    })
    .join("");
  return `<table ${TABLE} ${dirAttr(ctx)} width="100%" style="table-layout:fixed;width:100%"><tr>${tds}</tr></table>`;
}

function items(props: Props, key = "items"): Props[] {
  return Array.isArray(props[key]) ? (props[key] as Props[]) : [];
}

// ── The blocks ──────────────────────────────────────────────────

type Drawer = (props: Props, ctx: Ctx) => string;

const DRAW: Record<string, Drawer> = {
  hero(p, ctx) {
    const src = imageUrl(p.image, ctx, { width: COLUMN });
    const overlay = color(p.overlayColor, "#003452");
    const strength = Number(p.overlayOpacity ?? 35) / 100;
    const ink = color(p.textColor, "#FFFFFF");
    const align = alignOf(p.align, ctx);
    const pad = { s: 48, m: 88, l: 140 }[String(p.height)] ?? 88;
    const bg = src
      ? `background-color:${overlay};background-image:url('${esc(src)}');background-image:linear-gradient(${rgba(overlay, strength)},${rgba(overlay, strength)}),url('${esc(src)}');background-size:cover;background-position:center;`
      : `background:${overlay};`;
    const logo = heroLogo(p, ctx, align);
    const cta = blockButton(p, ctx, align);
    const body = [
      logo,
      eyebrow(localText(p, "eyebrow", ctx.locale), ctx, align, ink),
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: "xl", align, ink, cls: "hero-h", level: 1 }),
      headingHtml(localText(p, "subheading", ctx.locale), ctx, { size: "m", align, ink }),
      localText(p, "text", ctx.locale)
        ? (ctx.text.push(plain(localText(p, "text", ctx.locale), ctx)), paragraphs(localText(p, "text", ctx.locale), ctx, bodyStyle(ctx, ink, align, 16), ink))
        : "",
      cta ? `<div style="height:22px;line-height:22px">&nbsp;</div>${cta}` : "",
      localText(p, "note", ctx.locale)
        ? `<p style="margin:28px 0 0 0;${bodyStyle(ctx, ink, align, 11)};opacity:0.85">${inline(localText(p, "note", ctx.locale), ctx, ink)}</p>`
        : "",
    ].join("");
    return `<tr><td class="px" ${dirAttr(ctx)} align="${align}" valign="middle"${src ? ` background="${esc(src)}"` : ""} bgcolor="${overlay}" style="${bg}padding:${pad}px ${GUTTER}px;text-align:${align}">${body}</td></tr>`;
  },

  logo(p, ctx) {
    const align = alignOf(p.align, ctx);
    const ink = color(p.textColor, ctx.settings.mutedColor);
    const logo = logoImg(p, ctx, align);
    const label = localText(p, "linkLabel", ctx.locale);
    const to = href(p.linkUrl, ctx);
    if (!label || !to) return row(`<div style="text-align:${align}">${logo}</div>`, p, ctx);
    ctx.text.push(`${plain(label, ctx)}: ${to}`);
    const link = `<a href="${esc(to)}" style="font-family:${font(ctx, "sans")};font-size:12px;color:${ink};text-decoration:underline">${inline(label, ctx, ink)}</a>`;
    return row(
      `<table ${TABLE} ${dirAttr(ctx)} width="100%"><tr><td valign="middle" style="text-align:${ctx.rtl ? "right" : "left"}">${logo}</td><td valign="middle" style="text-align:${ctx.rtl ? "left" : "right"}">${link}</td></tr></table>`,
      p,
      ctx,
    );
  },

  heading(p, ctx) {
    const align = alignOf(p.align, ctx);
    const ink = color(p.textColor, ctx.settings.headingColor);
    return row(
      eyebrow(localText(p, "eyebrow", ctx.locale), ctx, align, color(p.textColor, ctx.settings.mutedColor)) +
        headingHtml(localText(p, "heading", ctx.locale), ctx, { size: p.size, align, ink, font: p.font }).replace("margin:0 0 12px 0", "margin:0"),
      p,
      ctx,
    );
  },

  text(p, ctx) {
    const value = localText(p, "text", ctx.locale);
    if (!value) return "";
    ctx.text.push(plain(value, ctx));
    const size = { s: 13, m: 15, l: 18 }[String(p.size)] ?? 15;
    return row(paragraphs(value, ctx, bodyStyle(ctx, color(p.textColor, ctx.settings.textColor), alignOf(p.align, ctx), size), ctx.settings.linkColor), p, ctx);
  },

  section(p, ctx) {
    const align = alignOf(p.align, ctx);
    const ink = color(p.textColor, ctx.settings.textColor);
    const value = localText(p, "text", ctx.locale);
    const head =
      eyebrow(localText(p, "eyebrow", ctx.locale), ctx, align, color(p.textColor, ctx.settings.mutedColor)) +
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: p.size, align, ink: color(p.textColor, ctx.settings.headingColor) });
    if (value) ctx.text.push(plain(value, ctx));
    const cta = blockButton(p, ctx, align);
    return row(
      head +
        (value ? paragraphs(value, ctx, bodyStyle(ctx, ink, align), ctx.settings.linkColor) : "") +
        (cta ? `<div style="height:24px;line-height:24px">&nbsp;</div>${cta}` : ""),
      p,
      ctx,
    );
  },

  quote(p, ctx) {
    const align = alignOf(p.align, ctx);
    const ink = color(p.textColor, ctx.settings.headingColor);
    const quote = localText(p, "quote", ctx.locale);
    if (!quote) return "";
    const open = ctx.rtl ? "&laquo;" : "&ldquo;";
    const close = ctx.rtl ? "&raquo;" : "&rdquo;";
    ctx.text.push(`“${plain(quote, ctx)}”`);
    const portrait = imageUrl(p.portrait, ctx, { width: 56, ratio: 1 });
    const who = [localText(p, "author", ctx.locale), localText(p, "role", ctx.locale)].filter(Boolean);
    if (who.length) ctx.text.push(`— ${who.join(", ")}`);
    return row(
      `<p style="margin:0 0 18px 0;font-family:${font(ctx, "heading")};font-size:${ctx.rtl ? 20 : 24}px;line-height:1.35;color:${ink};text-align:${align}${!ctx.rtl && ctx.settings.headingFont === "serif" ? ";font-style:italic" : ""}">${open}${inline(quote, ctx, ink)}${close}</p>` +
        (portrait
          ? `<img src="${esc(portrait)}" alt="" width="56" height="56" style="display:${align === "center" ? "block;margin:0 auto 10px" : "block;margin:0 0 10px"};width:56px;height:56px;border-radius:28px;object-fit:cover;border:0">`
          : "") +
        (who.length
          ? `<p style="margin:0;${bodyStyle(ctx, color(p.textColor, ctx.settings.mutedColor), align, 13)}"><strong>${inline(who[0]!, ctx, ink)}</strong>${who[1] ? `<br>${inline(who[1], ctx, ink)}` : ""}</p>`
          : ""),
      p,
      ctx,
    );
  },

  image(p, ctx) {
    const bleed = p.fullBleed === true;
    const html = img(p.image, localText(p, "alt", ctx.locale), bleed ? COLUMN : INNER, ctx, { rounded: p.rounded === true, link: p.link, cls: "stack-img" });
    if (!html) return "";
    const caption = localText(p, "caption", ctx.locale);
    if (caption) ctx.text.push(plain(caption, ctx));
    const cap = caption
      ? `<p class="px" style="margin:10px 0 0 0;padding:0 ${bleed ? GUTTER : 0}px;${bodyStyle(ctx, ctx.settings.mutedColor, alignOf("start", ctx), 12)}">${inline(caption, ctx, ctx.settings.linkColor)}</p>`
      : "";
    return row(html + cap, p, ctx, { gutter: !bleed });
  },

  image_text(p, ctx) {
    const align = alignOf("start", ctx);
    const ink = color(p.textColor, ctx.settings.textColor);
    const picture = img(p.image, localText(p, "alt", ctx.locale), 250, ctx, { cls: "stack-img" });
    const value = localText(p, "text", ctx.locale);
    const head =
      eyebrow(localText(p, "eyebrow", ctx.locale), ctx, align, ctx.settings.mutedColor) +
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: "m", align, ink: color(p.textColor, ctx.settings.headingColor) });
    if (value) ctx.text.push(plain(value, ctx));
    const cta = blockButton(p, ctx, align);
    const words =
      head +
      (value ? paragraphs(value, ctx, bodyStyle(ctx, ink, align, 14), ctx.settings.linkColor) : "") +
      (cta ? `<div style="height:16px;line-height:16px">&nbsp;</div>${cta}` : "");
    const cells = picture ? (p.side === "end" ? [words, picture] : [picture, words]) : [words];
    return row(columns(cells, ctx, { gap: 28, valign: "middle" }), p, ctx);
  },

  gallery(p, ctx) {
    const list = items(p).filter((i) => imageUrl(i.image));
    if (list.length === 0) return "";
    const width = Math.floor((INNER - 16 * (list.length - 1)) / list.length);
    const cells = list.map((i) => {
      const caption = localText(i, "caption", ctx.locale);
      if (caption) ctx.text.push(plain(caption, ctx));
      return (
        img(i.image, localText(i, "alt", ctx.locale), width, ctx, { rounded: p.rounded === true, link: i.link, cls: "stack-img" }) +
        (caption ? `<p style="margin:8px 0 0 0;${bodyStyle(ctx, ctx.settings.mutedColor, alignOf("start", ctx), 12)}">${inline(caption, ctx, ctx.settings.linkColor)}</p>` : "")
      );
    });
    return row(columns(cells, ctx, { gap: 16 }), p, ctx);
  },

  features(p, ctx) {
    const align = alignOf(p.align, ctx);
    const ink = color(p.textColor, ctx.settings.textColor);
    const list = items(p);
    if (list.length === 0) return "";
    const iconWidth = Math.floor(INNER / list.length) - 20;
    const cells = list.map((i) => {
      const title = localText(i, "title", ctx.locale);
      const body = localText(i, "text", ctx.locale);
      ctx.text.push([title, body].filter(Boolean).map((t) => plain(t, ctx)).join(" — "));
      const icon = imageUrl(i.icon);
      return (
        (icon ? `<div style="margin:0 0 12px 0;text-align:${align}">${img(i.icon, title, iconWidth, ctx).replace("display:block;", align === "center" ? "display:block;margin:0 auto;" : "display:block;")}</div>` : "") +
        (title ? `<p style="margin:0 0 6px 0;font-family:${font(ctx, "body")};font-size:${ctx.rtl ? 16 : 15}px;font-weight:600;line-height:1.3;color:${color(p.textColor, ctx.settings.headingColor)};text-align:${align}">${inline(title, ctx, ink)}</p>` : "") +
        (body ? `<p style="margin:0;${bodyStyle(ctx, color(p.textColor, ctx.settings.mutedColor), align, 13)};line-height:1.45">${inline(body, ctx, ctx.settings.linkColor)}</p>` : "")
      );
    });
    return row(
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: p.size, align: "center", ink: color(p.textColor, ctx.settings.headingColor) }).replace(
        "margin:0 0 12px 0",
        "margin:0 0 20px 0",
      ) + columns(cells, ctx, { gap: 20, dividers: p.dividers === true ? color(p.textColor, ctx.settings.mutedColor) : undefined }),
      p,
      ctx,
    );
  },

  cards(p, ctx) {
    const list = items(p);
    if (list.length === 0) return "";
    const ink = color(p.textColor, ctx.settings.textColor);
    const align = alignOf("start", ctx);
    const card = color(p.cardBackground, "#FFFFFF");
    const width = Math.floor((INNER - 16 * (list.length - 1)) / list.length);
    const cells = list.map((i) => {
      const title = localText(i, "title", ctx.locale);
      const body = localText(i, "text", ctx.locale);
      ctx.text.push([title, body].filter(Boolean).map((t) => plain(t, ctx)).join(" — "));
      const link = button(
        { label: localText(i, "linkLabel", ctx.locale), url: i.url, fill: ctx.settings.linkColor, ink, style: "link", align },
        ctx,
      );
      return `<table ${TABLE} ${dirAttr(ctx)} width="100%" bgcolor="${card}" style="background:${card}"><tr><td>${img(i.image, title, width, ctx, { link: i.url, cls: "stack-img" })}</td></tr><tr><td style="padding:16px 18px 18px">${
        title ? `<p style="margin:0 0 6px 0;font-family:${font(ctx, "heading")};font-size:${ctx.rtl ? 17 : 19}px;line-height:1.25;color:${color(p.textColor, ctx.settings.headingColor)};text-align:${align}">${inline(title, ctx, ink)}</p>` : ""
      }${body ? `<p style="margin:0 0 12px 0;${bodyStyle(ctx, ink, align, 13)}">${inline(body, ctx, ctx.settings.linkColor)}</p>` : ""}${link}</td></tr></table>`;
    });
    return row(
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: "m", align: "center", ink: color(p.textColor, ctx.settings.headingColor) }) +
        columns(cells, ctx, { gap: 16 }),
      p,
      ctx,
    );
  },

  stats(p, ctx) {
    const list = items(p);
    if (list.length === 0) return "";
    const valueInk = color(p.valueColor, ctx.settings.headingColor);
    const cells = list.map((i) => {
      const value = localText(i, "value", ctx.locale);
      const label = localText(i, "label", ctx.locale);
      ctx.text.push(`${plain(value, ctx)} — ${plain(label, ctx)}`);
      return `<p style="margin:0 0 4px 0;font-family:${font(ctx, "heading")};font-size:${ctx.rtl ? 26 : 32}px;line-height:1.1;color:${valueInk};text-align:center"><bdi>${inline(value, ctx, valueInk)}</bdi></p><p style="margin:0;${bodyStyle(ctx, color(p.textColor, ctx.settings.mutedColor), "center", 12)}">${inline(label, ctx, valueInk)}</p>`;
    });
    return row(
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: "m", align: "center", ink: color(p.textColor, ctx.settings.headingColor) }).replace(
        "margin:0 0 12px 0",
        "margin:0 0 20px 0",
      ) + columns(cells, ctx, { gap: 12 }),
      p,
      ctx,
    );
  },

  chips(p, ctx) {
    const align = alignOf(p.align, ctx);
    const chip = color(p.chipColor, ctx.settings.textColor);
    const chipFill = color(p.chipFill, "");
    const radius = p.shape === "pill" ? 999 : p.shape === "rounded" ? 6 : 0;
    const intro = localText(p, "intro", ctx.locale);
    const labels = items(p)
      .map((i) => localText(i, "label", ctx.locale))
      .filter(Boolean);
    if (intro) ctx.text.push(plain(intro, ctx));
    if (labels.length) ctx.text.push(labels.map((l) => plain(l, ctx)).join(" · "));
    const pills = labels
      .map(
        (l) =>
          `<span style="display:inline-block;margin:4px;padding:6px 14px;border:1px solid ${chip};border-radius:${radius}px;${chipFill ? `background:${chipFill};` : ""}font-family:${font(ctx, "body")};font-size:13px;line-height:1.3;color:${chip}">${inline(l, ctx, chip)}</span>`,
      )
      .join("");
    return row(
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: p.size, align, ink: color(p.textColor, ctx.settings.headingColor) }) +
        (intro ? paragraphs(intro, ctx, bodyStyle(ctx, color(p.textColor, ctx.settings.textColor), align), ctx.settings.linkColor) + '<div style="height:10px;line-height:10px">&nbsp;</div>' : "") +
        `<div style="text-align:${align}">${pills}</div>`,
      p,
      ctx,
    );
  },

  list(p, ctx) {
    const align = alignOf(p.align, ctx);
    const ink = color(p.textColor, ctx.settings.textColor);
    const rule = color(p.textColor, ctx.settings.mutedColor);
    const entries = items(p)
      .map((i) => localText(i, "text", ctx.locale))
      .filter(Boolean);
    if (entries.length === 0) return "";
    const intro = localText(p, "intro", ctx.locale);
    if (intro) ctx.text.push(plain(intro, ctx));
    for (const e of entries) ctx.text.push(`• ${plain(e, ctx)}`);
    const marker = { dot: "&bull;", check: "&#10003;", dash: "&ndash;", rule: "" }[String(p.marker)] ?? "";
    const start = ctx.rtl ? "right" : "left";
    const line = (e: string) =>
      `<tr><td ${dirAttr(ctx)} style="padding:7px 0;${p.marker === "rule" ? `border-bottom:1px solid ${rgba(rule, 0.35)};` : ""}${bodyStyle(ctx, ink, start, 14)}">${marker ? `<span style="color:${ctx.settings.linkColor};padding-${ctx.rtl ? "left" : "right"}:8px">${marker}</span>` : ""}${inline(e, ctx, ctx.settings.linkColor)}</td></tr>`;
    const two = p.columns === "2" && entries.length > 1;
    const half = Math.ceil(entries.length / 2);
    const lists = two ? [entries.slice(0, half), entries.slice(half)] : [entries];
    const tables = lists.map((l) => `<table ${TABLE} ${dirAttr(ctx)} width="100%">${l.map(line).join("")}</table>`);
    return row(
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: p.size, align, ink: color(p.textColor, ctx.settings.headingColor) }) +
        (intro ? paragraphs(intro, ctx, bodyStyle(ctx, ink, align), ctx.settings.linkColor) + '<div style="height:12px;line-height:12px">&nbsp;</div>' : "") +
        (two ? columns(tables, ctx, { gap: 32 }) : tables[0]),
      p,
      ctx,
    );
  },

  key_values(p, ctx) {
    const ink = color(p.textColor, ctx.settings.textColor);
    const rule = color(p.textColor, ctx.settings.mutedColor);
    const lines = items(p)
      .map((i) => [localText(i, "label", ctx.locale), localText(i, "value", ctx.locale)] as const)
      .filter(([l, v]) => l || v);
    if (lines.length === 0) return "";
    for (const [l, v] of lines) ctx.text.push(`${plain(l, ctx)}: ${plain(v, ctx)}`);
    const start = ctx.rtl ? "right" : "left";
    const end = ctx.rtl ? "left" : "right";
    const border = p.rules === true ? `border-bottom:1px solid ${rgba(rule, 0.35)};` : "";
    const body = lines
      .map(
        ([l, v]) =>
          `<tr><td ${dirAttr(ctx)} valign="top" style="padding:8px 12px 8px 0;${border}${bodyStyle(ctx, ink, start, 14)}">${inline(l, ctx, ink)}</td><td ${dirAttr(ctx)} valign="top" style="padding:8px 0;${border}${bodyStyle(ctx, ink, end, 14)}${p.boldValues === true ? ";font-weight:600" : ""}"><bdi>${inline(v, ctx, ctx.settings.linkColor)}</bdi></td></tr>`,
      )
      .join("");
    return row(
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: p.size, align: "center", ink: color(p.textColor, ctx.settings.headingColor) }) +
        `<table ${TABLE} ${dirAttr(ctx)} width="100%">${body}</table>`,
      p,
      ctx,
    );
  },

  person(p, ctx) {
    const ink = color(p.textColor, ctx.settings.textColor);
    const align = alignOf("start", ctx);
    const photo = imageUrl(p.photo, ctx, { width: 96, ratio: 1 });
    const name = localText(p, "name", ctx.locale);
    const role = localText(p, "role", ctx.locale);
    const said = localText(p, "text", ctx.locale);
    ctx.text.push([name, role].filter(Boolean).join(", "));
    if (said) ctx.text.push(plain(said, ctx));
    const contact = [
      ["phone", str(p, "phone"), (v: string) => `tel:${v.replace(/[^+\d]/g, "")}`],
      ["whatsapp", str(p, "whatsapp"), (v: string) => `https://wa.me/${v.replace(/[^\d]/g, "")}`],
      ["email", str(p, "email"), (v: string) => `mailto:${v}`],
    ] as const;
    const links = contact
      .filter(([, v]) => v.trim())
      .map(([icon, v, to]) => {
        ctx.text.push(v);
        return `<a href="${esc(to(v.trim()))}" style="display:inline-block;margin-${ctx.rtl ? "left" : "right"}:14px;font-family:${font(ctx, "sans")};font-size:13px;color:${ctx.settings.linkColor};text-decoration:none"><img src="${esc(`${ctx.siteUrl}/email/social/${icon}-${iconTone(ink)}.png`)}" alt="" width="14" height="14" style="display:inline-block;vertical-align:middle;width:14px;height:14px;border:0;margin-${ctx.rtl ? "left" : "right"}:5px"><bdi>${esc(v.trim())}</bdi></a>`;
      })
      .join("");
    const words =
      `<p style="margin:0 0 2px 0;font-family:${font(ctx, "heading")};font-size:${ctx.rtl ? 18 : 22}px;line-height:1.2;color:${color(p.textColor, ctx.settings.headingColor)};text-align:${align}">${inline(name, ctx, ink)}</p>` +
      (role ? `<p style="margin:0 0 10px 0;${bodyStyle(ctx, ctx.settings.mutedColor, align, 13)}">${inline(role, ctx, ink)}</p>` : "") +
      (said ? paragraphs(said, ctx, bodyStyle(ctx, ink, align, 14), ctx.settings.linkColor) : "") +
      (links ? `<p style="margin:10px 0 0 0">${links}</p>` : "");
    const pic = photo
      ? `<img src="${esc(photo)}" alt="${esc(name)}" width="96" height="96" style="display:block;width:96px;height:96px;border-radius:48px;object-fit:cover;border:0">`
      : "";
    return row(
      pic
        ? `<table ${TABLE} ${dirAttr(ctx)} width="100%"><tr><td width="116" valign="top" style="width:116px">${pic}</td><td valign="top">${words}</td></tr></table>`
        : words,
      p,
      ctx,
    );
  },

  button(p, ctx) {
    const html = button(
      {
        label: localText(p, "label", ctx.locale),
        url: p.url,
        fill: color(p.buttonColor, ctx.settings.buttonColor),
        ink: color(p.buttonTextColor, ctx.settings.buttonTextColor),
        style: p.buttonStyle,
        shape: p.shape,
        fullWidth: p.fullWidth === true,
        align: alignOf(p.align, ctx),
      },
      ctx,
    );
    return html ? row(html, p, ctx) : "";
  },

  cta_band(p, ctx) {
    const align = alignOf(p.align, ctx);
    const ink = color(p.textColor, "#FFFFFF");
    const value = localText(p, "text", ctx.locale);
    const head =
      eyebrow(localText(p, "eyebrow", ctx.locale), ctx, align, ink) +
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: p.size, align, ink });
    if (value) ctx.text.push(plain(value, ctx));
    const first = blockButton(p, ctx, align, "primary");
    const second = blockButton(p, ctx, align, "secondary");
    return row(
      head +
        (value ? paragraphs(value, ctx, bodyStyle(ctx, ink, align), ink) : "") +
        (first ? `<div style="height:22px;line-height:22px">&nbsp;</div>${first}` : "") +
        (second ? `<div style="height:12px;line-height:12px">&nbsp;</div>${second}` : ""),
      { ...p, background: color(p.background, "#003452") },
      ctx,
    );
  },

  records(p, ctx) {
    const records = p.records as EmailFeatureBlock | null;
    const drawn = records && ctx.features ? ctx.features(records) : null;
    if (!drawn) return "";
    const intro = localText(p, "intro", ctx.locale);
    if (intro) ctx.text.push(plain(intro, ctx));
    ctx.text.push(drawn.text);
    return row(
      headingHtml(localText(p, "heading", ctx.locale), ctx, { size: p.size, align: "center", ink: ctx.settings.headingColor }) +
        (intro ? paragraphs(intro, ctx, bodyStyle(ctx, ctx.settings.textColor, "center"), ctx.settings.linkColor) + '<div style="height:12px;line-height:12px">&nbsp;</div>' : "") +
        drawn.html,
      p,
      ctx,
    );
  },

  social(p, ctx) {
    const align = alignOf(p.align, ctx);
    const tone = p.tone === "light" ? "light" : "dark";
    const known = new Set<string>(SOCIAL_NETWORKS.map(([n]) => n));
    const icons = items(p)
      .map((i) => {
        const network = typeof i.network === "string" && known.has(i.network) ? i.network : "website";
        const to = href(i.url, ctx);
        if (!to) return "";
        const name = SOCIAL_NETWORKS.find(([n]) => n === network)?.[1] ?? network;
        ctx.text.push(`${name}: ${to}`);
        return `<a href="${esc(to)}" style="display:inline-block;margin:0 8px;text-decoration:none"><img src="${esc(`${ctx.siteUrl}/email/social/${network}-${tone}.png`)}" alt="${esc(name)}" width="24" height="24" style="display:block;width:24px;height:24px;border:0"></a>`;
      })
      .filter(Boolean)
      .join("");
    return icons ? row(`<div style="text-align:${align}">${icons}</div>`, p, ctx) : "";
  },

  contact(p, ctx) {
    const align = alignOf(p.align, ctx);
    const ink = color(p.textColor, ctx.settings.mutedColor);
    const lines: string[] = [];
    const company = localText(p, "company", ctx.locale);
    if (company) {
      ctx.text.push(company);
      lines.push(`<p style="margin:0 0 6px 0;font-family:${font(ctx, "body")};font-size:14px;font-weight:600;color:${color(p.textColor, ctx.settings.textColor)};text-align:${align}">${inline(company, ctx, ink)}</p>`);
    }
    const address = localText(p, "address", ctx.locale);
    if (address) {
      ctx.text.push(plain(address, ctx));
      lines.push(`<p style="margin:0 0 8px 0;${bodyStyle(ctx, ink, align, 12)}">${inline(address, ctx, ink)}</p>`);
    }
    const reach = (
      [
        ["phone", str(p, "phone"), (v: string) => `tel:${v.replace(/[^+\d]/g, "")}`],
        ["whatsapp", str(p, "whatsapp"), (v: string) => `https://wa.me/${v.replace(/[^\d]/g, "")}`],
        ["email", str(p, "email"), (v: string) => `mailto:${v}`],
      ] as const
    )
      .filter(([, v]) => v.trim())
      .map(([icon, v, to]) => {
        ctx.text.push(v.trim());
        return `<a href="${esc(to(v.trim()))}" style="display:inline-block;margin:0 9px;font-family:${font(ctx, "sans")};font-size:12px;color:${ink};text-decoration:none"><img src="${esc(`${ctx.siteUrl}/email/social/${icon}-${iconTone(ink)}.png`)}" alt="" width="13" height="13" style="display:inline-block;vertical-align:middle;width:13px;height:13px;border:0;margin-${ctx.rtl ? "left" : "right"}:5px;opacity:0.7"><bdi>${esc(v.trim())}</bdi></a>`;
      });
    if (reach.length) lines.push(`<p style="margin:0 0 8px 0;text-align:${align}">${reach.join("")}</p>`);
    const links = items(p, "links")
      .map((l) => {
        const label = localText(l, "label", ctx.locale);
        const to = href(l.url, ctx);
        if (!label || !to) return "";
        ctx.text.push(`${plain(label, ctx)}: ${to}`);
        return `<a href="${esc(to)}" style="display:inline-block;margin:0 9px;font-family:${font(ctx, "sans")};font-size:12px;color:${ink};text-decoration:underline">${inline(label, ctx, ink)}</a>`;
      })
      .filter(Boolean);
    if (links.length) lines.push(`<p style="margin:0 0 8px 0;text-align:${align}">${links.join("")}</p>`);
    const legal = localText(p, "legal", ctx.locale);
    if (legal) {
      ctx.text.push(plain(legal, ctx));
      lines.push(`<p style="margin:0;${bodyStyle(ctx, ink, align, 11)}">${inline(legal, ctx, ink)}</p>`);
    }
    return lines.length ? row(lines.join(""), p, ctx) : "";
  },

  divider(p, ctx) {
    const line = color(p.color, ctx.settings.mutedColor);
    const width = Number(p.width ?? 100);
    return row(
      `<table ${TABLE} width="${width}%" align="center" style="margin:0 auto"><tr><td height="1" style="height:1px;line-height:1px;font-size:1px;background:${rgba(line, 0.45)}">&nbsp;</td></tr></table>`,
      p,
      ctx,
    );
  },

  spacer(p) {
    const bg = color(p.background, "");
    const h = Number(p.height ?? 32);
    return `<tr><td height="${h}"${bg ? ` bgcolor="${bg}"` : ""} style="height:${h}px;line-height:${h}px;font-size:1px;${bg ? `background:${bg}` : ""}">&nbsp;</td></tr>`;
  },
};

function logoSrc(p: Props, ctx: Ctx): { src: string; alt: string } | null {
  if (p.logo === "none") return null;
  if (p.logo === "custom") {
    const src = imageUrl(p.logoImage, ctx, { width: Number(p.logoWidth ?? 110) });
    return src ? { src, alt: ctx.brand.logoAlt } : null;
  }
  if (p.logo === "white") return { src: `${ctx.siteUrl}/email/bazar-logo-white.png`, alt: ctx.brand.logoAlt };
  // The logo Email design holds, when it is a logo; Bazar's own otherwise.
  const brandLogo = ctx.brand.headerStyle === "logo" ? emailLogoUrl(ctx.brand) : null;
  return { src: brandLogo || `${ctx.siteUrl}/email/bazar-logo.png`, alt: ctx.brand.logoAlt };
}

function logoImg(p: Props, ctx: Ctx, align: string): string {
  const logo = logoSrc(p, ctx);
  if (!logo) return "";
  const width = Number(p.logoWidth ?? 110);
  const margin = align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0";
  return `<img src="${esc(logo.src)}" alt="${esc(logo.alt)}" width="${width}" style="display:block;margin:${margin};width:${width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none">`;
}

function heroLogo(p: Props, ctx: Ctx, align: string): string {
  const logo = logoImg(p, ctx, align);
  return logo ? `<div style="margin:0 0 36px 0">${logo}</div>` : "";
}

/** One block's row, or "" when it has nothing to show. A block that throws is left out rather than costing the email. */
export function renderBlock(block: Block, ctx: Ctx): string {
  const draw = DRAW[block.type];
  if (!draw) return "";
  try {
    return draw(block.props, ctx);
  } catch (error) {
    console.warn(`[newsletter] block ${block.type} failed to render:`, error instanceof Error ? error.message : error);
    return "";
  }
}

const STYLE = `body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}table{border-collapse:collapse}a{text-decoration:none}
@media only screen and (max-width:620px){.wrap{width:100%!important;max-width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}.col{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box}.col-gap{padding:0 0 22px 0!important;border:0!important}.hero-h{font-size:32px!important;line-height:1.15!important}.stack-img{width:100%!important;max-width:100%!important;height:auto!important}}`;

/** The whole email for one edition. */
export function renderDesign(raw: Design | unknown, opts: DesignRenderContext): RenderedDesign {
  const design = normaliseDesign(raw);
  const ctx: Ctx = { ...opts, settings: design.settings, rtl: opts.locale === "ar", text: [] };
  const s = design.settings;
  const dir = ctx.rtl ? "rtl" : "ltr";
  const rows: string[] = [];
  for (const block of design.blocks) {
    const before = ctx.text.length;
    const html = renderBlock(block, ctx);
    if (html) rows.push(html);
    if (ctx.text.length > before) ctx.text.push("");
  }
  rows.push(
    `<tr><td class="px" ${dirAttr(ctx)} style="padding:20px ${GUTTER}px 28px;border-top:1px solid ${rgba(s.mutedColor, 0.25)};font-family:${font(ctx, "sans")};font-size:11px;line-height:1.6;color:${s.mutedColor};text-align:center">${opts.footer.html.replace(/<a /g, `<a style="color:${s.mutedColor};text-decoration:underline" `)}</td></tr>`,
  );
  const fonts = ctx.rtl
    ? '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">'
    : '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">';
  const html = `<!doctype html><html dir="${dir}" lang="${opts.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(opts.subject)}</title>${fonts}<style>${STYLE}</style></head>
<body dir="${dir}" style="margin:0;padding:0;background:${s.pageBackground};color:${s.textColor};direction:${dir}">
<table ${TABLE} dir="${dir}" width="100%" bgcolor="${s.pageBackground}" style="background:${s.pageBackground}"><tr><td align="center" style="padding:24px 0">
<table ${TABLE} dir="${dir}" class="wrap" width="${COLUMN}" bgcolor="${s.contentBackground}" style="width:${COLUMN}px;max-width:${COLUMN}px;background:${s.contentBackground};direction:${dir};text-align:${ctx.rtl ? "right" : "left"}">
${rows.join("\n")}
</table>
</td></tr></table>
</body></html>`;
  const text = [...ctx.text, opts.footer.text]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { html, text: `${text}\n` };
}

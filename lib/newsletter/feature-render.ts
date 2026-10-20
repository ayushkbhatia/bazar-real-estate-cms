/**
 * Featured blocks → the HTML and text an inbox receives.
 *
 * A featured block (lib/content-assets/email-feature.ts) names records; this
 * draws them, from records already looked up in the reader's language
 * (./features.ts), as email-safe markup: nested tables and inline styles only,
 * physical sides chosen per language (Outlook and Gmail's Android app ignore
 * logical properties), no background images, no CSS a mail client strips.
 *
 * Every value is the record's own and is escaped; every label is from the
 * dictionary below, whose Arabic is the site's own wording for the same thing
 * (messages/ar/*.json), so a card says in an email what it says on the page.
 *
 * Pure. Tests draw it without a database.
 */

import { env } from "@/lib/env";
import { emailSiteUrl, escapeEmailHtml as escape, type EmailBlock } from "@/lib/email-templates";
import { formatArea, formatPrice } from "@/lib/preferences/formatters";
import { isolateForLocale } from "@/lib/i18n/bidi";
import type { UnitLabels } from "@/lib/preferences/unit-labels";
import type { EmailBrand } from "@/lib/content-assets/email-brand";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import type { EmailFeatureBlock, FeatureKind } from "@/lib/content-assets/email-feature";
import type {
  ResolvedAreaLink,
  ResolvedDevelopmentLink,
  ResolvedPropertyLink,
  LinkCardImage,
} from "@/lib/internal-links/types";

export type ResolvedArticleFeature = {
  kind: "article";
  id: string;
  href: string;
  name: string;
  image: LinkCardImage | null;
  excerpt: string | null;
  category: string | null;
  readMinutes: number | null;
};

/** A featured record, every string already in the reader's language. */
export type FeatureRecord =
  | ResolvedAreaLink
  | ResolvedDevelopmentLink
  | ResolvedPropertyLink
  | ResolvedArticleFeature;

/**
 * As for article internal links: a record, `null` (looked up, not public —
 * leave it out) or `undefined` (could not look it up — also left out; an
 * email cannot be re-rendered later the way a page can).
 */
export type FeatureLookup = {
  get(kind: FeatureKind, id: string): FeatureRecord | null | undefined;
};

type PluralForms = Partial<Record<Intl.LDMLPluralRule, (n: number) => string>> & {
  other: (n: number) => string;
};

const PLURAL: Record<EmailLocale, Intl.PluralRules> = {
  en: new Intl.PluralRules("en"),
  ar: new Intl.PluralRules("ar"),
};

function plural(forms: PluralForms, n: number, locale: EmailLocale): string {
  return (forms[PLURAL[locale].select(n)] ?? forms.other)(n);
}

type Copy = {
  mode: Record<string, string>;
  type: Record<string, string>;
  beds: PluralForms;
  baths: PluralForms;
  studio: string;
  perYear: string;
  priceOnRequest: string;
  from: string;
  handover: (q: number, year: number) => string;
  homes: PluralForms;
  readMinutes: PluralForms;
  eyebrow: Record<"development" | "area" | "article", string>;
  cta: Record<FeatureKind, string>;
  arrow: string;
};

export const FEATURE_COPY: Record<EmailLocale, Copy> = {
  en: {
    mode: { buy: "For sale", rent: "For rent", off_plan: "Off-plan", commercial: "Commercial" },
    type: {
      apartment: "Apartment",
      building: "Building",
      commercial: "Commercial",
      commercial_villa: "Commercial villa",
      hotel_apartment: "Hotel apartment",
      land: "Land",
      office: "Office",
      penthouse: "Penthouse",
      retail: "Retail",
      townhouse: "Townhouse",
      villa: "Villa",
    },
    beds: { one: (n) => `${n} bed`, other: (n) => `${n} beds` },
    baths: { one: (n) => `${n} bath`, other: (n) => `${n} baths` },
    studio: "Studio",
    perYear: "a year",
    priceOnRequest: "Price on request",
    from: "From",
    handover: (q, year) => `Handover Q${q} ${year}`,
    homes: { one: (n) => `${n} home for sale`, other: (n) => `${n} homes for sale` },
    readMinutes: { other: (n) => `${n} min read` },
    eyebrow: { development: "New project", area: "Community guide", article: "Insights" },
    cta: {
      property: "View the listing",
      development: "View the project",
      area: "Read the guide",
      article: "Read the article",
    },
    arrow: "→",
  },
  ar: {
    mode: { buy: "للبيع", rent: "للإيجار", off_plan: "على الخارطة", commercial: "تجاري" },
    type: {
      apartment: "شقة",
      building: "مبنى",
      commercial: "تجاري",
      commercial_villa: "فيلا تجارية",
      hotel_apartment: "شقة فندقية",
      land: "أرض",
      office: "مكتب",
      penthouse: "بنتهاوس",
      retail: "تجزئة",
      townhouse: "تاون هاوس",
      villa: "فيلا",
    },
    beds: {
      zero: () => "بدون غرف نوم",
      one: () => "غرفة نوم واحدة",
      two: () => "غرفتا نوم",
      few: (n) => `${n} غرف نوم`,
      many: (n) => `${n} غرفة نوم`,
      other: (n) => `${n} غرفة نوم`,
    },
    baths: {
      zero: () => "بدون حمّامات",
      one: () => "حمّام واحد",
      two: () => "حمّامان",
      few: (n) => `${n} حمّامات`,
      many: (n) => `${n} حمّامًا`,
      other: (n) => `${n} حمّام`,
    },
    studio: "استوديو",
    perYear: "سنويًا",
    priceOnRequest: "السعر عند الطلب",
    from: "من",
    handover: (q, year) =>
      `التسليم ${["الربع الأول", "الربع الثاني", "الربع الثالث", "الربع الرابع"][q - 1] ?? `الربع ${q}`} ${year}`,
    homes: {
      zero: (n) => `${n} منزل للبيع`,
      one: () => "منزل واحد للبيع",
      two: () => "منزلان للبيع",
      few: (n) => `${n} منازل للبيع`,
      many: (n) => `${n} منزلاً للبيع`,
      other: (n) => `${n} منزل للبيع`,
    },
    // The site's own wording (messages/ar/editorial.json → article.readMinutes).
    readMinutes: {
      zero: (n) => `${n} دقيقة قراءة`,
      one: () => "دقيقة قراءة",
      two: () => "دقيقتا قراءة",
      few: (n) => `${n} دقائق قراءة`,
      many: (n) => `${n} دقيقة قراءة`,
      other: (n) => `${n} دقيقة قراءة`,
    },
    eyebrow: { development: "مشروع جديد", area: "دليل المجتمع", article: "رؤى" },
    cta: {
      property: "اطّلع على العقار",
      development: "اطّلع على المشروع",
      area: "اقرأ الدليل",
      article: "اقرأ المقال",
    },
    arrow: "←",
  },
};

export type FeatureRenderOptions = {
  brand: EmailBrand;
  locale: EmailLocale;
  /** The currency and area words for `locale`, with the site's overrides. */
  labels: UnitLabels;
  /** A photo's address at a display width. Defaults to `emailPhotoUrl`. */
  photo?: (url: string, width: number) => string;
};

/**
 * A photograph's address for an email, at about twice the width it shows at.
 *
 * The media bucket holds originals — ~1.4 MB on average — and an email is
 * opened by every recipient. In production a photo goes through the site's own
 * image optimizer, the same `/_next/image` variants the public pages already
 * request (q90, the configured quality; widths from the default size lists),
 * so it is cached at Vercel's edge rather than fetched from Supabase per open,
 * and the image host stays this site. Elsewhere — a local stack, a preview —
 * the optimizer at the site URL can't reach that storage, so the original is
 * used as is.
 */
export function emailPhotoUrl(url: string, width: number): string {
  if (env.VERCEL_ENV !== "production") return url;
  const w = width <= 256 ? 256 : width <= 640 ? 640 : 1080;
  return `${emailSiteUrl()}/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=90`;
}

/** A record's page, absolute, in the reader's language. */
export function featureHref(path: string, locale: EmailLocale): string {
  return `${emailSiteUrl()}${locale === "ar" ? "/ar" : ""}${path}`;
}

function truncate(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain || null;
  const cut = plain.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

function quarterOf(iso: string | null): { q: number; year: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { q: Math.floor(d.getUTCMonth() / 3) + 1, year: d.getUTCFullYear() };
}

/** The words a card prints for a record, before any markup. */
export type FeatureParts = {
  href: string;
  name: string;
  eyebrow: string | null;
  sub: string | null;
  facts: string[];
  price: string | null;
  cta: string;
  image: LinkCardImage | null;
};

export function featureParts(record: FeatureRecord, opts: FeatureRenderOptions): FeatureParts {
  const copy = FEATURE_COPY[opts.locale];
  // The record's own words are as often Latin as not — a developer with no
  // Arabic name, a reference — and Latin dropped bare into a right-to-left
  // line takes its punctuation to the wrong end. Isolated in Arabic only, as
  // the token pass does (lib/content-assets/email-html.ts).
  const iso = (v: string | null | undefined): string | null => (v ? isolateForLocale(v, opts.locale) : null);
  const priceCtx = { currency: "AED" as const, labels: opts.labels };
  const areaCtx = { area_unit: "ft2" as const, labels: opts.labels };
  const base = {
    href: featureHref(record.href, opts.locale),
    name: iso(record.name) ?? record.name,
    cta: copy.cta[record.kind],
    image: record.image,
  };
  switch (record.kind) {
    case "property": {
      // One line: "4 beds · 5 baths · 6,100 ft²", the way the site's cards read.
      const figures = [
        record.beds != null ? (record.beds === 0 ? copy.studio : plural(copy.beds, record.beds, opts.locale)) : null,
        record.baths ? plural(copy.baths, record.baths, opts.locale) : null,
        record.builtUpFt2 ? formatArea(record.builtUpFt2, areaCtx) : null,
      ].filter((f): f is string => Boolean(f));
      const facts = figures.length > 0 ? [figures.join(" · ")] : [];
      const price = record.priceAed
        ? `${formatPrice(record.priceAed, priceCtx)}${record.mode === "rent" ? ` ${copy.perYear}` : ""}`
        : copy.priceOnRequest;
      return {
        ...base,
        eyebrow: [copy.type[record.type], copy.mode[record.mode]].filter(Boolean).join(" · ") || null,
        sub: iso(record.area),
        facts,
        price,
      };
    }
    case "development": {
      const handover = quarterOf(record.handoverDate);
      return {
        ...base,
        eyebrow: copy.eyebrow.development,
        sub: [iso(record.area), iso(record.developer)].filter(Boolean).join(" · ") || null,
        facts: [iso(truncate(record.tagline, 110)), handover ? copy.handover(handover.q, handover.year) : null].filter(
          (f): f is string => Boolean(f),
        ),
        price: record.startingPriceAed ? `${copy.from} ${formatPrice(record.startingPriceAed, priceCtx)}` : null,
      };
    }
    case "area":
      return {
        ...base,
        eyebrow: copy.eyebrow.area,
        sub: iso(record.parent),
        facts: [iso(truncate(record.summary, 140)), record.listings > 0 ? plural(copy.homes, record.listings, opts.locale) : null].filter(
          (f): f is string => Boolean(f),
        ),
        price: null,
      };
    case "article":
      return {
        ...base,
        eyebrow: iso(record.category) ?? copy.eyebrow.article,
        sub: record.readMinutes ? plural(copy.readMinutes, record.readMinutes, opts.locale) : null,
        facts: [iso(truncate(record.excerpt, 160))].filter((f): f is string => Boolean(f)),
        price: null,
      };
  }
}

const BORDER = "#E5E5DF";

type Style = {
  rtl: boolean;
  dir: "rtl" | "ltr";
  start: "left" | "right";
  text: string;
  muted: string;
  link: string;
  /** The name: Georgia in English, the body face at weight in Arabic. */
  title: (px: number) => string;
  eyebrow: string;
};

function styleFor(brand: EmailBrand, locale: EmailLocale): Style {
  const rtl = locale === "ar";
  return {
    rtl,
    dir: rtl ? "rtl" : "ltr",
    start: rtl ? "right" : "left",
    text: brand.textColor,
    muted: brand.mutedColor,
    link: brand.linkColor,
    title: (px) =>
      rtl
        ? `font-size:${px - 1}px;font-weight:600;line-height:1.45;color:${brand.textColor}`
        : `font-family:Georgia,serif;font-size:${px}px;font-weight:normal;line-height:1.25;letter-spacing:-0.01em;color:${brand.textColor}`,
    // Uppercase and tracking are Latin devices; Arabic has no case.
    eyebrow: rtl
      ? `font-size:12px;line-height:1.5;color:${brand.mutedColor}`
      : `font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:${brand.mutedColor}`,
  };
}

function photoTag(p: FeatureParts, width: number, opts: FeatureRenderOptions, css: string): string {
  if (!p.image) return "";
  const src = (opts.photo ?? emailPhotoUrl)(p.image.url, width * 2);
  return `<a href="${escape(p.href)}" style="text-decoration:none;border:0"><img src="${escape(src)}" alt="${escape(p.image.alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;${css}"></a>`;
}

function line(html: string | null, css: string): string {
  return html ? `<div style="${css}">${html}</div>` : "";
}

/** The text column every layout shares, sized down for the narrower ones. */
function textColumn(p: FeatureParts, s: Style, size: "card" | "grid" | "list"): string {
  // A grid cell is narrow and a list row is one line: the first fact only in
  // a list, none in a grid.
  const facts = size === "grid" ? [] : size === "list" ? p.facts.slice(0, 1) : p.facts;
  const titlePx = size === "card" ? 20 : 16;
  return [
    line(p.eyebrow ? escape(p.eyebrow) : null, s.eyebrow),
    line(
      `<a href="${escape(p.href)}" style="color:${s.text};text-decoration:none">${escape(p.name)}</a>`,
      `margin:${p.eyebrow ? 4 : 0}px 0 0;${s.title(titlePx)}`,
    ),
    line(p.sub ? escape(p.sub) : null, `margin:4px 0 0;font-size:13px;line-height:1.45;color:${s.muted}`),
    ...facts.map((f) => line(escape(f), `margin:6px 0 0;font-size:13px;line-height:1.5;color:#32312d`)),
    line(
      p.price ? escape(p.price) : null,
      `margin:${size === "list" ? 6 : 10}px 0 0;font-size:${size === "card" ? 15 : 14}px;font-weight:600;color:${s.text}`,
    ),
    size === "list"
      ? ""
      : line(
          `<a href="${escape(p.href)}" style="color:${s.link};text-decoration:underline">${escape(p.cta)}</a>`,
          `margin:${size === "card" ? 14 : 10}px 0 0;font-size:13px;font-weight:500`,
        ),
  ].join("");
}

const COLUMN = 492;

function cardHtml(p: FeatureParts, s: Style, opts: FeatureRenderOptions): string {
  const photo = photoTag(p, COLUMN - 2, opts, "border-radius:8px 8px 0 0");
  return `<table role="presentation" dir="${s.dir}" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border:1px solid ${BORDER};border-radius:8px;border-collapse:separate;background:#ffffff;direction:${s.dir}">${
    photo ? `<tr><td style="padding:0;line-height:0">${photo}</td></tr>` : ""
  }<tr><td style="padding:16px 18px 18px;text-align:${s.start}">${textColumn(p, s, "card")}</td></tr></table>`;
}

function gridHtml(parts: FeatureParts[], s: Style, opts: FeatureRenderOptions): string {
  // The gutter is split between the two cells: padding on the side facing the
  // other cell, which is the far side in Arabic (the table runs right to left).
  const inner = (first: boolean) => {
    const towardsOther = first !== s.rtl ? "right" : "left";
    return `padding-${towardsOther}:6px;padding-bottom:14px`;
  };
  const cell = (p: FeatureParts | undefined, first: boolean) =>
    p
      ? `<td width="50%" valign="top" style="width:50%;vertical-align:top;${inner(first)};text-align:${s.start}"><table role="presentation" dir="${s.dir}" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;border-collapse:separate;background:#ffffff">${
          p.image ? `<tr><td style="padding:0;line-height:0">${photoTag(p, 238, opts, "border-radius:8px 8px 0 0")}</td></tr>` : ""
        }<tr><td style="padding:12px 12px 14px;text-align:${s.start}">${textColumn(p, s, "grid")}</td></tr></table></td>`
      : `<td width="50%" style="width:50%;${inner(first)}"></td>`;
  const rows: string[] = [];
  for (let i = 0; i < parts.length; i += 2) rows.push(`<tr>${cell(parts[i], true)}${cell(parts[i + 1], false)}</tr>`);
  return `<table role="presentation" dir="${s.dir}" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px;direction:${s.dir}">${rows.join("")}</table>`;
}

function listHtml(parts: FeatureParts[], s: Style, opts: FeatureRenderOptions): string {
  const pad = s.rtl ? "padding:0 14px 0 0" : "padding:0 0 0 14px";
  const rows = parts.map((p, i) => {
    const top = i === 0 ? "" : `border-top:1px solid ${BORDER};`;
    const thumb = p.image
      ? `<td width="96" valign="top" style="width:96px;padding:0;vertical-align:top;line-height:0">${photoTag(p, 96, opts, "border-radius:6px")}</td>`
      : "";
    return `<tr><td style="${top}padding:12px 0"><table role="presentation" dir="${s.dir}" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${thumb}<td valign="top" style="vertical-align:top;${p.image ? pad : "padding:0"};text-align:${s.start}">${textColumn(p, s, "list")}</td></tr></table></td></tr>`;
  });
  return `<table role="presentation" dir="${s.dir}" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};direction:${s.dir}">${rows.join("")}</table>`;
}

function partsText(p: FeatureParts): string {
  const detail = [p.sub, ...p.facts, p.price].filter(Boolean).join(" · ");
  return [p.name, detail, p.href].filter(Boolean).join("\n");
}

/**
 * One featured block, drawn. Records that are not live are left out; a block
 * with none left draws nothing at all (`null`), so an email never carries an
 * empty frame.
 */
export function renderFeatureBlock(
  block: EmailFeatureBlock,
  lookup: FeatureLookup,
  opts: FeatureRenderOptions,
): EmailBlock | null {
  const records = block.ids
    .map((id) => lookup.get(block.kind, id))
    .filter((r): r is FeatureRecord => r != null && r.kind === block.kind);
  if (records.length === 0) return null;
  const parts = records.map((r) => featureParts(r, opts));
  const s = styleFor(opts.brand, opts.locale);
  const html =
    block.layout === "grid" && parts.length > 1
      ? gridHtml(parts, s, opts)
      : block.layout === "list"
        ? listHtml(parts, s, opts)
        : parts.map((p) => cardHtml(p, s, opts)).join("");
  return { html, text: parts.map(partsText).join("\n\n") };
}

/** How many of a block's records would be drawn — the composer's "not live" notice. */
export function missingFeatures(block: EmailFeatureBlock, lookup: FeatureLookup): { id: string; label: string }[] {
  return block.ids
    .map((id, i) => ({ id, label: block.labels[i] ?? "", hit: lookup.get(block.kind, id) }))
    .filter((r) => r.hit === null)
    .map(({ id, label }) => ({ id, label }));
}

/**
 * Featured records the lookup could not answer for (`undefined` — the
 * database didn't reply), as opposed to records it found unpublished. A send
 * must not go out with those cards silently missing; the sender requeues it.
 */
export function unresolvedFeatures(blocks: readonly EmailFeatureBlock[], lookup: FeatureLookup): number {
  return blocks.reduce((n, b) => n + b.ids.filter((id) => lookup.get(b.kind, id) === undefined).length, 0);
}

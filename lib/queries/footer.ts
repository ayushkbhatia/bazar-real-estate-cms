import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseDeep } from "@/lib/i18n/localise";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import type {
  FooterColumn,
  FooterColumnKind,
  FooterContactItem,
  FooterContactKind,
  FooterContent,
  FooterLink,
  FooterSettings,
  FooterSocial,
} from "@/lib/schemas/footer";

/**
 * Server-side reads for the CMS-editable footer.
 *
 * Public render path (app/[locale]/(public)/layout.tsx):
 *   `getPublicFooter(locale)` — cookie-free, RLS filters hidden rows, falls
 *   back to `FOOTER_DEFAULTS` when Supabase env is missing so previews and
 *   offline dev still render a footer.
 *
 * Admin path (app/[locale]/(admin)/admin/footer):
 *   `getFooterForAdmin()` — every row including hidden ones, twins intact.
 */

// ───────────────────────────────────────────────────────────────
// Raw row shapes — what the two selects return, twins included.
// ───────────────────────────────────────────────────────────────
export type RawFooterSettings = {
  id?: string;
  blurb: string | null;
  blurb_ar: string | null;
  contact_heading: string | null;
  contact_heading_ar: string | null;
  legal_line: string | null;
  legal_line_ar: string | null;
};
export type RawFooterColumn = {
  id: string;
  kind: FooterColumnKind;
  position: number;
  heading: string | null;
  heading_ar: string | null;
  is_visible: boolean;
};
export type RawFooterLink = {
  id: string;
  column_id: string;
  position: number;
  label: string;
  label_ar: string | null;
  href: string;
};
export type RawFooterSocial = {
  id: string;
  position: number;
  label: string;
  href: string;
  is_visible: boolean;
};
export type RawFooterContactItem = {
  id: string;
  position: number;
  kind: FooterContactKind;
  label: string;
  label_ar: string | null;
  body: string;
  body_ar: string | null;
  is_visible: boolean;
};

export type FooterRaw = {
  settings: RawFooterSettings | null;
  columns: RawFooterColumn[];
  links: RawFooterLink[];
  socials: RawFooterSocial[];
  contact: RawFooterContactItem[];
};

const SETTINGS_COLUMNS =
  "blurb, blurb_ar, contact_heading, contact_heading_ar, legal_line, legal_line_ar";
const COLUMN_COLUMNS = "id, kind, position, heading, heading_ar, is_visible";
const LINK_COLUMNS = "id, column_id, position, label, label_ar, href";
const SOCIAL_COLUMNS = "id, position, label, href, is_visible";
const CONTACT_COLUMNS =
  "id, position, kind, label, label_ar, body, body_ar, is_visible";

// ───────────────────────────────────────────────────────────────
// Shaping + folding
// ───────────────────────────────────────────────────────────────
const EMPTY_SETTINGS: FooterSettings = {
  blurb: null,
  contact_heading: null,
  legal_line: null,
};

/**
 * Raw rows → the tree the renderer wants, at one locale.
 *
 * The fold runs on the RAW rows, before the shaping below builds its explicit
 * object literals — the order `lib/queries/megamenu.ts` learned the hard way.
 * Folding afterwards type-checks, reads correctly and does nothing at all,
 * because by then `label` is a literal and `label_ar` has been dropped on the
 * floor. `lib/queries/footer.fold.test.ts` is what proves the order is right
 * rather than this comment.
 *
 * Exported and pure so that test can drive the real composer without a
 * Supabase stub, the same way `composeAreaProfile` is.
 */
export function composeFooter(
  raw: FooterRaw,
  locale: Locale = DEFAULT_LOCALE,
): FooterContent {
  const settings = raw.settings
    ? localiseDeep(raw.settings, locale)
    : { ...EMPTY_SETTINGS };
  const columns = localiseDeep(raw.columns, locale);
  const links = localiseDeep(raw.links, locale);
  const socials = localiseDeep(raw.socials, locale);
  const contact = localiseDeep(raw.contact, locale);

  const linksByColumn = new Map<string, RawFooterLink[]>();
  for (const link of links) {
    const arr = linksByColumn.get(link.column_id) ?? [];
    arr.push(link);
    linksByColumn.set(link.column_id, arr);
  }

  const shapeLinks = (columnId: string): FooterLink[] =>
    (linksByColumn.get(columnId) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map<FooterLink>((l) => ({
        id: l.id,
        position: l.position,
        label: l.label,
        href: l.href,
      }));

  const ordered = columns.slice().sort((a, b) => a.position - b.position);

  return {
    settings: {
      blurb: settings.blurb,
      contact_heading: settings.contact_heading,
      legal_line: settings.legal_line,
    },
    columns: ordered
      .filter((c) => c.kind === "links")
      .map<FooterColumn>((c) => ({
        id: c.id,
        kind: c.kind,
        position: c.position,
        heading: c.heading,
        is_visible: c.is_visible,
        links: shapeLinks(c.id),
      })),
    // The bottom bar is one row of links however many `legal` columns exist,
    // so they are flattened here rather than asking the renderer to know that.
    legal: ordered
      .filter((c) => c.kind === "legal")
      .flatMap((c) => shapeLinks(c.id)),
    socials: socials
      .slice()
      .sort((a, b) => a.position - b.position)
      .map<FooterSocial>((s) => ({
        id: s.id,
        position: s.position,
        label: s.label,
        href: s.href,
        is_visible: s.is_visible,
      })),
    contact: contact
      .slice()
      .sort((a, b) => a.position - b.position)
      .map<FooterContactItem>((c) => ({
        id: c.id,
        position: c.position,
        kind: c.kind,
        label: c.label,
        body: c.body,
        is_visible: c.is_visible,
      })),
  };
}

// ───────────────────────────────────────────────────────────────
// Render helpers — derived, never stored.
// ───────────────────────────────────────────────────────────────
/**
 * One contact entry's lines, each with the link it earns.
 *
 * The href is derived from `kind` rather than stored beside the value, so a
 * number edited in the CMS cannot end up disagreeing with its own `tel:` —
 * which is the failure mode of every "phone" field that carries both.
 */
export function contactLines(
  item: Pick<FooterContactItem, "kind" | "body">,
): { value: string; href: string | null }[] {
  return item.body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((value) => {
      if (item.kind === "phone") {
        const dialable = value.replace(/[^\d+]/g, "");
        return { value, href: dialable ? `tel:${dialable}` : null };
      }
      if (item.kind === "email") return { value, href: `mailto:${value}` };
      return { value, href: null };
    });
}


// ───────────────────────────────────────────────────────────────
// Code defaults — only reached when Supabase env is missing.
// ───────────────────────────────────────────────────────────────
/**
 * What the footer draws with no database behind it.
 *
 * English only, and deliberately so: `site_settings` makes the same call for
 * the wordmark. A hardcoded Arabic footer here would be a second copy of the
 * seed in 0112, free to drift from it, in a language nobody reviewing this
 * file can proofread. A blank twin falls back to the English in place, which
 * is the site-wide rule — and `localiseRow` still asks the shared Arabic store
 * on the way past, so the strings the site already translates elsewhere come
 * out in Arabic even here.
 */
export const FOOTER_DEFAULTS: FooterRaw = {
  settings: {
    blurb:
      "Bazar Real Estate is a leading UAE real estate agency, serving the property market with expertise since 2005.",
    blurb_ar: null,
    contact_heading: "Contact",
    contact_heading_ar: null,
    legal_line:
      "© 2026 Bazar Real Estate L.L.C. All rights reserved. · ADM: 202400997397 · Regulated by ADREC & DLD",
    legal_line_ar: null,
  },
  columns: [],
  links: [],
  socials: [],
  contact: [],
};

// ───────────────────────────────────────────────────────────────
// Public read
// ───────────────────────────────────────────────────────────────
export async function getPublicFooter(
  /** Overridable for tests; defaults to the locale of the request. */
  locale?: Locale,
): Promise<FooterContent> {
  const active = locale ?? (await currentLocale());
  if (!isSupabaseConfigured) return composeFooter(FOOTER_DEFAULTS, active);
  try {
    const supabase = createSupabasePublicClient();
    const [settingsRes, columnsRes, linksRes, socialsRes, contactRes] =
      await Promise.all([
        supabase.from("footer_settings").select(SETTINGS_COLUMNS).maybeSingle(),
        supabase.from("footer_columns").select(COLUMN_COLUMNS).order("position"),
        supabase.from("footer_links").select(LINK_COLUMNS).order("position"),
        supabase.from("footer_socials").select(SOCIAL_COLUMNS).order("position"),
        supabase
          .from("footer_contact_items")
          .select(CONTACT_COLUMNS)
          .order("position"),
      ]);

    if (columnsRes.error) {
      console.error("[getPublicFooter] columns", columnsRes.error);
      return composeFooter(FOOTER_DEFAULTS, active);
    }
    return composeFooter(
      {
        settings:
          (settingsRes.data as RawFooterSettings | null) ??
          FOOTER_DEFAULTS.settings,
        columns: (columnsRes.data ?? []) as RawFooterColumn[],
        links: (linksRes.data ?? []) as RawFooterLink[],
        socials: (socialsRes.data ?? []) as RawFooterSocial[],
        contact: (contactRes.data ?? []) as RawFooterContactItem[],
      },
      active,
    );
  } catch (e) {
    console.error("[getPublicFooter]", e);
    return composeFooter(FOOTER_DEFAULTS, active);
  }
}

// ───────────────────────────────────────────────────────────────
// Admin read — every row, hidden included, twins intact.
// ───────────────────────────────────────────────────────────────
export async function getFooterForAdmin(): Promise<FooterRaw> {
  if (!isSupabaseConfigured) return FOOTER_DEFAULTS;
  const supabase = await createSupabaseServerClient();
  const [settingsRes, columnsRes, linksRes, socialsRes, contactRes] =
    await Promise.all([
      supabase.from("footer_settings").select(SETTINGS_COLUMNS).maybeSingle(),
      supabase.from("footer_columns").select(COLUMN_COLUMNS).order("position"),
      supabase.from("footer_links").select(LINK_COLUMNS).order("position"),
      supabase.from("footer_socials").select(SOCIAL_COLUMNS).order("position"),
      supabase
        .from("footer_contact_items")
        .select(CONTACT_COLUMNS)
        .order("position"),
    ]);
  if (columnsRes.error) console.error("[getFooterForAdmin]", columnsRes.error);
  return {
    settings:
      (settingsRes.data as RawFooterSettings | null) ??
      FOOTER_DEFAULTS.settings,
    columns: (columnsRes.data ?? []) as RawFooterColumn[],
    links: (linksRes.data ?? []) as RawFooterLink[],
    socials: (socialsRes.data ?? []) as RawFooterSocial[],
    contact: (contactRes.data ?? []) as RawFooterContactItem[],
  };
}

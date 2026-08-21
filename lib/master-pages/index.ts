import { MASTER_PAGES } from "./pages";
import { withArabicTwinsDeep } from "./twins";

// The twin helpers are part of the public surface of this module — the admin
// field editor derives its Arabic inputs from them.
export * from "./twins";
import { applyLocale } from "./i18n";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { fillArabic } from "./arabic";
import {
  isMediaField,
  isListField,
  isSelectField,
  isToggleField,
  type FieldDef,
  type ImageValue,
  type ItemValue,
  type MasterPageDef,
  type MasterPageKey,
  type ResolvedSection,
  type SectionDef,
  type SectionValues,
  type StoredSection,
} from "./types";

export * from "./types";
export { MASTER_PAGES } from "./pages";

/**
 * Master-page content is stored in the existing `pages` table under a reserved
 * slug, so no new table (and no migration) is needed: `pages.blocks` holds the
 * ordered section list. The `master/` slug prefix keeps these rows out of the
 * public /pages/[slug] route and out of the normal Pages list.
 */
export const MASTER_SLUG_PREFIX = "master/";

export function masterSlug(key: MasterPageKey): string {
  return `${MASTER_SLUG_PREFIX}${key}`;
}

export function isMasterSlug(slug: string): boolean {
  return slug.startsWith(MASTER_SLUG_PREFIX);
}

export function getMasterPage(key: string): MasterPageDef | null {
  return MASTER_PAGES.find((p) => p.key === key) ?? null;
}

export function isMasterPageKey(key: string): key is MasterPageKey {
  return MASTER_PAGES.some((p) => p.key === key);
}

// ── reading ──────────────────────────────────────────────────────────────

/**
 * Merge what's stored with what the code declares.
 *
 * The registry is authoritative for *what exists*: a section added in code
 * appears even if the stored document predates it, and a stored section whose
 * key no longer exists is dropped. Order and enabled-ness come from storage
 * when present, so an editor's arrangement survives new sections being added
 * (they land at the end).
 *
 * Field values fall back to the registry default individually, so a partial
 * stored document — or a section that gained a new field — still renders.
 */
export function resolveSections(
  def: MasterPageDef,
  stored: StoredSection[] | null,
  /**
   * Fold the result down to one language. Defaults to English, so every
   * existing caller and spec is unaffected until it opts in.
   *
   * Folding here rather than in the renderers is the whole point: all 473
   * `str(...)` calls and 63 adapter functions keep reading `values.title` and
   * never learn Arabic exists. `applyLocale` also guarantees the output has no
   * `_ar` key, so a renderer cannot read the storage shape by accident.
   *
   * Pass "bilingual" for the EDITOR, which needs both sides at once.
   */
  locale: Locale | "bilingual" = DEFAULT_LOCALE,
): ResolvedSection[] {
  const byKey = new Map((stored ?? []).map((s) => [s.key, s]));
  const ordered: SectionDef[] = [];

  if (stored && stored.length > 0) {
    for (const s of stored) {
      const sectionDef = def.sections.find((d) => d.key === s.key);
      if (sectionDef) ordered.push(sectionDef);
    }
    for (const d of def.sections) {
      if (!byKey.has(d.key)) ordered.push(d);
    }
  } else {
    ordered.push(...def.sections);
  }

  return ordered.map((sectionDef) => {
    const s = byKey.get(sectionDef.key);
    const merged = mergeValues(sectionDef, s?.values ?? null);
    return {
      key: sectionDef.key,
      def: sectionDef,
      // Locked sections can't be switched off, whatever storage claims.
      // Anything else takes the stored flag, then the section's own default —
      // which is how a section ships off but stays editable.
      enabled: sectionDef.locked
        ? true
        : (s?.enabled ?? sectionDef.defaultEnabled ?? true),
      values:
        locale === "bilingual"
          ? merged
          : applyLocale(merged, locale, `${sectionDef.key}.`).values,
    };
  });
}

/**
 * Field-by-field fallback to the registry defaults.
 *
 * Exported because the page builder resolves its blocks the same way — a block
 * that gains a field renders, and a stored document that predates the field is
 * not a broken document.
 */
export function mergeValues(
  def: { fields: FieldDef[]; defaults: SectionValues },
  stored: SectionValues | null,
): SectionValues {
  const out: SectionValues = {};
  // Twins are derived, not declared, so they are not in `def.fields` — without
  // this the Arabic value is dropped on every read and the editor shows an
  // empty box over stored content.
  for (const field of withArabicTwinsDeep(def.fields)) {
    const value = stored?.[field.key];
    out[field.key] =
      value === undefined || value === null
        ? (def.defaults[field.key] ?? emptyFor(field))
        : value;
  }
  /*
   * Generated Arabic goes in LAST, and only where nothing else supplied it.
   *
   * It has to happen here rather than on `def.defaults`, because the English it
   * belongs to may have come from either side of this merge. Folding it into
   * the defaults meant an editor who rewrote a headline kept the Arabic of the
   * headline they replaced — measured at 303 slots against production. See
   * `lib/master-pages/arabic.ts`.
   */
  return fillArabic(def.fields, out);
}

export function emptyFor(field: FieldDef) {
  if (isListField(field)) return [];
  if (isSelectField(field)) return null;
  if (isToggleField(field)) return true;
  // A file field stores the same shape as an image field — see FileFieldDef.
  if (isMediaField(field)) return { media_id: null, alt: null, label: null };
  return null;
}

/** Convenience for renderers: `values` keyed lookup with a string result. */
export function str(values: SectionValues, key: string): string | null {
  const v = values[key];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

export function img(values: SectionValues, key: string): ImageValue | null {
  const v = values[key];
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as ImageValue;
}

/**
 * List values. An empty list means "the section keeps whatever it renders by
 * default" — several sections draw their items from code or from the database,
 * and an editor who has never touched them shouldn't blank them out.
 */
export function list<T = Record<string, string | null | ImageValue>>(
  values: SectionValues,
  key: string,
): T[] {
  const v = values[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Pairs for the [value, label] tuple shape the brand components take. */
export function statPairs(
  values: SectionValues,
  key = "stats",
): [string, string][] {
  return list<{ value?: string; label?: string }>(values, key)
    .map((s) => [s.value ?? "", s.label ?? ""] as [string, string])
    .filter(([v, l]) => v !== "" || l !== "");
}

export function faqPairs(
  values: SectionValues,
  key = "items",
): [string, string][] {
  return list<{ q?: string; a?: string }>(values, key)
    .map((s) => [s.q ?? "", s.a ?? ""] as [string, string])
    .filter(([q]) => q !== "");
}

// ── writing ──────────────────────────────────────────────────────────────

export type ValidationIssue = { section: string; field: string; message: string };

/**
 * Validate + normalise an incoming document against the registry. Returns the
 * document to store (unknown sections and fields stripped, strings trimmed,
 * blanks normalised to null) or the list of problems.
 *
 * Validation is generated from the field definitions rather than hand-written
 * per section, so the registry stays the single source of truth.
 */
export function validateSections(
  def: MasterPageDef,
  incoming: StoredSection[],
): { ok: true; sections: StoredSection[] } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const sections: StoredSection[] = [];

  for (const raw of incoming) {
    const sectionDef = def.sections.find((d) => d.key === raw.key);
    if (!sectionDef || seen.has(raw.key)) continue;
    seen.add(raw.key);

    const values = validateFieldValues(
      sectionDef.fields,
      raw.values ?? {},
      sectionDef.label,
      issues,
    );

    sections.push({
      key: sectionDef.key,
      enabled: sectionDef.locked ? true : raw.enabled !== false,
      values,
    });
  }

  // Anything the client didn't send keeps its position at the end, enabled —
  // a stale editor tab shouldn't silently drop a section added since it loaded.
  for (const d of def.sections) {
    if (!seen.has(d.key)) {
      sections.push({ key: d.key, enabled: true, values: {} });
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, sections };
}

/**
 * Normalise one flat bag of values against a field list.
 *
 * Split out of `validateSections` so the page builder can validate a block
 * instance with the same rules — a block and a master-page section differ in
 * how they are addressed, not in what a field means.
 */
export function validateFieldValues(
  fields: FieldDef[],
  incoming: SectionValues | Record<string, unknown>,
  label: string,
  issues: ValidationIssue[],
): SectionValues {
  const values: SectionValues = {};
  // Deep, not shallow. The list branch below iterates `field.fields`, so a
  // shallow pass would keep `title_ar` but silently strip `items[].q_ar` on
  // the first save — the editor types Arabic into an FAQ, presses save, sees
  // "Saved.", and the Arabic is gone.
  for (const field of withArabicTwinsDeep(fields)) {
    const value = (incoming as Record<string, unknown>)[field.key];
    if (isListField(field)) {
      // Absent means "unchanged", exactly as it does for a scalar below —
      // reading merges the registry default back in. Coercing an absent key to
      // `[]` wrote an empty list over the default, and an empty list is not a
      // neutral value here: every list-driven section renders nothing at all
      // when its list is empty (lib/page-builder/content-gap.ts). Only a list
      // the client actually submitted empty counts as emptied.
      if (value === undefined) continue;
      const arr = Array.isArray(value) ? value : [];
      if (arr.length > field.max) {
        issues.push({
          section: label,
          field: field.label,
          message: `Keep it to ${field.max} ${field.itemLabel}s or fewer.`,
        });
      }
      values[field.key] = arr.slice(0, field.max).map((item) => {
        const out: Record<string, ItemValue> = {};
        for (const sub of field.fields) {
          out[sub.key] = normaliseScalar(
            sub,
            (item as Record<string, unknown>)?.[sub.key],
            label,
            issues,
          );
        }
        return out;
      });
    } else if (value !== undefined) {
      // A key the client didn't send means "unchanged" — reading merges the
      // default back in — so only a value that was actually submitted blank
      // counts as a blank required field.
      values[field.key] = normaliseScalar(field, value, label, issues);
    }
  }
  return values;
}

export function normaliseScalar(
  field: Exclude<FieldDef, { kind: "list" }>,
  value: unknown,
  sectionLabel: string,
  issues: ValidationIssue[],
): ItemValue {
  if (isToggleField(field)) {
    // Anything but an explicit false reads as on, so a card added by an older
    // client (or by hand) defaults to visible rather than silently hidden.
    return value !== false;
  }
  if (isSelectField(field)) {
    const picked = trimOrNull(value);
    // A record pick (`optionsKey`) is deliberately not checked against the live
    // records: a record can be unpublished or renamed after the fact, and the
    // renderer already drops picks it can't resolve. A code-declared choice
    // (`options`) is a closed set the renderer switches on, so an unknown value
    // there is a bug or a stale tab, not an editorial decision.
    if (field.options && picked !== null) {
      if (!field.options.some((o) => o.value === picked)) {
        issues.push({
          section: sectionLabel,
          field: field.label,
          message: `"${picked}" isn't one of the available choices.`,
        });
        return null;
      }
    }
    return picked;
  }
  if (isMediaField(field)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { media_id: null, alt: null, label: null };
    }
    const v = value as Record<string, unknown>;
    // Rebuilt key by key with no spread, so anything not named here is
    // destroyed on save. `alt_ar` is the Arabic alt text — write-only data
    // loss without it, on the one surface an English-reading editor is least
    // likely to re-check.
    //
    // Emitted only when it has a value, rather than always as null. Every
    // image in every section document carries one of these, and a null key on
    // all of them is pure jsonb weight for content that has no Arabic. It also
    // keeps the stored shape byte-identical for English-only pages, so this
    // change rewrites nothing already in the database.
    //
    // `media_id_ar` is the Arabic rendering of the artwork and is preserved on
    // the same terms, for the same reason.
    const altAr = trimOrNull(v.alt_ar);
    const mediaIdAr = trimOrNull(v.media_id_ar);
    return {
      media_id: trimOrNull(v.media_id),
      ...(mediaIdAr === null ? {} : { media_id_ar: mediaIdAr }),
      alt: trimOrNull(v.alt),
      ...(altAr === null ? {} : { alt_ar: altAr }),
      label: trimOrNull(v.label),
    };
  }

  const text = trimOrNull(value);
  if (text === null) {
    if (field.optional === false || (field.kind === "text" && !field.optional)) {
      issues.push({
        section: sectionLabel,
        field: field.label,
        message: "Can't be empty.",
      });
    }
    return null;
  }
  if (field.max && text.length > field.max) {
    issues.push({
      section: sectionLabel,
      field: field.label,
      message: `Too long — max ${field.max} characters.`,
    });
  }
  return text;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Coerce a `pages.blocks` jsonb payload into stored sections. */
export function parseStoredSections(raw: unknown): StoredSection[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: StoredSection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.key !== "string") continue;
    out.push({
      key: r.key,
      enabled: r.enabled !== false,
      values:
        r.values && typeof r.values === "object" && !Array.isArray(r.values)
          ? (r.values as SectionValues)
          : {},
    });
  }
  return out.length > 0 ? out : null;
}

/**
 * Defaults as a storable document — used by "reset page".
 *
 * `enabled` follows the section's own default rather than being forced on, so
 * a reset returns the page to how it ships. Without that, resetting an area
 * guide switched every legacy band back on — the opposite of a reset.
 */
export function defaultDocument(def: MasterPageDef): StoredSection[] {
  return def.sections.map((s) => ({
    key: s.key,
    enabled: s.locked ? true : (s.defaultEnabled ?? true),
    values: { ...s.defaults },
  }));
}

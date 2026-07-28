import { MASTER_PAGES } from "./pages";
import {
  isImageField,
  isListField,
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
    return {
      key: sectionDef.key,
      def: sectionDef,
      // Locked sections can't be switched off, whatever storage claims.
      enabled: sectionDef.locked ? true : (s?.enabled ?? true),
      values: mergeValues(sectionDef, s?.values ?? null),
    };
  });
}

function mergeValues(
  def: SectionDef,
  stored: SectionValues | null,
): SectionValues {
  const out: SectionValues = {};
  for (const field of def.fields) {
    const value = stored?.[field.key];
    out[field.key] =
      value === undefined || value === null
        ? (def.defaults[field.key] ?? emptyFor(field))
        : value;
  }
  return out;
}

function emptyFor(field: FieldDef) {
  if (isListField(field)) return [];
  if (isToggleField(field)) return true;
  if (isImageField(field)) return { media_id: null, alt: null, label: null };
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

    const values: SectionValues = {};
    for (const field of sectionDef.fields) {
      const value = (raw.values ?? {})[field.key];
      if (isListField(field)) {
        const arr = Array.isArray(value) ? value : [];
        if (arr.length > field.max) {
          issues.push({
            section: sectionDef.label,
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
              sectionDef.label,
              issues,
            );
          }
          return out;
        });
      } else if (value !== undefined) {
        // A key the client didn't send means "unchanged" — reading merges the
        // default back in — so only a value that was actually submitted blank
        // counts as a blank required field.
        values[field.key] = normaliseScalar(
          field,
          value,
          sectionDef.label,
          issues,
        );
      }
    }

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

function normaliseScalar(
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
  if (isImageField(field)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { media_id: null, alt: null, label: null };
    }
    const v = value as Record<string, unknown>;
    return {
      media_id: trimOrNull(v.media_id),
      alt: trimOrNull(v.alt),
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

/** Defaults as a storable document — used by "reset page". */
export function defaultDocument(def: MasterPageDef): StoredSection[] {
  return def.sections.map((s) => ({
    key: s.key,
    enabled: true,
    values: { ...s.defaults },
  }));
}

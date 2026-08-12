/**
 * Reading, resolving and validating a stored landing document.
 *
 * The one place this deliberately diverges from master pages.
 *
 * `parseBlocks` (lib/schemas/page.ts) and `parseStoredSections`
 * (lib/master-pages/index.ts) both drop items they don't recognise, silently.
 * That is safe there because those documents are *derived*: `resolveSections`
 * can regenerate any master-page section from the registry, so a dropped
 * section costs an editor's overrides and nothing else.
 *
 * A landing page's copy is *authored*. The eyebrow, the headline, the CTA text
 * exist nowhere but that jsonb. Dropping a block the code no longer recognises
 * would lose it — and then compound, because the editor would open the page,
 * see one block fewer, save, and write the truncation back permanently. One
 * deploy plus one save.
 *
 * So the rules here are:
 *
 *   unknown `type`          → KEEP in the document, skip at render, show the
 *                             editor a locked card saying so
 *   known type, field gone  → fall back to the registry default (same as master)
 *   known type, extra field → keep it, round-trip untouched
 *   no `type` at all        → drop, but count it into `dropped`
 *
 * The invariant, stated so it can be tested: `serialise(parse(x))` never loses
 * a block that `x` contained, and a block the code no longer understands
 * round-trips byte-identical through an editor save.
 */

import {
  mergeValues,
  validateFieldValues,
  type SectionValues,
  type ValidationIssue,
} from "@/lib/master-pages";
import { applyLocale } from "@/lib/master-pages/i18n";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { getBlockDef } from "./catalogue";
import type { BlockInstance, LandingDocument, ResolvedBlock } from "./types";

/** Coerce a `landing_pages.blocks` jsonb payload into block instances. */
export function parseLandingDocument(raw: unknown): LandingDocument {
  if (!Array.isArray(raw)) return { blocks: [], dropped: 0 };

  const blocks: BlockInstance[] = [];
  let dropped = 0;

  raw.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      dropped += 1;
      return;
    }
    const r = item as Record<string, unknown>;
    if (typeof r.type !== "string" || r.type === "") {
      // Nothing identifies what this was meant to render. Unlike an unknown
      // type — which we can at least name and preserve — there is nothing here
      // to keep, so the honest thing is to count it and tell the editor.
      dropped += 1;
      return;
    }
    blocks.push({
      // A stored block written before ids existed gets a deterministic one, so
      // two reads of the same row agree and React doesn't remount the subtree.
      id: typeof r.id === "string" && r.id !== "" ? r.id : `${r.type}-${index}`,
      type: r.type,
      v: typeof r.v === "number" && Number.isFinite(r.v) ? r.v : 1,
      enabled: r.enabled !== false,
      values:
        r.values && typeof r.values === "object" && !Array.isArray(r.values)
          ? (r.values as SectionValues)
          : {},
    });
  });

  return { blocks, dropped };
}

export function serialiseDocument(doc: LandingDocument): BlockInstance[] {
  return doc.blocks;
}

/**
 * Merge each block's stored values over its registry defaults.
 *
 * Field-by-field, so a block that gains a field in code renders correctly over
 * a document that predates it. Unknown types come back with `def: null` and
 * their values untouched.
 */
export function resolveDocument(
  blocks: BlockInstance[],
  /**
   * Fold to one language. Defaults to English so existing callers and specs
   * are unaffected; the editor passes "bilingual" to keep both sides.
   *
   * Unknown block types are folded too. Their values are opaque to this build,
   * but a `<key>_ar` sibling is a convention, not a schema — folding it keeps
   * an unknown block rendering Arabic rather than leaking `title_ar` into the
   * locked card.
   */
  locale: Locale | "bilingual" = DEFAULT_LOCALE,
): ResolvedBlock[] {
  return blocks.map((block) => {
    const def = getBlockDef(block.type);
    if (!def) {
      return {
        id: block.id,
        type: block.type,
        def: null,
        enabled: block.enabled,
        values:
          locale === "bilingual"
            ? block.values
            : applyLocale(block.values, locale).values,
      };
    }
    const target = def.version ?? 1;
    const migrated =
      def.migrate && block.v < target
        ? def.migrate(block.values, block.v)
        : block.values;
    return {
      id: block.id,
      type: block.type,
      def,
      enabled: block.enabled,
      values:
        locale === "bilingual"
          ? mergeValues(def, migrated)
          : applyLocale(mergeValues(def, migrated), locale, `${block.type}.`)
              .values,
    };
  });
}

/** Blocks that will actually render: enabled, and known to this build. */
export function renderableBlocks(blocks: ResolvedBlock[]): ResolvedBlock[] {
  return blocks.filter((b) => b.enabled && b.def !== null);
}

export type DocumentValidation =
  | { ok: true; blocks: BlockInstance[] }
  | { ok: false; issues: string[] };

/**
 * Normalise an incoming document against the catalogue.
 *
 * Values for *known* types come from the client payload through the shared
 * per-field normaliser. Values for *unknown* types come from `stored` — what
 * the database already holds — never from the client. A stale tab can reorder
 * or switch off a block it doesn't understand; it cannot invent or corrupt one.
 * That is the `saveForm` rule (app/[locale]/(admin)/admin/forms/_actions.ts) applied to
 * a document whose vocabulary can outlive a deploy.
 */
export function validateDocument(
  incoming: BlockInstance[],
  stored: BlockInstance[],
): DocumentValidation {
  const issues: ValidationIssue[] = [];
  const storedById = new Map(stored.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const blocks: BlockInstance[] = [];

  for (const raw of incoming) {
    if (typeof raw?.id !== "string" || raw.id === "" || seen.has(raw.id)) {
      continue;
    }
    seen.add(raw.id);

    const def = getBlockDef(raw.type);
    if (!def) {
      const previous = storedById.get(raw.id);
      // An unknown block the database has never seen is not a block — it is a
      // client sending a type this build can't name. Nothing to preserve.
      if (!previous || previous.type !== raw.type) continue;
      blocks.push({ ...previous, enabled: raw.enabled !== false });
      continue;
    }

    const values = validateFieldValues(
      def.fields,
      raw.values ?? {},
      def.label,
      issues,
    );

    blocks.push({
      id: raw.id,
      type: def.key,
      v: def.version ?? 1,
      enabled: raw.enabled !== false,
      values,
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: issues.map((i) => `${i.section} · ${i.field}: ${i.message}`),
    };
  }
  return { ok: true, blocks };
}

/** How many enabled blocks this build can't render. */
export function unknownBlockCount(blocks: ResolvedBlock[]): number {
  return blocks.filter((b) => b.enabled && b.def === null).length;
}

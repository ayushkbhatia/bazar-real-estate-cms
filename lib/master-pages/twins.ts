import type { FieldDef, SimpleFieldDef, ListFieldDef } from "./types";

/**
 * Arabic twins, DERIVED from the field definitions rather than declared.
 *
 * This is the highest-leverage idea in the whole Arabic epic. `SectionValues`
 * is already `Record<string, FieldValue>` and every document column is already
 * jsonb, so a sibling `title_ar` beside `title` is already type-legal and
 * already storable. It does not survive today only because `mergeValues` and
 * `validateFieldValues` build their output by iterating `def.fields` and drop
 * everything else.
 *
 * Deriving instead of declaring is what makes it free: all 16 master pages,
 * both live subpage kinds and all 16 catalogue blocks gain Arabic from one
 * change — and so does every section anyone adds afterwards, structurally,
 * without remembering to.
 *
 * `lib/master-pages/sections/contact-qr.ts` hand-declares 14 `*_ar` fields.
 * They are preserved rather than migrated: a hand-declared twin wins, keeping
 * its own label and its Arabic default. That existing convention becomes the
 * first citizen of the general rule instead of a special case to unpick.
 */

/** The suffix. One place, so nothing hardcodes the string. */
export const AR = "_ar" as const;

export function arKey(key: string): string {
  return `${key}${AR}`;
}

export function isArKey(key: string): boolean {
  return key.endsWith(AR);
}

/** The English key an Arabic twin belongs to, or null if it isn't a twin. */
export function baseKey(key: string): string | null {
  return isArKey(key) ? key.slice(0, -AR.length) : null;
}

/**
 * Does this field carry prose a translator would need?
 *
 * `link` is excluded because it holds a URL or a route, not language. Toggles,
 * selects, images and files hold no prose either — a select's *options* might,
 * but those live in the registry and are translated with the component, not
 * per-page.
 */
export function isTranslatable(field: FieldDef): boolean {
  if (field.kind !== "text" && field.kind !== "textarea") return false;
  if ((field as SimpleFieldDef).i18n === false) return false;
  // A twin is not itself translatable, or contact-qr's hand-declared fields
  // would sprout `title_ar_ar`.
  return !isArKey(field.key);
}

/** Arabic length allowance. Arabic runs longer than English for the same copy. */
export function arMax(field: SimpleFieldDef): number | undefined {
  if (field.maxAr) return field.maxAr;
  return field.max ? Math.ceil(field.max * 1.5) : undefined;
}

/**
 * The Arabic twins implied by a field list.
 *
 * Two filters carry the whole design:
 *
 *   - `isTranslatable` decides what gets one at all.
 *   - the `declared` check means a hand-written twin WINS. That is what lets
 *     contact-qr keep its 14 bespoke fields, with their labels and their
 *     Arabic defaults, and `sections.test.ts` pass unmodified — no key rename,
 *     no data migration.
 */
export function arabicTwins(fields: FieldDef[]): SimpleFieldDef[] {
  const declared = new Set(fields.map((f) => f.key));

  return fields.filter(isTranslatable).flatMap((field) => {
    const twin = arKey(field.key);
    if (declared.has(twin)) return [];
    const simple = field as SimpleFieldDef;
    return [
      {
        key: twin,
        label: `${simple.label} (العربية)`,
        kind: simple.kind,
        help: simple.help,
        max: arMax(simple),
        // Always optional: a missing Arabic value falls back to the English
        // one at render time, so requiring it would block publishing a page
        // that renders perfectly well.
        optional: true,
      } satisfies SimpleFieldDef,
    ];
  });
}

/**
 * A field list with its twins interleaved after each English sibling.
 *
 * Order matters for the editor: the Arabic input belongs directly under the
 * English it translates, not in a block at the bottom where a translator has
 * to hold the pairing in their head.
 */
export function withArabicTwins(fields: FieldDef[]): FieldDef[] {
  const declared = new Set(fields.map((f) => f.key));
  const out: FieldDef[] = [];

  for (const field of fields) {
    out.push(field);
    // A hand-declared twin is already in `fields` and will be pushed in its
    // own turn — don't emit it twice.
    if (!isTranslatable(field)) continue;
    if (declared.has(arKey(field.key))) continue;
    const [twin] = arabicTwins([field]);
    if (twin) out.push(twin);
  }
  return out;
}

/** List sub-fields get twins too — `items[].q` needs `items[].q_ar`. */
export function withArabicTwinsDeep(fields: FieldDef[]): FieldDef[] {
  return withArabicTwins(fields).map((field) =>
    field.kind === "list"
      ? ({
          ...(field as ListFieldDef),
          fields: withArabicTwins(
            (field as ListFieldDef).fields,
          ) as ListFieldDef["fields"],
        } satisfies ListFieldDef)
      : field,
  );
}

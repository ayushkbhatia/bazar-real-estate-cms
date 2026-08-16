/**
 * Every translatable string inside a jsonb section document, as an address.
 *
 * ## Why this exists
 *
 * `MtTarget` (`targets.ts`) addresses a flat `{table, column}`. All four
 * registered targets are `text` columns on a row. But the overwhelming
 * majority of this site's editorial copy does not live in columns — it lives
 * in `pages.blocks`, `landing_pages.blocks` and the subpage documents, as
 * nested jsonb: sixteen master pages, two subpage kinds, sixteen Page Builder
 * blocks. `lib/i18n/domains.ts` marks every one of those `inBag: true`, and
 * `translatableKeys()` filters them out entirely — so they are invisible to
 * `missingEditor()` and `missingReadFold()` as well as to the translator.
 *
 * Storage, editor and read fold all already work for them: `twins.ts` derives
 * the `_ar` field, `mergeValues` reads it, `applyLocale` folds it. The only
 * missing piece is something that can *enumerate* the slots. That is this.
 *
 * ## What it deliberately does not do
 *
 * It reuses rather than reimplements. `isTranslatable` decides what counts,
 * `withArabicTwinsDeep` decides the twin's key and cap, `mergeValues` decides
 * what the effective values are. Two copies of any of those rules is how the
 * editor and the generator come to disagree about what exists — and the
 * disagreement would be invisible, because both would look right in isolation.
 *
 * In particular the twin's cap comes from indexing `withArabicTwinsDeep`'s
 * output rather than calling `arMax` directly. That is not a style preference:
 * `contact-qr.ts` hand-declares fourteen twins with their own `max`, and a
 * hand-declared twin WINS. Calling `arMax` would silently use the derived cap
 * for exactly those fourteen fields.
 */
import {
  isTranslatable,
  arKey,
  withArabicTwinsDeep,
} from "@/lib/master-pages/twins";
import { isListField, isMediaField } from "@/lib/master-pages/types";
import type {
  FieldDef,
  SimpleFieldDef,
  ImageValue,
  ItemValue,
  SectionValues,
  SectionDef,
} from "@/lib/master-pages/types";
import type { MtKind } from "./prompt";
import { nonProseReason } from "@/lib/i18n/prose";

/** One addressable translatable string. */
export type Slot = {
  /** `master:home`, `area:saadiyat-island`, `landing:<uuid>`. */
  docKey: string;
  /** `SectionDef.key`, or the block instance id for a landing page. */
  sectionKey: string;
  /** Address within the section's values: `["items", 3, "q"]`. */
  path: (string | number)[];
  /** Stable string form of `path` — the provenance key and the diff label. */
  pathKey: string;
  english: string;
  /** The sibling key to write, at the depth `path` points into. */
  arKey: string;
  /** What is already stored there, if anything. */
  arabic: string | null;
  kind: MtKind;
  maxLength?: number;
  /**
   * Why this slot is in the list.
   *
   * `identity` is the interesting one: the value is data rather than language
   * ("78%", "40/60") and must be copied through *unchanged* rather than sent
   * to a model. It is still a slot, because the Arabic side still needs the
   * value written — an empty `_ar` renders the English, which for "78%" is
   * identical anyway, but leaving it blank makes coverage reporting lie.
   */
  why: "missing" | "identity";
};

/**
 * Keys whose value is a control, not copy.
 *
 * Kept as an explicit set rather than a pattern on `_label`, because the
 * pattern is wrong in both directions here: `phone_label` ("Phone · heading")
 * and `chips_label` ("Chips heading") are section headings, while `cta` is a
 * button. Short strings are caught by the length rule below regardless, so
 * this only has to name the ones that are long enough to look like prose.
 */
const CONTROL_KEYS = new Set(["cta_label", "cta", "submit_label", "save_label"]);

/**
 * Which register to translate a field in.
 *
 * Length- and role-driven rather than surface-driven, and the distinction that
 * matters is `ui` vs `title`.
 *
 * `UI_SYSTEM_PROMPT` exists to stop one specific failure: a model told it is
 * translating property listings resolves an ambiguous single word toward
 * property vocabulary — "Optional" became فاخر, "Comfortable" became شقة مريحة.
 * Its fix is blunt, and correctly so: *"You are NOT translating a property
 * listing."*
 *
 * Applied to master-page copy that is a category error. "Off-plan projects for
 * sale", "Twenty years of Abu Dhabi, properly understood" — these ARE property
 * marketing, and every one of them wants the property sense of every ambiguous
 * word. Under the `ui` prompt they come back in the register of a bank's form
 * controls, which is the mirror image of the bug that prompt was written for.
 *
 * So `ui` is reserved for the short, control-shaped strings where the original
 * failure genuinely recurs — a button reading "Fixed" or "Compare" behaves the
 * same whether it sits on a calculator or a hero.
 */
export function kindForField(field: SimpleFieldDef): MtKind {
  if (field.kind === "textarea") {
    return (field.max ?? 600) > 400 ? "body" : "summary";
  }
  if (CONTROL_KEYS.has(field.key)) return "ui";
  return (field.max ?? 160) <= 24 ? "ui" : "title";
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function pathKeyOf(path: (string | number)[]): string {
  return path
    .map((p, i) => (typeof p === "number" ? `[${p}]` : i === 0 ? p : `.${p}`))
    .join("");
}

function slotFor(input: {
  docKey: string;
  sectionKey: string;
  path: (string | number)[];
  english: string;
  arKey: string;
  arabic: string | null;
  kind: MtKind;
  maxLength?: number;
}): Slot {
  return {
    ...input,
    pathKey: pathKeyOf(input.path),
    why: nonProseReason(input.english) ? "identity" : "missing",
  };
}

/**
 * Media alt text.
 *
 * `isTranslatable` returns false for an image field — it accepts only `text`
 * and `textarea` — so alt text needs its own branch. `alt_ar` is a fixed key on
 * `ImageValue`, not a derived twin, and `normaliseScalar` rebuilds the object
 * key by key with no spread, so anything it does not name is destroyed on the
 * next save. That is why the cap here is stated rather than derived: it matches
 * the `media_assets.alt_text` target in `targets.ts`.
 */
const ALT_MAX = 200;

function mediaSlot(
  docKey: string,
  sectionKey: string,
  path: (string | number)[],
  value: unknown,
): Slot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const img = value as ImageValue;
  const english = str(img.alt);
  if (!english) return null;
  return slotFor({
    docKey,
    sectionKey,
    path: [...path, "alt"],
    english,
    arKey: "alt_ar",
    arabic: str(img.alt_ar),
    kind: "alt",
    maxLength: ALT_MAX,
  });
}

/**
 * Slots in one section.
 *
 * `values` MUST be `mergeValues(def, stored)` output. Walking raw stored values
 * would miss most of the corpus: the great majority of sections have never been
 * edited, so their English lives only in `def.defaults` and their stored blob
 * is absent entirely.
 */
export function walkSection(input: {
  fields: FieldDef[];
  values: SectionValues;
  docKey: string;
  sectionKey: string;
}): Slot[] {
  const { docKey, sectionKey, values } = input;
  // Indexed so a hand-declared twin's own `max` wins over the derived one.
  const twinned = new Map(
    withArabicTwinsDeep(input.fields).map((f) => [f.key, f] as const),
  );
  const out: Slot[] = [];

  for (const field of input.fields) {
    if (isMediaField(field)) {
      const slot = mediaSlot(docKey, sectionKey, [field.key], values[field.key]);
      if (slot) out.push(slot);
      continue;
    }

    if (isListField(field)) {
      const items = Array.isArray(values[field.key])
        ? (values[field.key] as Record<string, ItemValue>[])
        : [];
      // The list's OWN twinned sub-fields, so a hand-declared sub-twin wins too.
      const listTwins = new Map(
        ((twinned.get(field.key) as typeof field | undefined)?.fields ?? []).map(
          (f) => [f.key, f] as const,
        ),
      );
      items.forEach((item, i) => {
        for (const sub of field.fields) {
          if (isMediaField(sub)) {
            const slot = mediaSlot(
              docKey,
              sectionKey,
              [field.key, i, sub.key],
              item?.[sub.key],
            );
            if (slot) out.push(slot);
            continue;
          }
          if (!isTranslatable(sub)) continue;
          const english = str(item?.[sub.key]);
          if (!english) continue;
          const twin = listTwins.get(arKey(sub.key)) as
            | SimpleFieldDef
            | undefined;
          out.push(
            slotFor({
              docKey,
              sectionKey,
              path: [field.key, i, sub.key],
              english,
              arKey: arKey(sub.key),
              arabic: str(item?.[arKey(sub.key)]),
              kind: kindForField(sub as SimpleFieldDef),
              maxLength: twin?.max,
            }),
          );
        }
      });
      continue;
    }

    if (!isTranslatable(field)) continue;
    const english = str(values[field.key]);
    if (!english) continue;
    const twin = twinned.get(arKey(field.key)) as SimpleFieldDef | undefined;
    out.push(
      slotFor({
        docKey,
        sectionKey,
        path: [field.key],
        english,
        arKey: arKey(field.key),
        arabic: str(values[arKey(field.key)]),
        kind: kindForField(field as SimpleFieldDef),
        maxLength: twin?.max,
      }),
    );
  }

  return out;
}

/** Slots across a whole document, given each section's resolved values. */
export function walkResolved(
  docKey: string,
  sections: { key: string; def: { fields: FieldDef[] }; values: SectionValues }[],
): Slot[] {
  return sections.flatMap((s) =>
    walkSection({
      fields: s.def.fields,
      values: s.values,
      docKey,
      sectionKey: s.key,
    }),
  );
}

/** Convenience for a registry walk with no stored values — defaults only. */
export function walkDefaults(docKey: string, sections: SectionDef[]): Slot[] {
  return sections.flatMap((s) =>
    walkSection({
      fields: s.fields,
      values: s.defaults,
      docKey,
      sectionKey: s.key,
    }),
  );
}

/**
 * Write translated slots back into a values bag.
 *
 * Only `_ar` keys are written, and every English value keeps its identity — a
 * translated document differs from its source by additions only, which is what
 * lets the diff be read and what makes it impossible for a bad run to lose
 * copy. `results` is keyed by `pathKey`.
 */
export function applySlots(
  values: SectionValues,
  slots: Slot[],
  results: Map<string, string>,
): SectionValues {
  const out: SectionValues = { ...values };

  for (const slot of slots) {
    const arabic = results.get(slot.pathKey);
    if (arabic === undefined) continue;

    const [head, ...rest] = slot.path;
    if (typeof head !== "string") continue;

    // Scalar: `["title"]` writes `title_ar` beside it.
    if (rest.length === 0) {
      out[slot.arKey] = arabic;
      continue;
    }

    // Scalar media alt: `["image", "alt"]`.
    if (rest.length === 1 && rest[0] === "alt") {
      const img = out[head];
      if (img && typeof img === "object" && !Array.isArray(img)) {
        out[head] = { ...(img as ImageValue), alt_ar: arabic };
      }
      continue;
    }

    // Everything else is inside a list item.
    const [index, ...tail] = rest;
    if (typeof index !== "number" || !Array.isArray(out[head])) continue;
    const items = [...(out[head] as Record<string, ItemValue>[])];
    const item = { ...(items[index] ?? {}) };

    if (tail.length === 1) {
      // `["items", 3, "q"]` — the twin sits inside the item object, which is
      // the whole reason the index has to be part of the address.
      item[slot.arKey] = arabic;
    } else if (tail.length === 2 && tail[1] === "alt") {
      const sub = item[tail[0] as string];
      if (sub && typeof sub === "object" && !Array.isArray(sub)) {
        item[tail[0] as string] = { ...(sub as ImageValue), alt_ar: arabic };
      }
    }
    items[index] = item;
    out[head] = items;
  }

  return out;
}

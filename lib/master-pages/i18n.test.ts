import { describe, expect, it } from "vitest";
import { MASTER_PAGES } from "./pages";
import { AREA_SECTIONS, DEVELOPMENT_SECTIONS } from "./subpages";
import { LIBRARY_SECTIONS } from "./library";
import { BLOCK_DEFS } from "@/lib/page-builder/catalogue";
import { mergeValues, validateFieldValues } from "./index";
import { applyLocale, arabicCoverage } from "./i18n";
import { arabicTwins, isArKey, withArabicTwinsDeep } from "./twins";
import type { FieldDef, SectionDef } from "./types";

/**
 * G-3 — every translatable surface has an Arabic twin, and saving cannot lose
 * one.
 *
 * This generalises `sections.test.ts:114` — which pinned exactly one page, the
 * hand-written contact-qr — to every master page, every subpage kind and every
 * page-builder block, including everything added after this was written.
 *
 * The five assertions map onto the five ways an Arabic string can silently
 * disappear. Every one of them is silent by construction: the editor types
 * Arabic, presses save, sees "Saved.", and the value is gone — and because
 * they cannot read the Arabic page, nobody notices for weeks.
 */

function allSectionDefs(): { origin: string; def: SectionDef }[] {
  const out: { origin: string; def: SectionDef }[] = [];
  for (const page of MASTER_PAGES) {
    for (const section of page.sections) {
      out.push({ origin: `master:${page.key}`, def: section });
    }
  }
  // Two live subpage kinds. `developer` is registered in SUBPAGE_KINDS but has
  // no [slug] editor route, so it has no section list to check.
  for (const section of DEVELOPMENT_SECTIONS) {
    out.push({ origin: "subpage:development", def: section });
  }
  for (const section of AREA_SECTIONS) {
    out.push({ origin: "subpage:area", def: section });
  }
  // The section library — content owned by the site rather than by a page.
  // Same document shape, same twins, so the same five assertions apply.
  for (const entry of LIBRARY_SECTIONS) {
    out.push({ origin: `library:${entry.key}`, def: entry.section });
  }
  return out;
}

function allFieldLists(): { origin: string; fields: FieldDef[] }[] {
  const out = allSectionDefs().map(({ origin, def }) => ({
    origin: `${origin}/${def.key}`,
    fields: def.fields,
  }));
  for (const block of BLOCK_DEFS) {
    out.push({ origin: `block:${block.key}`, fields: block.fields });
  }
  return out;
}

describe("derived Arabic twins", () => {
  it("finds every surface, so the assertions below are not vacuous", () => {
    const lists = allFieldLists();
    expect(lists.length).toBeGreaterThan(40);
    expect(BLOCK_DEFS.length).toBeGreaterThan(10);
  });

  it("gives every translatable field a twin", () => {
    const holes: string[] = [];
    for (const { origin, fields } of allFieldLists()) {
      const derived = new Set([
        ...fields.map((f) => f.key),
        ...arabicTwins(fields).map((f) => f.key),
      ]);
      for (const field of fields) {
        if (field.kind !== "text" && field.kind !== "textarea") continue;
        if (isArKey(field.key)) continue;
        if ((field as { i18n?: false }).i18n === false) continue;
        if (!derived.has(`${field.key}_ar`)) holes.push(`${origin}.${field.key}`);
      }
    }
    expect(holes, `no Arabic twin for:\n${holes.join("\n")}`).toEqual([]);
  });

  it("lets a hand-declared twin win, so contact-qr keeps its own", () => {
    // contact-qr declares 14 `*_ar` fields with bespoke labels and Arabic
    // defaults. Deriving a second one would render the input twice.
    const contactQr = allFieldLists().filter((l) =>
      l.origin.startsWith("master:contact-qr"),
    );
    expect(contactQr.length).toBeGreaterThan(0);

    for (const { fields } of contactQr) {
      const declared = fields.filter((f) => isArKey(f.key)).map((f) => f.key);
      const derived = arabicTwins(fields).map((f) => f.key);
      for (const key of declared) {
        expect(derived, `${key} was derived as well as declared`).not.toContain(
          key,
        );
      }
    }
  });

  it("keeps list sub-field twins through a save", () => {
    // The list branch of validateFieldValues iterates `field.fields`. A
    // shallow twin pass keeps `title_ar` and strips `items[].q_ar` — an FAQ
    // whose questions translate and whose answers vanish.
    const listField = allFieldLists()
      .flatMap((l) => l.fields)
      .find(
        (f): f is Extract<FieldDef, { kind: "list" }> =>
          f.kind === "list" &&
          f.fields.some((s) => s.kind === "text" || s.kind === "textarea"),
      );
    expect(listField, "no list field with text sub-fields to test").toBeTruthy();

    const sub = listField!.fields.find(
      (s) => s.kind === "text" || s.kind === "textarea",
    )!;
    const issues: never[] = [];
    const saved = validateFieldValues(
      [listField!],
      { [listField!.key]: [{ [sub.key]: "English", [`${sub.key}_ar`]: "عربي" }] },
      "test",
      issues,
    );

    const items = saved[listField!.key] as Record<string, unknown>[];
    expect(items[0][`${sub.key}_ar`]).toBe("عربي");
  });

  it("survives a media round-trip, so alt_ar is not write-only", () => {
    // normaliseScalar rebuilds media values key by key with no spread. Any
    // key it does not name is destroyed on save.
    const mediaField = allFieldLists()
      .flatMap((l) => l.fields)
      .find((f) => f.kind === "image");
    expect(mediaField, "no image field to test").toBeTruthy();

    const issues: never[] = [];
    const saved = validateFieldValues(
      [mediaField!],
      {
        [mediaField!.key]: {
          media_id: "abc",
          alt: "A villa",
          alt_ar: "فيلا",
          label: null,
        },
      },
      "test",
      issues,
    );
    const value = saved[mediaField!.key] as Record<string, unknown>;
    expect(value.alt_ar).toBe("فيلا");
    expect(value.media_id).toBe("abc");
  });

  it("keeps twins through mergeValues, so the editor sees stored Arabic", () => {
    const { fields, defaults } = {
      fields: [{ key: "title", label: "Title", kind: "text" }] as FieldDef[],
      defaults: { title: "English default" },
    };
    const merged = mergeValues({ fields, defaults }, {
      title: "English",
      title_ar: "عربي",
    });
    expect(merged.title_ar).toBe("عربي");
  });
});

describe("locale fold", () => {
  const fields: FieldDef[] = [{ key: "title", label: "Title", kind: "text" }];

  it("never emits a storage key to a renderer", () => {
    const { values } = applyLocale({ title: "English", title_ar: "عربي" }, "ar");
    expect(values.title).toBe("عربي");
    expect(Object.keys(values)).not.toContain("title_ar");
  });

  it("falls back to English in place when Arabic is blank", () => {
    const { values, fellBack } = applyLocale(
      { title: "English", title_ar: "" },
      "ar",
    );
    // The whole epic rests on this: an untranslated page renders complete in
    // an RTL layout rather than showing a hole, so publish is never blocked.
    expect(values.title).toBe("English");
    expect(fellBack).toContain("title");
  });

  it("leaves English untouched and reports no fallback", () => {
    const { values, fellBack } = applyLocale(
      { title: "English", title_ar: "عربي" },
      "en",
    );
    expect(values.title).toBe("English");
    expect(fellBack).toEqual([]);
  });

  it("folds alt text without losing the asset", () => {
    const { values } = applyLocale(
      { hero: { media_id: "abc", alt: "A villa", alt_ar: "فيلا", label: null } },
      "ar",
    );
    const hero = values.hero as Record<string, unknown>;
    expect(hero.alt).toBe("فيلا");
    expect(hero.media_id).toBe("abc");
    expect(hero).not.toHaveProperty("alt_ar");
  });

  it("counts coverage against derived twins, not stored keys", () => {
    // A page never opened in the editor should read 0/N, not 0/0 — the
    // difference between "nothing translated" and "nothing to translate".
    expect(arabicCoverage(fields, { title: "English" })).toEqual({
      filled: 0,
      total: 1,
    });
    expect(arabicCoverage(fields, { title: "English", title_ar: "عربي" })).toEqual(
      { filled: 1, total: 1 },
    );
    // Blank English is nothing to translate.
    expect(arabicCoverage(fields, { title: "" })).toEqual({ filled: 0, total: 0 });
  });
});

describe("twin derivation is idempotent", () => {
  it("does not derive a twin of a twin", () => {
    for (const { origin, fields } of allFieldLists()) {
      const twins = withArabicTwinsDeep(fields);
      const doubled = twins.filter((f) => f.key.endsWith("_ar_ar"));
      expect(doubled, `${origin} produced a twin of a twin`).toEqual([]);
    }
  });
});

describe("acceptance: a field added next month inherits Arabic", () => {
  it("derives a twin for a field the registry has never seen", () => {
    // This is the phase's acceptance criterion, kept as a test rather than a
    // one-off check: the value of deriving twins is that nobody has to
    // remember, so the thing worth pinning is what happens to a field written
    // by someone who has never read any of this.
    const brandNew: FieldDef[] = [
      {
        key: "closing_pitch",
        label: "Closing pitch",
        kind: "textarea",
        max: 200,
      },
    ];
    const withTwins = withArabicTwinsDeep(brandNew);

    // Immediately after its English sibling, not in a block at the end — a
    // translator should never have to hold the pairing in their head.
    expect(withTwins.map((f) => f.key)).toEqual([
      "closing_pitch",
      "closing_pitch_ar",
    ]);

    const twin = withTwins[1] as { max?: number; optional?: boolean };
    // Arabic runs longer than English for the same content.
    expect(twin.max).toBe(300);
    // Never required: a blank twin falls back to English at render time, so
    // requiring it would block publishing a page that renders perfectly.
    expect(twin.optional).toBe(true);
  });

  it("reaches into a new list's sub-fields", () => {
    const listy: FieldDef[] = [
      {
        key: "faqs",
        label: "FAQs",
        kind: "list",
        itemLabel: "question",
        max: 8,
        fields: [
          { key: "q", label: "Question", kind: "text" },
          { key: "a", label: "Answer", kind: "textarea" },
        ],
      },
    ];
    const [list] = withArabicTwinsDeep(listy) as [
      Extract<FieldDef, { kind: "list" }>,
    ];
    expect(list.fields.map((f) => f.key)).toEqual(["q", "q_ar", "a", "a_ar"]);
  });
});

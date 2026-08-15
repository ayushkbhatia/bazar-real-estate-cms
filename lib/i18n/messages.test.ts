import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { icuArguments } from "./icu";
import { IDENTICAL_BY_DESIGN } from "./namespaces";
import { isStructural } from "./catalogue-mt";
import { ALL_LOCALES, DEFAULT_LOCALE, type Locale } from "./locales";

/**
 * G-8 — the message catalogues agree, and the Arabic is actually Arabic.
 *
 * Note this walks ALL_LOCALES, not LOCALES: Arabic is written and reviewable
 * before it is served, and the whole point of that split is that the catalogue
 * is held to account during the phase where it is still cheap to fix.
 */
const MESSAGES_DIR = path.join(__dirname, "..", "..", "messages");

function namespaces(locale: Locale): string[] {
  return (
    readdirSync(path.join(MESSAGES_DIR, locale))
      // `_`-prefixed files are sidecars, not namespaces. `messages/ar/_provenance.json`
      // records which values a model produced; it has no English twin by design.
      .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
  );
}

function load(locale: Locale, ns: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(MESSAGES_DIR, locale, `${ns}.json`), "utf8"),
  );
}

/** Flattened `a.b.c` key paths, so nested namespaces compare properly. */
function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? keyPaths(v as Record<string, unknown>, p)
      : [p];
  });
}

function valueAt(obj: Record<string, unknown>, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], obj);
}

/**
 * Strings that are legitimately identical across locales — brand names,
 * language endonyms, and anything typeset in Latin by convention. Anything
 * NOT on this list that matches its English is an untranslated string.
 */

describe("message catalogues", () => {
  it("ships the same namespaces for every locale", () => {
    const base = namespaces(DEFAULT_LOCALE);
    expect(base.length).toBeGreaterThan(0);
    for (const locale of ALL_LOCALES) {
      expect(namespaces(locale), `namespaces differ for ${locale}`).toEqual(
        base,
      );
    }
  });

  it("ships the same keys for every locale", () => {
    for (const ns of namespaces(DEFAULT_LOCALE)) {
      const base = keyPaths(load(DEFAULT_LOCALE, ns)).sort();
      for (const locale of ALL_LOCALES) {
        if (locale === DEFAULT_LOCALE) continue;
        const other = keyPaths(load(locale, ns)).sort();
        const missing = base.filter((k) => !other.includes(k));
        const extra = other.filter((k) => !base.includes(k));
        expect(
          { missing, extra },
          `${locale}/${ns}.json is out of sync with ${DEFAULT_LOCALE}`,
        ).toEqual({ missing: [], extra: [] });
      }
    }
  });

  it("has no Arabic value that is byte-identical to its English", () => {
    // This is the clause that matters. Copying the English across to make the
    // key-parity test above pass is the obvious shortcut, and it produces a
    // catalogue that looks complete while rendering an English site under
    // lang="ar" — a hreflang violation that no build step would notice.
    const untranslated: string[] = [];

    for (const ns of namespaces(DEFAULT_LOCALE)) {
      const en = load(DEFAULT_LOCALE, ns);
      const ar = load("ar", ns);
      for (const key of keyPaths(en)) {
        const id = `${ns}.${key}`;
        if (IDENTICAL_BY_DESIGN.has(id)) continue;
        // A message that is only placeholders and punctuation — "{pct} · {amount}"
        // — has no words to translate, so identical is the correct answer
        // rather than a shortcut. Recognised by shape, not by a list.
        if (isStructural(String(valueAt(en, key)))) continue;
        if (valueAt(en, key) === valueAt(ar, key)) untranslated.push(id);
      }
    }

    expect(
      untranslated,
      `These Arabic values are identical to the English. Either translate them, ` +
        `or add them to IDENTICAL_BY_DESIGN with a reason:\n${untranslated.join("\n")}\n\n` +
        `A message made only of placeholders and punctuation is exempt ` +
        `automatically (see isStructural) — if one is listed here it has a ` +
        `real word in it.`,
    ).toEqual([]);
  });

  /**
   * The standing version of the checks the translator runs per string.
   *
   * `validate` rejects these before anything is written, but only for a string
   * that goes through the pipeline. A hand-edit, a merge, or a pipeline that
   * did not have the check yet leaves them in the file — and one did:
   * `development.units.builtUp` shipped as `املاحة المبنية` in wave 2b, where
   * the Arabic wants `المساحة`. Right length, right digits, no Latin, no
   * sentinel drift. The only instrument that could have caught it was a person
   * who reads Arabic.
   *
   * So the catalogue is checked as a whole, on every run, forever.
   */
  it("carries no mechanically broken Arabic", () => {
    const broken: string[] = [];

    for (const ns of namespaces("ar")) {
      const ar = load("ar", ns);
      const en = load(DEFAULT_LOCALE, ns);
      for (const key of keyPaths(ar)) {
        const value = String(valueAt(ar, key));
        const english = String(valueAt(en, key) ?? "");
        const id = `${ns}.${key}`;

        // Presentation-form glyphs and directional marks, which a stored
        // string must never carry — they render identically and match nothing.
        const shaped = value.match(/[\uFB50-\uFDFF\uFE70-\uFEFE\u200E\u200F]/gu);
        if (shaped) {
          broken.push(
            `${id}: ${shaped.length} presentation-form/directional char(s) — ${value}`,
          );
        }
        // The definite article with its lam and meem swapped.
        if (/(?<![\p{L}\p{M}])\u0627\u0645\u0644/u.test(value)) {
          broken.push(`${id}: transposed article (امل for الم) — ${value}`);
        }
        // The model narrating before it answers.
        if (!english.includes("\n") && value.includes("\n")) {
          broken.push(`${id}: newline the English does not have — ${value}`);
        }
        // Markdown it added on its own.
        if (!/(\*\*|__)(?=\S)[\s\S]+?\1/.test(english) &&
            /(\*\*|__)(?=\S)[\s\S]+?\1/.test(value)) {
          broken.push(`${id}: markdown the English does not have — ${value}`);
        }
      }
    }

    expect(
      broken.sort(),
      `These Arabic values are broken in a way no reviewer of English would ` +
        `see:\n${broken.sort().join("\n")}\n\n` +
        `Fix them by hand — re-running the translator will not, because a ` +
        `value that exists and differs from its English is not on its work ` +
        `list.`,
    ).toEqual([]);
  });

  it("declares every Arabic plural category ICU asks for", () => {
    // Arabic has six: zero, one, two, few, many, other. A catalogue that only
    // declares one/other renders "5 غرفة نوم" where it should read "5 غرف نوم"
    // — grammatically wrong in a way no English-reading reviewer will catch.
    const required = ["zero", "one", "two", "few", "many", "other"];
    const incomplete: string[] = [];

    for (const ns of namespaces("ar")) {
      const ar = load("ar", ns);
      for (const key of keyPaths(ar)) {
        const value = valueAt(ar, key);
        if (typeof value !== "string" || !value.includes("plural,")) continue;
        const declared = [...value.matchAll(/(\w+)\s*\{/g)].map((m) => m[1]);
        const missing = required.filter((c) => !declared.includes(c));
        if (missing.length)
          incomplete.push(`${ns}.${key} — missing ${missing.join(", ")}`);
      }
    }

    expect(
      incomplete,
      `Arabic plural rules are incomplete:\n${incomplete.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps ICU placeholders identical across locales", () => {
    // A dropped `{count}` renders a literal token to a customer.
    const mismatched: string[] = [];
    for (const ns of namespaces(DEFAULT_LOCALE)) {
      const en = load(DEFAULT_LOCALE, ns);
      const ar = load("ar", ns);
      for (const key of keyPaths(en)) {
        const a = valueAt(en, key);
        const b = valueAt(ar, key);
        if (typeof a !== "string" || typeof b !== "string") continue;
        if (icuArguments(a).join(",") !== icuArguments(b).join(","))
          mismatched.push(`${ns}.${key}`);
      }
    }
    expect(
      mismatched,
      `placeholders differ:\n${mismatched.join("\n")}`,
    ).toEqual([]);
  });
});

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

        /*
         * Wildly longer than its English, which on a short label means the
         * model wrote something of its own rather than translating.
         * `guides.goldenVisa.block.whoIts.heading` — English "Who it's for",
         * twelve characters — came back as 54 characters of "Explore the
         * world of AI and machine learning with our experts". Fluent,
         * correctly scripted, entirely unrelated, and invisible to every
         * other check here.
         *
         * Plurals are exempt: English declares two branches and Arabic six,
         * so a correct translation really is three times longer.
         */
        if (!/\{\s*\w+\s*,\s*plural\s*,/.test(english)) {
          const cap =
            english.length < 40
              ? Math.max(30, english.length * 4)
              : english.length * 2.2;
          if (value.length > cap) {
            broken.push(
              `${id}: ${value.length} chars from ${english.length} — ${value}`,
            );
          }
        }
        // U+FFFD is never anything but corruption.
        if (value.includes("\uFFFD")) {
          broken.push(`${id}: replacement character — ${value}`);
        }
        // A Latin letter welded into an Arabic word — `امتb الإمارات`.
        // Legitimate Latin in Arabic output is a token with space around it.
        // Arabic LETTERS, not the Arabic block: `AED 12M، على` is a Latin
        // token followed by an Arabic comma, which is correct punctuation.
        // And a leading Arabic letter only counts when it is not itself
        // preceded by a space or Arabic — `وAED` is the conjunction written
        // attached, which is how Arabic spells it.
        if (/[A-Za-z][\u0621-\u064A\u0671-\u06D3]|(?<!(?:^|\s)[وبلكف])(?<=[\u0621-\u064A\u0671-\u06D3])[A-Za-z]/u.test(value)) {
          broken.push(`${id}: Latin letter fused to an Arabic word — ${value}`);
        }
        // A letter from a script this site does not use — Arabic bytes that
        // went through the wrong codepage and came back as, in the one
        // observed case, Thai.
        const foreign = [
          ...new Set(
            [...value].filter(
              (c) =>
                /\p{L}/u.test(c) &&
                !/[\u0600-\u06FF\u0750-\u077F]/u.test(c) &&
                !/[A-Za-z]/.test(c),
            ),
          ),
        ];
        if (foreign.length > 0) {
          broken.push(`${id}: letters from another script — ${value}`);
        }
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

  /**
   * The same English must give the same Arabic.
   *
   * The strongest check in this file, and the last one added, because it is
   * the only one that can see a *fluent* mistake. Every other rule here asks
   * whether a string is well-formed; this one asks whether it agrees with the
   * sibling that says the same thing — and a hallucination almost never
   * agrees.
   *
   * What it caught on its first run, all of it already merged:
   *
   *   "Abu Dhabi"   -> تأجير محل تجاري في أبوظبي   ("renting a commercial shop")
   *   "Search"      -> شقق للبيع                    ("apartments for sale")
   *   "View"        -> شقة مطلة                     ("an apartment with a view")
   *   "For sale"    -> <br>للبيع
   *   "Unfurnished" -> افغير مفروش                  (two characters welded on)
   *
   * and five different renderings of "Final tip" across five guides.
   *
   * Divergence is not always wrong — one English word can need two Arabic
   * ones. But it is always a decision, so it goes in ALLOWED_DIVERGENCE with
   * the reason rather than passing silently.
   */
  it("gives the same Arabic to the same English", () => {
    /** English strings that legitimately translate two ways, and why. */
    const ALLOWED_DIVERGENCE: ReadonlySet<string> = new Set([]);

    const byEnglish = new Map<string, Map<string, string>>();
    for (const ns of namespaces(DEFAULT_LOCALE)) {
      const en = load(DEFAULT_LOCALE, ns);
      const ar = load("ar", ns);
      for (const key of keyPaths(en)) {
        const english = valueAt(en, key);
        const arabic = valueAt(ar, key);
        if (typeof english !== "string" || typeof arabic !== "string") continue;
        // Below four characters the "same string" is usually a coincidence.
        if (english.length <= 3) continue;
        if (ALLOWED_DIVERGENCE.has(english)) continue;
        if (!byEnglish.has(english)) byEnglish.set(english, new Map());
        byEnglish.get(english)!.set(`${ns}.${key}`, arabic);
      }
    }

    const divergent: string[] = [];
    for (const [english, renderings] of byEnglish) {
      if (new Set(renderings.values()).size <= 1) continue;
      divergent.push(
        `"${english}"\n` +
          [...renderings]
            .map(([id, ar]) => `      ${ar}   (${id})`)
            .join("\n"),
      );
    }

    expect(
      divergent.sort(),
      `These English strings are translated more than one way:\n\n` +
        `${divergent.sort().join("\n\n")}\n\n` +
        `Pick one rendering and use it everywhere, or — if the two really do ` +
        `need different Arabic — add the English to ALLOWED_DIVERGENCE with ` +
        `the reason.`,
    ).toEqual([]);
  });

  it("carries no HTML the English does not", () => {
    // `area.cta.forSale` shipped as "<br>للبيع". The tag renders literally,
    // and `multiline` never saw it because there is no newline involved.
    const withTags: string[] = [];
    for (const ns of namespaces("ar")) {
      const ar = load("ar", ns);
      const en = load(DEFAULT_LOCALE, ns);
      for (const key of keyPaths(ar)) {
        const value = String(valueAt(ar, key));
        const english = String(valueAt(en, key) ?? "");
        const tag = /<\/?[a-z][a-z0-9]*\s*\/?>/i;
        if (tag.test(value) && !tag.test(english)) {
          withTags.push(`${ns}.${key}: ${value}`);
        }
      }
    }
    expect(withTags.sort(), withTags.sort().join("\n")).toEqual([]);
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

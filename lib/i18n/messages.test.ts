import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
  return readdirSync(path.join(MESSAGES_DIR, locale))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
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
/**
 * Top-level ICU argument names, sorted.
 *
 * Brace-depth aware on purpose: a naive `/\{(\w+)[,}]/` also matches the
 * *contents* of plural branches, so `{count, plural, =0 {Studio} …}` reports
 * an argument called "Studio" — and then every translated message looks like a
 * placeholder mismatch, because the Arabic branch text is not `\w`.
 */
function icuArguments(message: string): string {
  const names: string[] = [];
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === "}") depth--;
    else if (ch === "{") {
      if (depth === 0) {
        const rest = message.slice(i + 1);
        const m = rest.match(/^\s*([A-Za-z_]\w*)\s*[,}]/);
        if (m) names.push(m[1]);
      }
      depth++;
    }
  }
  return [...new Set(names)].sort().join(",");
}

const IDENTICAL_BY_DESIGN = new Set([
  "common.languageEnglish",
  "common.languageArabic",
]);

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
        if (valueAt(en, key) === valueAt(ar, key)) untranslated.push(id);
      }
    }

    expect(
      untranslated,
      `These Arabic values are identical to the English. Either translate them, ` +
        `or add them to IDENTICAL_BY_DESIGN with a reason:\n${untranslated.join("\n")}`,
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
        if (icuArguments(a) !== icuArguments(b))
          mismatched.push(`${ns}.${key}`);
      }
    }
    expect(
      mismatched,
      `placeholders differ:\n${mismatched.join("\n")}`,
    ).toEqual([]);
  });
});

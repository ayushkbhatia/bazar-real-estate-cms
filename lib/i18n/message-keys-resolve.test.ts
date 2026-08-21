/**
 * G-19 — every `t("key")` call site resolves to a key that exists.
 *
 * `namespaces.test.ts` proves a namespace is MOUNTED. Nothing proved the keys
 * inside it are REAL, and next-intl's `getMessageFallback` renders the dotted
 * path rather than throwing — `request.ts` only logs in development. So a
 * missing key is invisible in CI, invisible in the build, and renders as
 * literal text on the page.
 *
 * It had. `developments/[slug]/page.tsx:167` mounts `pages.development` and
 * called `tp("bedrooms")` and `tp("handover")`, but those two keys lived under
 * `pages.developments` — the plural sibling, for the index page. Both the
 * detail route and the off-plan route printed the strings
 * "pages.development.bedrooms" and "pages.development.handover" into their
 * hero stats, on 22 routes, in BOTH locales. English was as broken as Arabic,
 * which is why no amount of Arabic coverage measurement surfaced it.
 *
 * The check is deliberately narrow: it resolves the namespace a translator
 * variable was bound to in the same file, then verifies each literal key it is
 * called with. Dynamic keys (`t(someVariable)`) are skipped — they cannot be
 * checked statically and pretending otherwise would mean false failures.
 *
 * ## The half-dynamic shape
 *
 * `` t(`map.pinHint.${kind}`) `` is neither. The leaf is a union the type
 * checker owns; the PATH TO IT is as static as any literal, and it was the
 * hole a whole surface fell through — the area map keys four families this
 * way (`map.pinHint`, `map.count`, `map.zoomTo`, `map.dotCta`), and renaming
 * any of them would have printed "common.map.pinHint.listing" onto every page
 * that draws a map, in both locales, with nothing failing.
 *
 * So the second assertion below checks the PREFIX: the catalogue must hold at
 * least one key under it. That cannot verify the leaf — nothing static can —
 * but it turns "the family was renamed or deleted" from silent into red,
 * which is the failure that actually happens.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function flatten(
  value: unknown,
  out: Set<string>,
  prefix = "",
): Set<string> {
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") out.add(path);
    else if (entry && typeof entry === "object") flatten(entry, out, path);
  }
  return out;
}

/** Every fully-qualified key in the English catalogue, e.g. `pages.home.title`. */
function englishKeys(): Set<string> {
  const out = new Set<string>();
  const files = execFileSync("git", ["ls-files", "messages/en"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const namespace = file.split("/").pop()!.replace(/\.json$/, "");
    flatten(JSON.parse(readFileSync(join(ROOT, file), "utf8")), out, namespace);
  }
  return out;
}

/**
 * `const t = useTranslations("nav")` / `const tp = await getTranslations({...})`
 * → which namespace each variable is bound to, per file.
 */
const BINDING =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:\{[^}]*namespace:\s*)?["']([\w.]+)["']/g;

function sourceFiles(): string[] {
  return execFileSync("git", ["ls-files", "app", "components", "lib"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !/\.(test|spec)\.tsx?$/.test(f));
}

describe("G-19 · every message key a call site asks for exists", () => {
  const known = englishKeys();

  it("finds no call site naming a key the catalogue does not have", () => {
    const missing: string[] = [];

    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      if (!/use(?:Translations)|getTranslations/.test(source)) continue;

      BINDING.lastIndex = 0;
      for (const bind of source.matchAll(BINDING)) {
        const [, variable, namespace] = bind;
        // Only literal keys. `t(dynamic)` cannot be resolved statically.
        const calls = new RegExp(`\\b${variable}\\(\\s*["']([\\w.]+)["']`, "g");
        for (const call of source.matchAll(calls)) {
          const key = `${namespace}.${call[1]}`;
          if (!known.has(key)) missing.push(`${file}\n    ${variable}("${call[1]}") → ${key}`);
        }
      }
    }

    expect(
      missing,
      `These call sites name a message key that does not exist. next-intl ` +
        `renders the dotted path as visible text and throws nothing, so this ` +
        `ships silently in BOTH locales:\n\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("finds no half-dynamic key whose family the catalogue has lost", () => {
    const orphaned: string[] = [];
    const families = new Set<string>();

    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      if (!/use(?:Translations)|getTranslations/.test(source)) continue;

      BINDING.lastIndex = 0;
      for (const bind of source.matchAll(BINDING)) {
        const [, variable, namespace] = bind;
        // `` t(`map.pinHint.${kind}`) `` — everything up to the first `${`.
        const calls = new RegExp(
          "\\b" + variable + "\\(\\s*`([\\w.]+)\\.\\$\\{",
          "g",
        );
        for (const call of source.matchAll(calls)) {
          const prefix = `${namespace}.${call[1]}`;
          families.add(prefix);
          const has = [...known].some((key) => key.startsWith(`${prefix}.`));
          if (!has) orphaned.push(`${file}\n    ${variable}(\`${call[1]}.\${…}\`) → ${prefix}.*`);
        }
      }
    }

    expect(
      orphaned,
      `These call sites build a key from a static prefix and a dynamic leaf, ` +
        `and the catalogue holds nothing under that prefix at all — so every ` +
        `leaf renders as its own dotted path, in both locales:\n\n` +
        orphaned.join("\n"),
    ).toEqual([]);

    // Vacuity guard, same reasoning as the count check below.
    expect(families.size).toBeGreaterThan(0);
  });

  it("scans a believable number of keys and files", () => {
    // A regex that matched nothing would make the assertion above vacuous —
    // the failure mode that let G-14 pass for a whole wave while scanning zero
    // files.
    expect(known.size).toBeGreaterThan(900);
    expect(sourceFiles().length).toBeGreaterThan(450);
  });
});

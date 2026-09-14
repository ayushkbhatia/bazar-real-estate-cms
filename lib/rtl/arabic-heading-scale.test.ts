/**
 * @vitest-environment node
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fluid } from "@/app/[locale]/(public)/_components/marketing/fluid";

/**
 * Arabic h1/h2 are set 2px under their English size (globals.css, "Arabic page
 * and section headings"). Heading sizes are literal `text-[Npx]` utilities, so
 * the stylesheet lists one override per size — and a heading given a size the
 * list lacks would silently keep its English size on /ar.
 *
 * This walks every public .tsx for display-scale size utilities (20px and up,
 * the smallest a heading uses) and asserts each has its Arabic override. It
 * reads every size, not only those on an h1/h2, because a className built with
 * `cn()` across lines defeats any cheap attempt to tell which element owns it;
 * an override for a size no heading uses costs one unused rule.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CSS = readFileSync(join(REPO_ROOT, "app/globals.css"), "utf8");

function publicTsx(): string[] {
  return execSync("git ls-files 'app/*.tsx' 'components/*.tsx'", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((f) => !/\(admin\)|\/admin\/|\.test\.|global-error/.test(f));
}

function mdBlock(css: string): string {
  const start = css.indexOf("@media (min-width: 48rem) {\n  :lang(ar) :is(h1, h2)");
  expect(start, "the md block of Arabic heading overrides").toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}\n", start));
}

describe("Arabic heading scale", () => {
  it("every display-scale text-[Npx] used publicly has a 2px-smaller Arabic override", () => {
    const md = mdBlock(CSS);
    const missing = new Set<string>();
    for (const file of publicTsx()) {
      const src = readFileSync(join(REPO_ROOT, file), "utf8");
      for (const m of src.matchAll(/(?<![\w:-])(md:)?text-\[(\d+)px\]/g)) {
        const n = Number(m[2]);
        if (n < 20) continue;
        const prefix = m[1] ? "md\\:" : "";
        const rule = `:lang(ar) :is(h1, h2).${prefix}text-\\[${n}px\\] {\n${m[1] ? "    " : "  "}font-size: ${n - 2}px;`;
        if (!(m[1] ? md : CSS).includes(rule)) missing.add(`${m[0]} (${file})`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("fluid() subtracts the trim, which is 0px outside an Arabic heading", () => {
    expect(fluid(40)).toBe("calc(clamp(20px, 2.78vw, 40px) - var(--bz-ar-heading-trim, 0px))");
    expect(CSS).toMatch(/:lang\(ar\) :is\(h1, h2\) \{\n {2}--bz-ar-heading-trim: 2px;/);
  });

  it("drops a serif heading one weight step below the pinned display weight", () => {
    expect(CSS).toContain(
      ":lang(ar) :is(h1, h2).serif {\n  font-weight: max(100, calc(var(--bz-font-ar-display-weight, 500) - 100));",
    );
  });
});

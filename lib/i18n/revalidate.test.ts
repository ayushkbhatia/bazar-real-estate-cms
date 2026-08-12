import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * G-2 — every public revalidation goes through `revalidateLocalised`.
 *
 * Once the `[locale]` segment lands, Next prerenders the English `/buy` to
 * `/en/buy`. A bare `revalidatePath("/buy")` then names a cache key that does
 * not exist. It does not throw and it does not warn — it silently no-ops, so
 * the CMS shows "Saved." and the public page keeps serving the old content.
 *
 * There are ~193 `revalidatePath` calls here and zero `revalidateTag`, so this
 * is the whole cache-invalidation surface of the product. One missed call site
 * is one page in the CMS that quietly stops publishing, and it presents as a
 * caching bug rather than as a regression anyone can bisect.
 *
 * `/admin/*` is exempt: the CMS is pinned to English and never gains a segment.
 */
const REPO_ROOT = path.join(__dirname, "..", "..");

/**
 * Root-level metadata routes live outside `[locale]` and take no prefix, so
 * they legitimately call `revalidatePath` directly. Listing them here rather
 * than pattern-matching keeps "deliberately raw" distinguishable from "forgot".
 */
const ROOT_METADATA_PATHS = ["/sitemap.xml", "/robots.txt", "/opengraph-image"];

/** The helper's own module is where the raw call is supposed to live. */
const HELPER = "lib/i18n/revalidate.ts";

type Call = { file: string; line: number; text: string };

function rawRevalidateCalls(): Call[] {
  // -F is deliberate: we want the literal call, not a regex over prose.
  const out = execFileSync(
    "grep",
    [
      "-rnF",
      "revalidatePath(",
      "app",
      "lib",
      "--include=*.ts",
      "--include=*.tsx",
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );

  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((row) => {
      const [file, line, ...rest] = row.split(":");
      return { file, line: Number(line), text: rest.join(":").trim() };
    })
    .filter((c) => c.file !== HELPER)
    // Specs describe call sites, they are not call sites — including this one.
    .filter((c) => !/\.test\.tsx?$/.test(c.file))
    // Comments and imports mention the name without calling it.
    .filter((c) => !c.text.startsWith("*") && !c.text.startsWith("//"))
    .filter((c) => !c.text.startsWith("import"));
}

function isExempt(text: string): boolean {
  const arg = text.slice(text.indexOf("revalidatePath(") + "revalidatePath(".length);
  const literal = arg.match(/^["'`]([^"'`]*)["'`]/);
  if (literal) {
    const p = literal[1];
    return p.startsWith("/admin") || ROOT_METADATA_PATHS.includes(p);
  }
  return /^`\/admin/.test(arg.trim());
}

describe("public revalidation is locale-aware", () => {
  it("routes every public revalidatePath through revalidateLocalised", () => {
    const offenders = rawRevalidateCalls()
      .filter((c) => !isExempt(c.text))
      .map((c) => `${c.file}:${c.line}  ${c.text}`);

    expect(
      offenders,
      `These call revalidatePath() on a public path directly. Under the [locale] ` +
        `segment they name a cache key that does not exist, so publishing silently ` +
        `stops working. Use revalidateLocalised() from @/lib/i18n/revalidate:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("keeps the helper as the only place that revalidates per locale", () => {
    const helper = readFileSync(path.join(REPO_ROOT, HELPER), "utf8");
    expect(helper).toContain("for (const locale of LOCALES)");
    // A helper that forgot the loop would pass the grep above while still
    // revalidating exactly one locale — the failure this file exists to stop.
    expect(helper).toContain("revalidatePath(revalidateKey(path, locale), type)");
  });

  it("still has admin call sites, so the exemption is load-bearing", () => {
    // If this ever hits zero the exemption has become dead code and should go —
    // and if it silently swallowed everything, the first test would be vacuous.
    const adminCalls = rawRevalidateCalls().filter((c) => isExempt(c.text));
    expect(adminCalls.length).toBeGreaterThan(50);
  });
});

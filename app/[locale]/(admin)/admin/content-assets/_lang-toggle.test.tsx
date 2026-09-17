import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LangToggle, LANG_PARAM, langFrom, withLang } from "./_lang-toggle";

describe("withLang", () => {
  it("leaves English alone and appends Arabic", () => {
    expect(withLang("/admin/content-assets", "en")).toBe("/admin/content-assets");
    expect(withLang("/admin/content-assets", "ar")).toBe(
      `/admin/content-assets?${LANG_PARAM}=ar`,
    );
  });

  it("merges into a URL that already has a query", () => {
    expect(withLang("/admin/content-assets?view=outreach", "ar")).toBe(
      `/admin/content-assets?view=outreach&${LANG_PARAM}=ar`,
    );
  });

  it("round-trips through langFrom", () => {
    expect(langFrom({ [LANG_PARAM]: "ar" })).toBe("ar");
    expect(langFrom({ [LANG_PARAM]: ["ar"] })).toBe("ar");
    expect(langFrom({})).toBe("en");
    expect(langFrom({ [LANG_PARAM]: "fr" })).toBe("en");
  });
});

describe("LangToggle", () => {
  /**
   * The rendered `href`, not the helper that builds it — this is the attribute
   * the marketing manager's click actually follows, and the bug was that it
   * pointed at a URL the proxy threw away.
   */
  it("points each button at the same screen in the other language", () => {
    render(
      <LangToggle
        lang="en"
        hrefFor={(l) => withLang("/admin/content-assets", l)}
      />,
    );
    expect(screen.getByRole("link", { name: "العربية" })).toHaveAttribute(
      "href",
      `/admin/content-assets?${LANG_PARAM}=ar`,
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/admin/content-assets",
    );
  });

  it("marks the language you are on", () => {
    render(
      <LangToggle
        lang="ar"
        hrefFor={(l) => withLang("/admin/content-assets", l)}
      />,
    );
    expect(screen.getByRole("link", { name: "العربية" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "English" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

/**
 * The toggle only works if every link goes through `withLang`.
 *
 * A hand-written `?lang=ar` looks identical in review and is deleted in flight
 * by the proxy's WordPress clean-up — see `proxy.lang-param.test.ts`. This
 * walks the screens rather than trusting that nobody types it again.
 */
describe("no screen hand-writes the poisoned parameter", () => {
  const ROOT = import.meta.dirname;

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it("uses no `lang=` query parameter anywhere under content assets", () => {
    const offenders = walk(ROOT)
      // This module and its test name the poisoned parameter on purpose, in
      // the prose that explains why nothing else may.
      .filter((file) => !/_lang-toggle\./.test(file))
      .filter((file) => /[?&]lang=/.test(readFileSync(file, "utf8")));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });
});

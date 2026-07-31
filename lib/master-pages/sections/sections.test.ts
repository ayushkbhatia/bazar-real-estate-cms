import { describe, expect, it } from "vitest";
import { MASTER_PAGES, getMasterPage, resolveSections, str } from "../index";
import type { MasterPageDef } from "../types";

/**
 * The Sprint 14 pages: five conversions plus the two QR routes. The generic
 * registry invariants (unique section keys, every field has a default) are
 * asserted for all master pages in ../master-pages.test.ts; this file covers
 * what is specific to these seven.
 */
const NEW_PAGES: [string, string][] = [
  ["developers", "/developers"],
  ["services", "/services"],
  ["insights", "/insights"],
  ["about", "/about"],
  ["contact", "/contact"],
  ["qr", "/qr"],
  ["contact-qr", "/contact-us/qr"],
];

describe("Sprint 14 master pages", () => {
  it.each(NEW_PAGES)("registers %s at %s", (key, path) => {
    const def = getMasterPage(key);
    expect(def, `${key} is not in MASTER_PAGES`).not.toBeNull();
    expect(def?.path).toBe(path);
    expect(def?.sections.length).toBeGreaterThan(0);
  });

  it("gives every page at least one locked section, so it can't be emptied", () => {
    for (const [key] of NEW_PAGES) {
      const def = getMasterPage(key) as MasterPageDef;
      const locked = def.sections.filter((s) => s.locked);
      expect(locked.length, `${key} has no locked section`).toBeGreaterThan(0);
    }
  });

  it("renders defaults when nothing is stored", () => {
    for (const [key] of NEW_PAGES) {
      const def = getMasterPage(key) as MasterPageDef;
      const resolved = resolveSections(def, null);
      // Same count, same order, all enabled — the un-edited page.
      expect(resolved.map((s) => s.key)).toEqual(def.sections.map((s) => s.key));
      expect(resolved.every((s) => s.enabled)).toBe(true);
    }
  });
});

describe("QR page", () => {
  const qr = getMasterPage("qr") as MasterPageDef;

  it("defaults its destination to the printed URL", () => {
    // The QR on a printed card cannot be re-pointed, so this default is a
    // contract: changing it invalidates every code already in circulation.
    const section = qr.sections.find((s) => s.key === "qr_code");
    expect(section).toBeDefined();
    const resolved = resolveSections(qr, null).find((s) => s.key === "qr_code");
    expect(str(resolved!.values, "url")).toBe(
      "https://www.bazarrealestate.ae/contact-us/qr",
    );
  });

  it("locks the QR section — the page is nothing without it", () => {
    expect(qr.sections.find((s) => s.key === "qr_code")?.locked).toBe(true);
  });

  it("points at a route the site actually serves", () => {
    const target = getMasterPage("contact-qr");
    expect(target?.path).toBe("/contact-us/qr");
  });
});

describe("registry integrity after the sections split", () => {
  it("has no duplicate keys or paths across every master page", () => {
    const keys = MASTER_PAGES.map((p) => p.key);
    const paths = MASTER_PAGES.map((p) => p.path);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

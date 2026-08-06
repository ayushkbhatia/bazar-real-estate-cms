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
  ["contact-qr", "/contact-qr"],
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
      // Same count, same order — the un-edited page. Every section is on
      // unless its definition says otherwise, and a section that ships off
      // still appears in the editor with its copy intact.
      expect(resolved.map((s) => s.key)).toEqual(def.sections.map((s) => s.key));
      expect(resolved.map((s) => s.enabled)).toEqual(
        def.sections.map((s) => s.defaultEnabled ?? true),
      );
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
      "https://www.bazarrealestate.ae/contact-qr",
    );
  });

  it("locks the QR section — the page is nothing without it", () => {
    expect(qr.sections.find((s) => s.key === "qr_code")?.locked).toBe(true);
  });

  it("points at a route the site actually serves", () => {
    const target = getMasterPage("contact-qr");
    expect(target?.path).toBe("/contact-qr");
  });
});

describe("contact card (/contact-qr)", () => {
  const card = getMasterPage("contact-qr") as MasterPageDef;
  const resolved = resolveSections(card, null);
  const on = (key: string) => resolved.find((s) => s.key === key)!;

  it("ships the card, its details and the follow row, and nothing else", () => {
    expect(resolved.filter((s) => s.enabled).map((s) => s.key)).toEqual([
      "card",
      "details",
      "follow",
    ]);
  });

  it("keeps the enquiry form and explore links available but off", () => {
    expect(on("enquiry_form").enabled).toBe(false);
    expect(on("explore").enabled).toBe(false);
    // Off, not gone: the copy is still there for whoever turns them back on.
    expect(str(on("enquiry_form").values, "heading")).toBe(
      "Tell us what you're after.",
    );
  });

  it("lets an editor switch a default-off section back on", () => {
    const stored = resolveSections(card, [
      { key: "explore", enabled: true, values: {} },
    ]);
    expect(stored.find((s) => s.key === "explore")!.enabled).toBe(true);
  });

  it("cannot lose the card or its details — both are locked", () => {
    const stored = resolveSections(card, [
      { key: "card", enabled: false, values: {} },
      { key: "details", enabled: false, values: {} },
    ]);
    expect(stored.find((s) => s.key === "card")!.enabled).toBe(true);
    expect(stored.find((s) => s.key === "details")!.enabled).toBe(true);
  });

  it("gives every label an Arabic twin, so the toggle never shows a hole", () => {
    for (const section of card.sections) {
      const arKeys = section.fields
        .map((f) => f.key)
        .filter((k) => k.endsWith("_ar"));
      for (const key of arKeys) {
        expect(
          str(section.defaults, key),
          `${section.key}.${key} has no Arabic default`,
        ).toBeTruthy();
      }
    }
  });

  it("hides WhatsApp until someone configures a number for it", () => {
    // The mobile number already reaches WhatsApp; a second row for the same
    // number is noise, so this one is opt-in.
    expect(str(on("details").values, "whatsapp_number")).toBeNull();
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

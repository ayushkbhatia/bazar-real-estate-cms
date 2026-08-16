/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { MASTER_PAGES } from "@/lib/master-pages/pages";
import { AREA_SECTIONS, DEVELOPMENT_SECTIONS } from "@/lib/master-pages/subpages";
import { BLOCK_DEFS } from "@/lib/page-builder/catalogue";
import { mergeValues } from "@/lib/master-pages/index";
import { applyLocale } from "@/lib/master-pages/i18n";
import type { FieldDef, SectionValues } from "@/lib/master-pages/types";
import { walkSection, walkDefaults, applySlots, kindForField } from "./bag";

const page = (key: string) => MASTER_PAGES.find((p) => p.key === key)!;
const section = (pageKey: string, sectionKey: string) =>
  page(pageKey).sections.find((s) => s.key === sectionKey)!;

describe("kindForField", () => {
  it("sends page copy to the page register, whatever its length", () => {
    // Not `title`/`summary`/`body`. Those registers are framed as LISTING
    // content, and on page copy that framing changes what the model produces
    // rather than how it sounds: run under `title` ("a listing headline"), the
    // heading "Reviews and comments" came back as a fully furnished studio
    // with a canal view, and it passed all nineteen structural checks.
    expect(kindForField({ key: "heading", label: "Heading", kind: "text", max: 120 })).toBe("page");
    expect(kindForField({ key: "body", label: "Body", kind: "textarea", max: 600 })).toBe("page");
    expect(kindForField({ key: "sub", label: "Intro", kind: "textarea", max: 240 })).toBe("page");
  });

  it("keeps the interface register for the genuinely control-shaped strings", () => {
    // Where the failure `ui` was written for — an ambiguous single word
    // resolving toward property vocabulary — is still the real risk.
    expect(kindForField({ key: "cta_label", label: "Button", kind: "text", max: 60 })).toBe("ui");
    expect(kindForField({ key: "label", label: "Label", kind: "text", max: 24 })).toBe("ui");
  });
});

describe("walkSection", () => {
  it("addresses a list item by index, because the twin lives inside the item", () => {
    const def = section("contact", "help");
    const slots = walkSection({
      fields: def.fields,
      values: def.defaults,
      docKey: "master:contact",
      sectionKey: "help",
    });
    const labels = slots.filter((s) => s.pathKey.endsWith(".label"));
    expect(labels.length).toBeGreaterThan(1);
    expect(labels[0]!.pathKey).toMatch(/^items\[\d+\]\.label$/);
    expect(labels[0]!.arKey).toBe("label_ar");
  });

  it("skips a field opted out with i18n: false", () => {
    // P-1 marked `icon` non-prose. If the walker ignored the opt-out it would
    // generate Arabic for a lucide icon name and the icon would disappear.
    const def = section("contact", "help");
    const slots = walkSection({
      fields: def.fields,
      values: def.defaults,
      docKey: "master:contact",
      sectionKey: "help",
    });
    expect(slots.some((s) => s.pathKey.includes(".icon"))).toBe(false);
  });

  it("honours a hand-declared twin's own cap over the derived one", () => {
    // contact-qr declares `tagline_ar` with max 160 by hand. The derived cap
    // would be 1.5x the English max. Calling arMax() directly — instead of
    // indexing withArabicTwinsDeep — silently uses the wrong number for
    // exactly the fourteen fields someone bothered to hand-write.
    const def = section("contact-qr", "card");
    const slots = walkSection({
      fields: def.fields,
      values: def.defaults,
      docKey: "master:contact-qr",
      sectionKey: "card",
    });
    const tagline = slots.find((s) => s.pathKey === "tagline");
    expect(tagline).toBeDefined();
    expect(tagline!.arKey).toBe("tagline_ar");
    expect(tagline!.maxLength).toBe(160);
  });

  it("marks a data-shaped value identity, so it is copied and never translated", () => {
    const def = section("off-plan", "hero");
    const slots = walkSection({
      fields: def.fields,
      values: def.defaults,
      docKey: "master:off-plan",
      sectionKey: "hero",
    });
    const stats = slots.filter((s) => s.pathKey.match(/^stats\[\d+\]\.value$/));
    expect(stats.length).toBeGreaterThan(0);
    // "78%", "8", "40/60" — all identity.
    expect(stats.every((s) => s.why === "identity")).toBe(true);
  });

  it("still treats a prose stat value as prose", () => {
    // The same field on /rent holds "Residential" and "Homes + offices". This
    // is why statList() could not be opted out wholesale.
    const def = section("rent", "why");
    const slots = walkSection({
      fields: def.fields,
      values: def.defaults,
      docKey: "master:rent",
      sectionKey: "why",
    });
    const stats = slots.filter((s) => s.pathKey.match(/^stats\[\d+\]\.value$/));
    expect(stats.some((s) => s.why === "missing")).toBe(true);
  });

  it("reads existing Arabic rather than reporting it missing", () => {
    const def = section("contact-qr", "card");
    const slots = walkSection({
      fields: def.fields,
      values: def.defaults,
      docKey: "master:contact-qr",
      sectionKey: "card",
    });
    const tagline = slots.find((s) => s.pathKey === "tagline")!;
    // contact-qr ships the client's own Arabic as a defaults literal.
    expect(tagline.arabic).toBeTruthy();
  });

  it("reaches media alt text, including inside a list item", () => {
    const fields: FieldDef[] = [
      { key: "image", label: "Image", kind: "image" },
      {
        key: "cards",
        label: "Cards",
        kind: "list",
        itemLabel: "card",
        max: 4,
        fields: [
          { key: "title", label: "Title", kind: "text", max: 80 },
          { key: "shot", label: "Shot", kind: "image" },
        ],
      },
    ];
    const values: SectionValues = {
      image: { media_id: "a", alt: "A villa at dusk", label: null },
      cards: [{ title: "One", shot: { media_id: "b", alt: "A pool", label: null } }],
    };
    const slots = walkSection({ fields, values, docKey: "d", sectionKey: "s" });
    const alts = slots.filter((s) => s.arKey === "alt_ar");
    expect(alts.map((s) => s.pathKey).sort()).toEqual(["cards[0].shot.alt", "image.alt"]);
    expect(alts.every((s) => s.kind === "alt")).toBe(true);
  });
});

describe("applySlots", () => {
  it("adds Arabic without touching a single English value", () => {
    const def = section("home", "who_we_are");
    const values = mergeValues(def, null);
    const slots = walkSection({
      fields: def.fields,
      values,
      docKey: "master:home",
      sectionKey: "who_we_are",
    });
    const results = new Map(slots.map((s) => [s.pathKey, `AR(${s.english})`]));
    const after = applySlots(values, slots, results);

    for (const [key, before] of Object.entries(values)) {
      if (key.endsWith("_ar")) continue;
      if (Array.isArray(before)) {
        const now = after[key] as Record<string, unknown>[];
        before.forEach((item, i) => {
          for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            if (k.endsWith("_ar")) continue;
            expect(now[i]![k]).toEqual(v);
          }
        });
        continue;
      }
      expect(after[key]).toEqual(before);
    }
  });

  it("round-trips: what it writes, the next walk reads back", () => {
    const def = section("home", "who_we_are");
    const values = mergeValues(def, null);
    const slots = walkSection({
      fields: def.fields,
      values,
      docKey: "master:home",
      sectionKey: "who_we_are",
    });
    const results = new Map(slots.map((s) => [s.pathKey, `AR(${s.english})`]));
    const after = applySlots(values, slots, results);

    const again = walkSection({
      fields: def.fields,
      values: after,
      docKey: "master:home",
      sectionKey: "who_we_are",
    });
    expect(again.every((s) => s.arabic === `AR(${s.english})`)).toBe(true);
  });

  it("writes where applyLocale reads — the fold sees it", () => {
    // The assertion that makes this useful. A walker that wrote to a key the
    // renderer never reads would pass every test above and change nothing on
    // the page.
    const def = section("home", "who_we_are");
    const values = mergeValues(def, null);
    const slots = walkSection({
      fields: def.fields,
      values,
      docKey: "master:home",
      sectionKey: "who_we_are",
    });
    const results = new Map(slots.map((s) => [s.pathKey, `AR(${s.english})`]));
    const folded = applyLocale(applySlots(values, slots, results), "ar", "who_we_are.").values;

    const scalar = slots.find((s) => s.path.length === 1)!;
    expect(folded[scalar.path[0] as string]).toBe(`AR(${scalar.english})`);
  });
});

describe("the whole registry", () => {
  it("enumerates every document kind without throwing", () => {
    const master = MASTER_PAGES.flatMap((p) => walkDefaults(`master:${p.key}`, p.sections));
    const area = walkDefaults("area:_registry", AREA_SECTIONS);
    const dev = walkDefaults("development:_registry", DEVELOPMENT_SECTIONS);
    const blocks = BLOCK_DEFS.flatMap((b) =>
      walkSection({ fields: b.fields, values: b.defaults, docKey: `block:${b.key}`, sectionKey: b.key }),
    );

    const all = [...master, ...area, ...dev, ...blocks];
    expect(all.length).toBeGreaterThan(400);
    // Every slot is addressable and writable.
    expect(all.every((s) => s.pathKey.length > 0)).toBe(true);
    expect(all.every((s) => s.arKey.endsWith("_ar"))).toBe(true);
    // No slot points at a twin — that would be title_ar_ar.
    expect(all.some((s) => s.pathKey.includes("_ar"))).toBe(false);
  });

  it("gives every slot a register, and none of them a listing register", () => {
    const all = MASTER_PAGES.flatMap((p) => walkDefaults(`master:${p.key}`, p.sections));
    const kinds = new Set(all.map((s) => s.kind));
    // `title`, `summary` and `body` are for property listings. A master page
    // reaching one of them is the bug that produced invented copy on /home.
    expect([...kinds].sort()).toEqual(["page", "ui"]);
  });
});

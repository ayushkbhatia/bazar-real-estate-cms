/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import { expectFolds, expectNoTwinsLeak } from "@/lib/i18n/fold-harness";
import { composeFooter, contactLines, type FooterRaw } from "./footer";

/**
 * Proof that the seven translatable footer columns actually fold.
 *
 * `composeFooter` is the choke point — the public reader and nothing else
 * shapes this tree — and it is a pure exported function taking the RAW rows,
 * so it can be driven directly without a Supabase stub.
 *
 * That it takes raw rows is the whole point rather than a testing
 * convenience. Fold *after* shaping and every assertion below still compiles,
 * still reads correctly, and quietly returns English on /ar, because the
 * shaper builds explicit literals (`label: l.label`) and the twins are gone by
 * then. `lib/queries/megamenu.ts` documents that exact mistake in prod.
 */

const RAW: FooterRaw = {
  settings: {
    blurb: "A leading UAE agency.",
    blurb_ar: "وكالة رائدة في الإمارات.",
    contact_heading: "Contact",
    contact_heading_ar: "اتصل بنا",
    legal_line: "© 2026 Bazar Real Estate L.L.C.",
    legal_line_ar: "© 2026 بازار للعقارات ذ.م.م.",
  },
  columns: [
    {
      id: "col-1",
      kind: "links",
      position: 0,
      heading: "Company",
      heading_ar: "الشركة",
      is_visible: true,
    },
    {
      id: "col-legal",
      kind: "legal",
      position: 0,
      heading: null,
      heading_ar: null,
      is_visible: true,
    },
  ],
  links: [
    {
      id: "l-1",
      column_id: "col-1",
      position: 1,
      label: "Careers",
      label_ar: "الوظائف",
      href: "/careers",
    },
    {
      id: "l-0",
      column_id: "col-1",
      position: 0,
      label: "About",
      label_ar: "من نحن",
      href: "/about",
    },
    {
      id: "l-legal",
      column_id: "col-legal",
      position: 0,
      label: "Privacy Policy",
      label_ar: "سياسة الخصوصية",
      href: "/legal/privacy",
    },
  ],
  socials: [
    {
      id: "s-1",
      position: 0,
      label: "Instagram",
      href: "https://instagram.com/x",
      is_visible: true,
    },
  ],
  contact: [
    {
      id: "c-1",
      position: 0,
      kind: "address",
      label: "Office location",
      label_ar: "موقع المكتب",
      body: "Al Bateen\nAbu Dhabi",
      body_ar: "البطين\nأبوظبي",
      is_visible: true,
    },
    {
      id: "c-2",
      position: 1,
      kind: "phone",
      label: "Phone / WhatsApp",
      label_ar: "الهاتف / واتساب",
      body: "+971 2 632 2223",
      body_ar: null,
      is_visible: true,
    },
  ],
};

const read = (locale: Locale) => composeFooter(RAW, locale);

describe("the footer folds every translatable column", () => {
  it("folds the brand blurb", async () => {
    await expectFolds({
      read,
      pick: (f) => f.settings.blurb,
      english: "A leading UAE agency.",
      arabic: "وكالة رائدة في الإمارات.",
      what: "footer_settings.blurb",
    });
  });

  it("folds the contact heading", async () => {
    await expectFolds({
      read,
      pick: (f) => f.settings.contact_heading,
      english: "Contact",
      arabic: "اتصل بنا",
      what: "footer_settings.contact_heading",
    });
  });

  it("folds the legal line", async () => {
    await expectFolds({
      read,
      pick: (f) => f.settings.legal_line,
      english: "© 2026 Bazar Real Estate L.L.C.",
      arabic: "© 2026 بازار للعقارات ذ.م.م.",
      what: "footer_settings.legal_line",
    });
  });

  it("folds a column heading", async () => {
    await expectFolds({
      read,
      pick: (f) => f.columns[0]?.heading,
      english: "Company",
      arabic: "الشركة",
      what: "footer_columns.heading",
    });
  });

  it("folds a link label", async () => {
    await expectFolds({
      read,
      pick: (f) => f.columns[0]?.links[0]?.label,
      english: "About",
      arabic: "من نحن",
      what: "footer_links.label",
    });
  });

  it("folds a link label in the bottom bar too", async () => {
    // The legal links take a different path through the shaper — flattened
    // across columns rather than nested under one — so folding the nested case
    // does not prove this one.
    await expectFolds({
      read,
      pick: (f) => f.legal[0]?.label,
      english: "Privacy Policy",
      arabic: "سياسة الخصوصية",
      what: "footer_links.label (bottom bar)",
    });
  });

  it("folds a contact label", async () => {
    await expectFolds({
      read,
      pick: (f) => f.contact[0]?.label,
      english: "Office location",
      arabic: "موقع المكتب",
      what: "footer_contact_items.label",
    });
  });

  it("folds a contact body", async () => {
    await expectFolds({
      read,
      pick: (f) => f.contact[0]?.body,
      english: "Al Bateen\nAbu Dhabi",
      arabic: "البطين\nأبوظبي",
      what: "footer_contact_items.body",
    });
  });
});

describe("what must not fold", () => {
  it("leaves a phone number in English when its twin is blank", () => {
    // The designed fallback, and the one that matters most here: an
    // Arabic-Indic phone number would not dial.
    const ar = composeFooter(RAW, "ar" as Locale);
    expect(ar.contact[1]?.body).toBe("+971 2 632 2223");
  });

  it("never folds a social network name", () => {
    const ar = composeFooter(RAW, "ar" as Locale);
    expect(ar.socials[0]?.label).toBe("Instagram");
  });

  it("never folds an href — that is the URL, not a label", () => {
    const ar = composeFooter(RAW, "ar" as Locale);
    expect(ar.columns[0]?.links[0]?.href).toBe("/about");
    expectNoTwinsLeak(ar, "footer content");
  });

  it("orders links by position, not by the order the rows arrived", () => {
    const en = composeFooter(RAW);
    expect(en.columns[0]?.links.map((l) => l.label)).toEqual([
      "About",
      "Careers",
    ]);
  });
});

describe("derived contact links", () => {
  it("dials a phone number with the spaces stripped", () => {
    expect(contactLines({ kind: "phone", body: "+971 2 632 2223" })).toEqual([
      { value: "+971 2 632 2223", href: "tel:+97126322223" },
    ]);
  });

  it("splits a multi-line body into one entry per line", () => {
    expect(
      contactLines({ kind: "address", body: "Al Bateen\n\nAbu Dhabi " }),
    ).toEqual([
      { value: "Al Bateen", href: null },
      { value: "Abu Dhabi", href: null },
    ]);
  });
});

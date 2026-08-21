import { describe, expect, it } from "vitest";
import {
  SEARCH_HEADERS,
  SEARCH_HEADER_SECTION_KEY,
  getSearchHeader,
  isSearchHeaderKey,
  searchHeaderFor,
  searchHeaderPageDef,
} from "./search-headers";
import { mergeValues, resolveSections, str, validateSections } from "./index";
import { validate } from "@/lib/i18n/mt/validate";
import { arabicTwins } from "./twins";
import { SUBPAGE_KINDS, subPageSlug } from "./subpages";
import { PROPERTY_FORMS, PROPERTY_MODES } from "@/lib/schemas/property";
import type { StoredSection } from "./types";

const BUY = getSearchHeader("buy")!;

describe("the search-header registry", () => {
  it("registers itself as a sub-page kind, so it has a home in the CMS", () => {
    const kind = SUBPAGE_KINDS.find((k) => k.kind === "search");
    expect(kind, "no Search results card on /admin/pages").toBeTruthy();
    expect(kind!.adminPath).toBe("/admin/pages/sub/search");
    // It spans six routes, so `<publicPath>/…` would read "//…" — the label
    // has to be supplied, the way the library entry supplies one.
    expect(kind!.pathLabel).toBeTruthy();
  });

  it("stores under the reserved sub-page prefix", () => {
    expect(subPageSlug("search", "buy")).toBe("subpage/search/buy");
  });

  it("only answers to keys it declares", () => {
    expect(isSearchHeaderKey("buy")).toBe(true);
    expect(isSearchHeaderKey("mode.buy")).toBe(false);
    expect(getSearchHeader("mode.buy")).toBeNull();
  });

  it("has one document per key — a duplicate would orphan the other", () => {
    const keys = SEARCH_HEADERS.map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("names a public route and a revalidation path for every entry", () => {
    for (const entry of SEARCH_HEADERS) {
      expect(entry.publicPath.startsWith("/"), entry.key).toBe(true);
      // `revalidatePath` takes a path. A query on it names a cache key that
      // does not exist and silently no-ops — the whole reason this is a
      // separate field from `publicPath`.
      expect(entry.revalidatePath, entry.key).not.toContain("?");
      expect(entry.publicPath.startsWith(entry.revalidatePath), entry.key).toBe(
        true,
      );
    }
  });
});

describe("addressing", () => {
  it("covers every property mode, so no search route falls through", () => {
    for (const mode of PROPERTY_MODES) {
      const entry = searchHeaderFor(mode);
      expect(entry.match.mode, mode).toBe(mode);
      expect(entry.match.form, `${mode} resolved to a form facet`).toBeUndefined();
    }
  });

  it("covers every completion form on the buy umbrella", () => {
    for (const form of PROPERTY_FORMS) {
      const entry = searchHeaderFor("buy", form);
      expect(entry.match.form, form).toBe(form);
    }
  });

  it("gives /buy/ready and /buy/resale different headlines", () => {
    // The bug this whole split exists to prevent: the two sale sub-routes
    // looked identical for 27 migrations because they shared an h1.
    const ready = searchHeaderFor("buy", "ready_new").section.defaults.title;
    const resale = searchHeaderFor("buy", "resale").section.defaults.title;
    expect(ready).not.toBe(resale);
  });

  it("keeps the buy off-plan slice off the /off-plan heading", () => {
    expect(searchHeaderFor("buy", "off_plan").key).toBe("off-plan-sale");
    expect(searchHeaderFor("off_plan").key).toBe("off-plan");
    expect(searchHeaderFor("buy", "off_plan").section.defaults.title).not.toBe(
      searchHeaderFor("off_plan").section.defaults.title,
    );
  });

  it("ignores a form on a mode that has none — /rent has no completion form", () => {
    // `SearchList` never passes one, but a caller that did must get the mode
    // copy rather than nothing.
    expect(searchHeaderFor("rent", "resale").key).toBe("rent");
  });
});

/** Every field an editor can type prose into, English side. */
const PROSE_KEYS = [
  "eyebrow",
  "title",
  "subtitle",
  "meta_title",
  "meta_description",
] as const;

describe("defaults", () => {
  it("ships a headline for every facet, in English and in Arabic", () => {
    for (const entry of SEARCH_HEADERS) {
      const d = entry.section.defaults;
      for (const key of PROSE_KEYS) {
        expect(d[key], `${entry.key}.${key}`).toBeTruthy();
        expect(d[`${key}_ar`], `${entry.key}.${key}_ar`).toBeTruthy();
        expect(
          d[`${key}_ar`],
          `${entry.key}.${key}_ar is the English pasted in`,
        ).not.toBe(d[key]);
      }
    }
  });

  it("cannot be switched off — the section is the document", () => {
    for (const entry of SEARCH_HEADERS) {
      expect(entry.section.locked, entry.key).toBe(true);
      expect(entry.section.key, entry.key).toBe(SEARCH_HEADER_SECTION_KEY);
    }
  });

  it("says what is NOT editable here, so nobody hunts for the result count", () => {
    for (const entry of SEARCH_HEADERS) {
      expect(entry.section.dataNote, entry.key).toBeTruthy();
    }
  });
});

describe("Arabic", () => {
  it("derives a twin for each of the five fields", () => {
    const twins = arabicTwins(BUY.section.fields).map((f) => f.key);
    expect(twins).toEqual([
      "eyebrow_ar",
      "title_ar",
      "subtitle_ar",
      "meta_title_ar",
      "meta_description_ar",
    ]);
  });

  it("folds to Arabic on read, with no storage keys left behind", () => {
    const [section] = resolveSections(searchHeaderPageDef(BUY), null, "ar");
    expect(str(section!.values, "title")).toBe(
      BUY.section.defaults.title_ar as string,
    );
    expect(Object.keys(section!.values).some((k) => k.endsWith("_ar"))).toBe(
      false,
    );
  });

  it("keeps English on /en", () => {
    const [section] = resolveSections(searchHeaderPageDef(BUY), null, "en");
    expect(str(section!.values, "title")).toBe(
      BUY.section.defaults.title as string,
    );
  });

  it("survives a save — the twin is not stripped by validation", () => {
    const incoming: StoredSection[] = [
      {
        key: SEARCH_HEADER_SECTION_KEY,
        enabled: true,
        values: {
          eyebrow: "For sale",
          eyebrow_ar: "للبيع",
          title: "Homes worth keeping",
          title_ar: "منازل تستحق الاقتناء",
          subtitle: null,
          subtitle_ar: null,
          meta_title: "Homes worth keeping",
          meta_title_ar: "منازل تستحق الاقتناء",
          meta_description: "Every listing an advisor has stood inside.",
          meta_description_ar: "كل عقار وقف بداخله أحد مستشارينا.",
        },
      },
    ];
    const result = validateSections(searchHeaderPageDef(BUY), incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections[0]!.values.title_ar).toBe("منازل تستحق الاقتناء");
  });
});

describe("validation", () => {
  it("refuses a header with no title — a search page never gets an empty h1", () => {
    const result = validateSections(searchHeaderPageDef(BUY), [
      {
        key: SEARCH_HEADER_SECTION_KEY,
        enabled: true,
        values: {
          eyebrow: "For sale",
          title: "",
          subtitle: null,
          meta_title: "Properties for sale",
          meta_description: "Curated listings across the UAE.",
        },
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("accepts a blank eyebrow and sub-title — dropping the line is a choice", () => {
    const result = validateSections(searchHeaderPageDef(BUY), [
      {
        key: SEARCH_HEADER_SECTION_KEY,
        enabled: true,
        values: {
          eyebrow: "",
          title: "Properties for sale",
          subtitle: "",
          meta_title: "Properties for sale",
          meta_description: "Curated listings across the UAE.",
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(str(result.sections[0]!.values, "eyebrow")).toBeNull();
  });

  it("keeps a document that predates a new field renderable", () => {
    const merged = mergeValues(BUY.section, { title: "Only a title" } as never);
    expect(str(merged, "title")).toBe("Only a title");
    expect(str(merged, "eyebrow")).toBe(BUY.section.defaults.eyebrow);
  });
});

/**
 * The search-engine snippet.
 *
 * It sits in this document rather than in `pages.seo` because
 * `search_appearance` is keyed by `MasterPageKey` and has no address for a
 * facet of a search route. What it must not lose in the move is the invariant
 * `metadata-arabic.test.ts` protects on the master pages: never half a snippet.
 */
describe("the snippet", () => {
  it("ships both halves in Arabic on every facet", () => {
    /*
     * The reason `getSearchHeaderMeta` needs no all-or-nothing gate. An Arabic
     * title over an English description reads as broken rather than
     * untranslated — it tells a searcher the page is in a language it is not —
     * and the master-page loader carries a gate for exactly that. Here the
     * condition is made impossible at the source instead, which is the cheaper
     * of the two and the one a reader can check.
     */
    for (const entry of SEARCH_HEADERS) {
      const d = entry.section.defaults;
      expect(
        Boolean(d.meta_title_ar) && Boolean(d.meta_description_ar),
        `${entry.key} would publish half an Arabic snippet`,
      ).toBe(true);
    }
  });

  it("keeps every title inside what a search result shows", () => {
    // Google truncates around 60 characters. The field caps at 80 and the
    // layout appends " · Bazar"; a default that arrives already over the cap
    // is one nobody can fix without noticing it first.
    for (const entry of SEARCH_HEADERS) {
      expect(
        String(entry.section.defaults.meta_title).length,
        entry.key,
      ).toBeLessThanOrEqual(80);
    }
  });

  it("gives the buy off-plan facet its own snippet, not the umbrella's", () => {
    // The facet has no route of its own, so before this it published
    // /buy/search's metadata over a different h1.
    expect(getSearchHeader("off-plan-sale")!.section.defaults.meta_title).not.toBe(
      getSearchHeader("buy")!.section.defaults.meta_title,
    );
  });

  it("says the same thing in Arabic wherever it repeats in English", () => {
    // One English, one Arabic — `messages.test.ts`'s strongest assertion,
    // applied within this registry. /buy's title and /off-plan's description
    // each appear twice; a second translation of either would put two Arabics
    // for one English on one page.
    const byEnglish = new Map<string, Set<string>>();
    for (const entry of SEARCH_HEADERS) {
      const d = entry.section.defaults as Record<string, string>;
      for (const key of PROSE_KEYS) {
        const set = byEnglish.get(d[key]!) ?? new Set<string>();
        set.add(d[`${key}_ar`]!);
        byEnglish.set(d[key]!, set);
      }
    }
    const clashes = [...byEnglish.entries()]
      .filter(([, arabics]) => arabics.size > 1)
      .map(([english, arabics]) => `${english}\n  ${[...arabics].join("\n  ")}`);
    expect(clashes, clashes.join("\n\n")).toEqual([]);
  });
});

/**
 * G-19-shaped: the shipped Arabic passes the same structural gates a generated
 * string has to pass before the pipeline will write it (ADR-0008 §4).
 *
 * Worth running on committed defaults and not only on pipeline output, because
 * these were hand-placed — the copy lifted from `messages/ar/search.json`, the
 * snippet drafted for this change — so no pipeline ever checked them. The
 * glossary half is the load-bearing one: rendering "leasehold" as إيجار calls a
 * long-dated usufruct a rental agreement, and a fluent wrong word is worse than
 * an awkward right one because nobody reviewing it notices.
 */
describe("the shipped Arabic passes the structural gates", () => {
  /**
   * Slots that trip a gate and ship anyway, with the reason. **Shrink only.**
   */
  const ALLOWED: Readonly<Record<string, string>> = {
    // Curated copy from `messages/ar/search.json`, unchanged by this registry.
    // Both hits are matcher limitations rather than wrong words: مطوّر carries
    // a shadda and the glossary stem مطور does not, and "بخطة سداد" is the
    // indefinite of the glossary's "خطة السداد". Neither misstates anything.
    "off-plan-sale.subtitle": "diacritic and article; the matcher does not normalise either",
  };

  it("finds every slot, so the assertion below is not vacuous", () => {
    expect(SEARCH_HEADERS.length * PROSE_KEYS.length).toBe(35);
  });

  it("has no unexplained failure", () => {
    const failures: string[] = [];
    for (const entry of SEARCH_HEADERS) {
      const d = entry.section.defaults as Record<string, string>;
      for (const key of PROSE_KEYS) {
        const path = `${entry.key}.${key}`;
        const issues = validate(d[key]!, d[`${key}_ar`]!);
        if (issues.length === 0 || path in ALLOWED) continue;
        failures.push(
          `${path}: ${issues.map((i) => `${i.code} — ${i.detail}`).join("; ")}` +
            `\n    en: ${d[key]}\n    ar: ${d[`${key}_ar`]}`,
        );
      }
    }
    expect(failures, failures.join("\n\n")).toEqual([]);
  });

  it("keeps the allowlist honest — an entry that now passes must be removed", () => {
    for (const [path, reason] of Object.entries(ALLOWED)) {
      const [key, field] = path.split(".") as [string, string];
      const d = getSearchHeader(key)!.section.defaults as Record<string, string>;
      expect(
        validate(d[field]!, d[`${field}_ar`]!).length,
        `${path} passes now — delete its allowlist entry (${reason})`,
      ).toBeGreaterThan(0);
    }
  });
});

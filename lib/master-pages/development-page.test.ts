import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_PAGE_COPY_KEY,
  DEVELOPMENT_PAGE_COPY_NAMESPACE,
  DEVELOPMENT_PAGE_COPY_SECTIONS,
  DEVELOPMENT_TOKENS,
  developmentPageCopyDef,
  developmentPageCopyDefault,
  fillTokens,
} from "./development-page";
import {
  DEVELOPMENT_SECTIONS,
  SUBPAGE_SLUG_PREFIX,
  sharedCopyHelp,
} from "./subpages";
import { resolveSections } from "./index";
import type { SimpleFieldDef } from "./types";

/**
 * The shared project-page copy document — the wording every
 * `/developments/<slug>` page publishes unless that project overrides it.
 *
 * The failure this file is really about is the one the per-project registry
 * already shipped twice: a field declared with no reader (eleven of them, saved
 * and dropped on the floor) and a reader with no field (`renders.eyebrow`,
 * silently null on every page). Both are invisible on the screen that would
 * catch them, because a missing eyebrow just looks like a design choice.
 */
const PAGE = join(
  import.meta.dirname,
  "..",
  "..",
  "app",
  "[locale]",
  "(public)",
  "developments",
  "[slug]",
  "page.tsx",
);
const pageSource = readFileSync(PAGE, "utf8");

const textFields = DEVELOPMENT_PAGE_COPY_SECTIONS.flatMap((section) =>
  section.fields
    .filter((f) => f.kind === "text" || f.kind === "textarea")
    .map((f) => ({ section: section.key, field: f.key, def: f as SimpleFieldDef })),
);

describe("the shared project-page copy document", () => {
  it("has copy fields to check", () => {
    // Guards the file itself: a registry that stopped declaring fields would
    // otherwise make every `it.each` below pass by iterating nothing.
    expect(textFields.length).toBeGreaterThan(20);
  });

  it("is stored outside the namespace one project's own document uses", () => {
    /*
     * The collision this asserts against is silent in both directions: a
     * development slugged "copy" would write its own page document to the same
     * `pages.slug` as this one and each save would clobber the other, with no
     * error and nothing in the audit log saying which won.
     */
    expect(DEVELOPMENT_PAGE_COPY_NAMESPACE).not.toBe("development");
    expect(
      `${SUBPAGE_SLUG_PREFIX}${DEVELOPMENT_PAGE_COPY_NAMESPACE}/${DEVELOPMENT_PAGE_COPY_KEY}`,
    ).not.toMatch(/^subpage\/development\//);
  });

  it("keeps every band switched on", () => {
    // Whether a band shows on a given project is that project's decision. A
    // toggle here would read as a site-wide kill switch and behave as neither.
    for (const s of DEVELOPMENT_PAGE_COPY_SECTIONS) expect(s.locked).toBe(true);
  });

  it("names only bands the project template actually has", () => {
    const template = new Set(DEVELOPMENT_SECTIONS.map((s) => s.key));
    for (const s of DEVELOPMENT_PAGE_COPY_SECTIONS)
      expect(template).toContain(s.key);
  });

  it("keeps the two registries in the same order", () => {
    // The two editors sit one click apart and are read as two views of one
    // page. Divergent order is the cheapest way to make them read as two
    // unrelated forms.
    const template = DEVELOPMENT_SECTIONS.map((s) => s.key);
    const shared = DEVELOPMENT_PAGE_COPY_SECTIONS.map((s) => s.key);
    expect(shared).toEqual(template.filter((k) => shared.includes(k)));
  });

  it.each(textFields)("ships English for $section · $field", ({ section, field }) => {
    const value = developmentPageCopyDefault(section, field);
    expect(value, `${section}.${field} has no shipped wording`).not.toBeNull();
  });

  it.each(textFields)("ships Arabic for $section · $field", ({ section, field }) => {
    /*
     * Not optional. The whole reason this document exists rather than the
     * literals it replaced is that a literal behind `??` cannot be Arabic, and
     * a twin left undeclared here reintroduces exactly that hole — an English
     * eyebrow over Arabic body copy on /ar.
     */
    expect(
      developmentPageCopyDefault(section, `${field}_ar`),
      `${section}.${field} has no Arabic twin`,
    ).not.toBeNull();
  });

  it.each(textFields)(
    "carries the same tokens either side of $section · $field",
    ({ section, field }) => {
      const english = developmentPageCopyDefault(section, field)!;
      const arabic = developmentPageCopyDefault(section, `${field}_ar`)!;
      for (const token of Object.values(DEVELOPMENT_TOKENS)) {
        // Position may differ — that is what tokens are for — but presence may
        // not: an Arabic heading that dropped {name} renders a sentence about
        // no project in particular.
        expect(
          arabic.includes(token),
          `${section}.${field}_ar is missing ${token}`,
        ).toBe(english.includes(token));
      }
    },
  );

  it("substitutes every token it declares", () => {
    const filled = fillTokens(
      Object.values(DEVELOPMENT_TOKENS).join(" "),
      Object.fromEntries(
        Object.keys(DEVELOPMENT_TOKENS).map((k) => [k, `<${k}>`]),
      ),
    );
    expect(filled).not.toMatch(/[{}]/);
  });

  it("leaves a token nobody supplied alone rather than blanking it", () => {
    // Visible, and therefore fixable. A token silently deleted takes the words
    // around it with it and reads as a copy mistake.
    expect(fillTokens("Within {name} and {nope}", { name: "Yas" })).toBe(
      "Within Yas and {nope}",
    );
  });
});

describe("the page reads what the document declares", () => {
  it.each(textFields)(
    "reads $section · $field",
    ({ section, field }) => {
      expect(pageSource).toContain(`shared("${section}", "${field}")`);
    },
  );

  it("reads no field the document never declares", () => {
    // The mirror-image bug, and the one that already shipped once on this page
    // under `sv()`: a reader whose field was never declared resolves to null
    // forever and looks like a design decision.
    const declared = new Set(
      textFields.map(({ section, field }) => `${section}:${field}`),
    );
    const read = [...pageSource.matchAll(/shared\("([\w-]+)", "(\w+)"\)/g)].map(
      (m) => `${m[1]}:${m[2]}`,
    );
    expect(read.length).toBeGreaterThan(0);
    for (const key of new Set(read)) expect(declared).toContain(key);
  });

  it("puts the project's own override first at every call site", () => {
    /*
     * `sv(...) ?? shared(...)`, never the other way round. Reversed, a project
     * could no longer say anything of its own — and the per-project editor
     * would keep accepting the text, which is the worst version of the bug.
     *
     * Two assertions rather than one regex, because the overview heading picks
     * between two shared fields on whether the project has an area, so the
     * `??` is not always the token immediately before `shared(`.
     */
    expect(pageSource).not.toMatch(/shared\([^)]*\)\s*\?\?\s*sv\(/);

    for (const match of pageSource.matchAll(
      /shared\("([\w-]+)", "(\w+)"\)/g,
    )) {
      const before = pageSource.slice(
        Math.max(0, match.index - 260),
        match.index,
      );
      expect(
        before,
        `shared("${match[1]}", "${match[2]}") has no sv() override above it`,
      ).toMatch(new RegExp(`sv\\("${match[1]}", "\\w+"\\)[^;]*$`));
    }
  });
});

describe("the per-project editor quotes this document rather than copying it", () => {
  const overridable = DEVELOPMENT_SECTIONS.flatMap((section) =>
    section.fields
      .filter(
        (f): f is SimpleFieldDef => f.kind === "text" || f.kind === "textarea",
      )
      .map((f) => ({ section: section.key, field: f })),
  );

  it("shows the shared wording as the placeholder of every field that has one", () => {
    /*
     * The visible half of "pre-filled". `help` cannot carry it: `FieldLabel`
     * draws help on the label's baseline row and suppresses it whenever `max`
     * is set, which is every field on this editor — so before the placeholder
     * existed, an editor's only signal was an empty box.
     */
    for (const { section, field } of overridable) {
      const shipped = developmentPageCopyDefault(section, field.key);
      if (shipped === null) continue;
      expect(
        field.placeholder,
        `${section}.${field.key} does not show its shared wording`,
      ).toBe(shipped);
      expect(field.placeholderAr).toBe(
        developmentPageCopyDefault(section, `${field.key}_ar`),
      );
    }
  });

  it("generates its help text instead of retyping the wording", () => {
    /*
     * The drift this prevents is not hypothetical — the renders section's help
     * text said “The vision” while the page rendered it and the registry
     * stored it: three copies of one string, and the eyebrow the help text
     * described had no reader at all.
     *
     * Asserted as "the help is byte-identical to what the generator produces"
     * rather than as a scan for the strings themselves, because a section's
     * label is legitimately the same word as its eyebrow ("Overview",
     * "Location", "Renders") and a value-by-value scan cannot tell a label from
     * a retyped default.
     */
    for (const { section, field } of overridable) {
      if (developmentPageCopyDefault(section, field.key) === null) continue;
      expect(
        field.help,
        `${section}.${field.key}'s help text is hand-typed`,
      ).toBe(sharedCopyHelp(section, field.key));
    }
  });
});

describe("the document resolves like every other one", () => {
  it("comes back whole with nothing stored", () => {
    const sections = resolveSections(developmentPageCopyDef(), null);
    expect(sections.map((s) => s.key)).toEqual(
      DEVELOPMENT_PAGE_COPY_SECTIONS.map((s) => s.key),
    );
    for (const s of sections) expect(s.enabled).toBe(true);
  });

  it("folds to Arabic on /ar", () => {
    const [overview] = resolveSections(
      developmentPageCopyDef(),
      null,
      "ar",
    ).filter((s) => s.key === "overview");
    expect(overview!.values.eyebrow).toBe("اكتشف المجتمع");
    // The fold must leave no storage-shaped key behind for a renderer to read.
    expect(Object.keys(overview!.values).some((k) => k.endsWith("_ar"))).toBe(
      false,
    );
  });
});

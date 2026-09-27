import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_PAGE_ADMIN_PATH,
  AGENT_PAGE_COPY_KEY,
  AGENT_PAGE_COPY_NAMESPACE,
  AGENT_PAGE_COPY_SECTIONS,
  AGENT_TOKENS,
  agentPageCopyDef,
  agentPageCopyDefault,
  fillTokens,
} from "./agent-page";
import {
  AGENT_SECTIONS,
  SUBPAGE_KINDS,
  SUBPAGE_SLUG_PREFIX,
  agentPageDef,
  getSubPageKind,
  subPageSlug,
} from "./subpages";
import { resolveSections, str, validateSections } from "./index";
import { unknownTokenIssues } from "./tokens";
import type { SimpleFieldDef } from "./types";

/**
 * The advisor profile registries: the one document every `/agents/<slug>`
 * shares, and the per-advisor document that overrides it.
 *
 * Most of what is pinned here is the contract between the registry and the
 * page, in both directions — a field the page reads that the registry never
 * declares resolves to "" forever and looks like a design decision, and a
 * field the registry declares that the page never reads is an input an editor
 * types into for nothing.
 */

const PAGE = join(
  import.meta.dirname,
  "../../app/[locale]/(public)/agents/[slug]/page.tsx",
);
const pageSource = readFileSync(PAGE, "utf8");

const copyFields = AGENT_PAGE_COPY_SECTIONS.flatMap((section) =>
  section.fields
    .filter(
      (f): f is SimpleFieldDef => f.kind === "text" || f.kind === "textarea",
    )
    .map((f) => ({ section: section.key, field: f.key })),
);

const TOKENS = Object.values(AGENT_TOKENS);

describe("the shared advisor-profile document", () => {
  it("has copy fields to check", () => {
    expect(copyFields.length).toBeGreaterThan(10);
  });

  it("is stored outside the namespace an advisor's own document uses", () => {
    // `subpage/agent/<user_id>` is one advisor's page. The shared document
    // under the same prefix would be one unlucky id away from being
    // overwritten — so it has a namespace no record can write to.
    const shared = `${SUBPAGE_SLUG_PREFIX}${AGENT_PAGE_COPY_NAMESPACE}/${AGENT_PAGE_COPY_KEY}`;
    expect(shared).toBe("subpage/agent-copy/shared");
    expect(shared.startsWith(subPageSlug("agent", ""))).toBe(false);
    expect(SUBPAGE_KINDS.map((k) => k.kind)).not.toContain(
      AGENT_PAGE_COPY_NAMESPACE,
    );
  });

  it("locks every band, because showing one is each advisor's decision", () => {
    for (const section of AGENT_PAGE_COPY_SECTIONS) {
      expect(section.locked, section.key).toBe(true);
    }
  });

  it("names only bands an advisor's page actually has", () => {
    const bands = new Set(AGENT_SECTIONS.map((s) => s.key));
    for (const section of AGENT_PAGE_COPY_SECTIONS) {
      expect(bands, section.key).toContain(section.key);
    }
  });

  it.each(copyFields)(
    "ships English and Arabic for $section · $field",
    ({ section, field }) => {
      expect(agentPageCopyDefault(section, field)).toBeTruthy();
      expect(agentPageCopyDefault(section, `${field}_ar`)).toBeTruthy();
    },
  );

  it.each(copyFields)(
    "keeps the same tokens in both languages for $section · $field",
    ({ section, field }) => {
      const english = agentPageCopyDefault(section, field)!;
      const arabic = agentPageCopyDefault(section, `${field}_ar`)!;
      for (const token of TOKENS) {
        expect(
          arabic.includes(token),
          `${section}.${field}_ar disagrees about ${token}`,
        ).toBe(english.includes(token));
      }
    },
  );

  it("ships only tokens a profile fills", () => {
    const def = agentPageCopyDef();
    const shipped = resolveSections(def, null, "bilingual").map((s) => ({
      key: s.key,
      enabled: s.enabled,
      values: s.values,
    }));
    expect(unknownTokenIssues(def, shipped, TOKENS)).toEqual([]);
  });

  it("refuses a token no profile fills", () => {
    const def = agentPageCopyDef();
    const result = validateSections(def, [
      {
        key: "reviews",
        enabled: true,
        values: { eyebrow: "Clients", heading: "Working with {advisor}." },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issues = unknownTokenIssues(def, result.sections, TOKENS);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("{advisor}");
  });

  it("substitutes every token it declares", () => {
    const filled = fillTokens(
      TOKENS.join(" "),
      Object.fromEntries(Object.keys(AGENT_TOKENS).map((k) => [k, `<${k}>`])),
    );
    expect(filled).toBe("<name> <first_name>");
  });

  it("keeps the Arabic the catalogue shipped for the strings that moved", () => {
    // These were catalogue keys until this document existed. /ar printed
    // exactly this, and moving a string must not quietly retranslate it.
    expect(agentPageCopyDefault("hero", "back_label_ar")).toBe("فريقنا");
    expect(agentPageCopyDefault("hero", "title_fallback_ar")).toBe("المستشار");
    expect(agentPageCopyDefault("hero", "whatsapp_label_ar")).toBe("واتساب");
    expect(agentPageCopyDefault("listings", "eyebrow_ar")).toBe(
      "المعروضات النشطة",
    );
    expect(agentPageCopyDefault("cta", "cta_label_ar")).toBe("أرسل طلبك");
  });

  it("keeps the English the page published, byte for byte", () => {
    expect(agentPageCopyDefault("hero", "call_label")).toBe("Call");
    expect(agentPageCopyDefault("reviews", "heading")).toBe(
      "Working with {first_name}.",
    );
    expect(agentPageCopyDefault("listings", "empty")).toBe(
      "No public listings on the desk this week. Open a brief to discuss what {first_name} is working on off-market.",
    );
    expect(agentPageCopyDefault("cta", "heading")).toBe("Work with {first_name}.");
  });
});

describe("the page reads what the document declares", () => {
  it.each(copyFields)("reads $section · $field", ({ section, field }) => {
    expect(pageSource).toContain(`copy("${section}", "${field}")`);
  });

  it("reads no field the document never declares", () => {
    const declared = new Set(
      copyFields.map(({ section, field }) => `${section}:${field}`),
    );
    const read = [...pageSource.matchAll(/copy\("([\w-]+)", "(\w+)"\)/g)].map(
      (m) => `${m[1]}:${m[2]}`,
    );
    expect(read.length).toBeGreaterThan(0);
    for (const key of new Set(read)) expect(declared).toContain(key);
  });

  it("renders every band an advisor's document can switch", () => {
    // A section the editor can toggle that the page never keys a band on would
    // be a switch wired to nothing.
    for (const section of AGENT_SECTIONS) {
      if (section.key === "hero") continue;
      expect(pageSource, section.key).toMatch(
        new RegExp(`\\n    ${section.key}:`),
      );
    }
  });
});

describe("one advisor's own document", () => {
  const def = agentPageDef({ name: "Bazar Advisor", slug: "bazar-advisor" });

  it("is its own sub-page kind, with its own admin route", () => {
    const kind = getSubPageKind("agent");
    expect(kind?.label).toBe("Agents");
    expect(kind?.publicPath).toBe("/agents");
    expect(kind?.adminPath).toBe("/admin/pages/sub/agent");
    expect(AGENT_PAGE_ADMIN_PATH.startsWith(kind!.adminPath)).toBe(true);
  });

  it("starts every override blank and every band on", () => {
    const resolved = resolveSections(def, null);
    for (const section of resolved) {
      expect(section.enabled, section.key).toBe(true);
      for (const field of section.def.fields) {
        expect(str(section.values, field.key), `${section.key}.${field.key}`)
          .toBeNull();
      }
    }
  });

  it("keeps the header on and first, and lets the rest be switched off", () => {
    const hero = AGENT_SECTIONS.find((s) => s.key === "hero")!;
    expect(hero.locked).toBe(true);
    expect(AGENT_SECTIONS[0]!.key).toBe("hero");
    const resolved = resolveSections(def, [
      { key: "hero", enabled: false, values: {} },
      { key: "listings", enabled: false, values: {} },
    ]);
    expect(resolved.find((s) => s.key === "hero")!.enabled).toBe(true);
    expect(resolved.find((s) => s.key === "listings")!.enabled).toBe(false);
  });

  it("overrides only fields the shared document carries", () => {
    for (const section of AGENT_SECTIONS) {
      for (const field of section.fields) {
        expect(
          agentPageCopyDefault(section.key, field.key),
          `${section.key}.${field.key} overrides nothing`,
        ).not.toBeNull();
      }
    }
  });

  it("shows the shared wording as the placeholder, in both languages", () => {
    for (const section of AGENT_SECTIONS) {
      for (const field of section.fields as SimpleFieldDef[]) {
        expect(field.placeholder).toBe(
          agentPageCopyDefault(section.key, field.key),
        );
        expect(field.placeholderAr).toBe(
          agentPageCopyDefault(section.key, `${field.key}_ar`),
        );
        expect(field.optional).toBe(true);
      }
    }
  });
});

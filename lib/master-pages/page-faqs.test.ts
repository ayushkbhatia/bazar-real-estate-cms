import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSections, validateSections, defaultDocument } from "./index";
import type { StoredSection } from "./types";
import {
  PAGE_FAQS,
  PAGE_FAQ_SECTION,
  getPageFaq,
  pageFaqKeyFor,
  pageFaqPageDef,
} from "./page-faqs";
import { SEED_SERVICES } from "@/lib/seeds/services";

const PUBLIC = path.join(process.cwd(), "app/[locale]/(public)");

describe("page FAQ registry", () => {
  it("has unique keys, each naming its group", () => {
    const keys = PAGE_FAQS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of PAGE_FAQS) {
      const prefix: Record<typeof f.group, string> = {
        guides: "guide-",
        services: "service-",
        tools: "tool-",
        developers: "developer-",
      };
      expect(f.key.startsWith(prefix[f.group])).toBe(true);
    }
  });

  it("points every entry at a route that exists and mounts its FAQ", () => {
    for (const f of PAGE_FAQS) {
      const file = path.join(PUBLIC, f.publicPath, "page.tsx");
      expect(fs.existsSync(file), `${f.publicPath} has no page.tsx`).toBe(true);
      const src = fs.readFileSync(file, "utf8");
      // Mounted directly, through GuideShell's faqKey, or through ServicePage,
      // which derives the key from the service's slug.
      const mounted =
        src.includes(`"${f.key}"`) || (f.group === "services" && src.includes("ServicePage"));
      expect(mounted, `${f.publicPath} does not render the "${f.key}" FAQ`).toBe(true);
    }
  });

  it("covers every service page except sell, whose FAQ is its master page's", () => {
    for (const s of SEED_SERVICES) {
      const key = pageFaqKeyFor("services", s.slug);
      if (s.slug === "sell") expect(key).toBeNull();
      else expect(key, s.slug).toBe(`service-${s.slug}`);
    }
  });

  it("accepts a well-formed developer key, and nothing else outside the registry", () => {
    expect(getPageFaq("developer-aldar-properties")).toMatchObject({
      group: "developers",
      publicPath: "/developers/aldar-properties",
    });
    expect(pageFaqKeyFor("developers", "aldar-properties")).toBe("developer-aldar-properties");
    for (const bad of ["developer-", "developer-Aldar", "developer-../x", "guide-nope", "tool-mortgage"]) {
      expect(getPageFaq(bad), bad).toBeNull();
    }
    const src = fs.readFileSync(path.join(PUBLIC, "developers/[slug]/page.tsx"), "utf8");
    expect(src).toContain("developerFaqKey(slug)");
  });

  it("ships no questions: an unsaved page renders no FAQ", () => {
    const entry = getPageFaq("guide-golden-visa")!;
    const [section] = resolveSections(pageFaqPageDef(entry), null, "en");
    expect(section!.values.items).toEqual([]);
  });

  it("folds stored Arabic on /ar and falls back to English per question", () => {
    const entry = getPageFaq("tool-valuation")!;
    const stored: StoredSection[] = [
      {
        key: PAGE_FAQ_SECTION.key,
        enabled: true,
        values: {
          items: [
            { q: "How is it valued?", a: "From comparables.", q_ar: "كيف يُقيَّم؟", a_ar: "من المقارنات." },
            { q: "English only?", a: "Yes.", q_ar: "", a_ar: "" },
          ],
        },
      },
    ];
    const [ar] = resolveSections(pageFaqPageDef(entry), stored, "ar");
    const items = ar!.values.items as { q: string; a: string }[];
    expect(items[0]).toMatchObject({ q: "كيف يُقيَّم؟", a: "من المقارنات." });
    expect(items[1]).toMatchObject({ q: "English only?", a: "Yes." });
  });

  it("validates its own default document", () => {
    const entry = getPageFaq("service-snagging")!;
    const def = pageFaqPageDef(entry);
    expect(validateSections(def, defaultDocument(def)).ok).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Body } from "./_document";
import { getMasterPage, mergeValues, resolveSections, str, list } from "@/lib/master-pages";
import type { MasterPageDef } from "@/lib/master-pages";

/**
 * The four conventions a legal clause is stored in — blank line, bullet, bold,
 * email — and the guarantee that the privacy policy still has both languages
 * after it stopped being JSX.
 *
 * `renderToStaticMarkup` rather than Testing Library on purpose: `Body` is a
 * plain synchronous component with no browser surface, and going through jsdom
 * would buy nothing but a dependency on `window`.
 */
const html = (text: string) => renderToStaticMarkup(<Body text={text} />);

describe("Body", () => {
  it("starts a paragraph at a blank line", () => {
    expect(html("One.\n\nTwo.")).toBe("<p>One.</p><p>Two.</p>");
  });

  it("turns a run of bullet lines into one list", () => {
    expect(html("• a\n• b")).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("keeps a paragraph that merely mentions a bullet as a paragraph", () => {
    // Every line, or nothing — otherwise a clause that quotes "•" mid-sentence
    // silently becomes a one-item list.
    expect(html("Marked with • in the table.")).toBe(
      "<p>Marked with • in the table.</p>",
    );
  });

  it("renders **text** bold and leaves the markers out", () => {
    expect(html("• **Call integration** — your number.")).toBe(
      "<ul><li><b>Call integration</b> — your number.</li></ul>",
    );
  });

  it("links a bare email address, left-to-right inside Arabic prose", () => {
    expect(html("• البريد الإلكتروني: info@bazarrealestate.ae")).toContain(
      '<a href="mailto:info@bazarrealestate.ae" dir="ltr">info@bazarrealestate.ae</a>',
    );
  });

  it("leaves a lone asterisk alone", () => {
    expect(html("A * B")).toBe("<p>A * B</p>");
  });
});

describe("the privacy policy registry", () => {
  const def = getMasterPage("legal-privacy") as MasterPageDef;
  const doc = def.sections[0];

  it("declares an Arabic twin for every clause it publishes", () => {
    // The Arabic here is the client's own, hand-declared beside its English
    // (see sections/legal-privacy.ts). Nothing fills a gap at runtime, so a
    // missing twin ships an English clause into the Arabic policy.
    const clauses = doc.defaults.clauses as Record<string, string>[];
    expect(clauses.length).toBe(11);
    for (const clause of clauses) {
      expect(clause.heading_ar?.trim(), clause.heading).toBeTruthy();
      expect(clause.body_ar?.trim(), clause.heading).toBeTruthy();
    }
  });

  it("folds to Arabic end to end, chrome included", () => {
    const [section] = resolveSections(def, null, "ar");
    expect(str(section.values, "title")).toBe("سياسة الخصوصية");
    expect(str(section.values, "date_label")).toBe("آخر تحديث");
    // The mailbox is `i18n: false` — an address is not prose, and folding it
    // would stop it being an address.
    expect(str(section.values, "contact_email")).toBe("info@bazarrealestate.ae");
    expect(str(list<Record<string, string>>(section.values, "clauses")[0], "heading"))
      .toBe("١. مقدمة");
  });

  it("keeps an editor's English without inventing Arabic for it", () => {
    // The cost of hand-declared twins: rewriting one side does not rewrite the
    // other. Asserted so the behaviour is a decision rather than a surprise.
    const merged = mergeValues(doc, { title: "Data protection notice" });
    expect(merged.title).toBe("Data protection notice");
    expect(merged.title_ar).toBe("سياسة الخصوصية");
  });
});

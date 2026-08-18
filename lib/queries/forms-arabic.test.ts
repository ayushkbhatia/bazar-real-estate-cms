/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { localiseDeep } from "@/lib/i18n/localise";
import { resolveForm, type StoredField } from "@/lib/forms/resolve";

/**
 * Every `_ar` column a query selects must actually be mapped onto the object.
 *
 * This exists because of a bug that was live in production and invisible from
 * every angle. `FIELD_COLUMNS` selected `label_ar`, `placeholder_ar`,
 * `help_ar` and `unit_ar`; `toStoredField` mapped none of them. So:
 *
 *   - migration 0104 added the columns,
 *   - `_actions.ts` wrote them,
 *   - `localiseFields` existed for the sole purpose of folding them,
 *   - and `localiseDeep` received objects that had never carried them.
 *
 * Nothing threw. The public site rendered English under `lang="ar"`, which is
 * the designed fallback and therefore looks correct. And the CMS read through
 * the same function, so the editor showed *empty* Arabic inputs over stored
 * content — and saving that form wrote the blanks back. The second save
 * destroyed the data.
 *
 * TypeScript cannot catch this class: `StoredField` is
 * `FormFieldDef & { position: number }` and every twin on `FormFieldDef` is
 * optional — correctly so, because a form need not have Arabic. Omitting them
 * is well-typed.
 *
 * So the guard is written against the SELECT string rather than against the
 * four names, and a fifth twin cannot repeat the mistake.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SOURCE = readFileSync(join(REPO_ROOT, "lib/queries/forms.ts"), "utf8");

/** The body of a top-level `function name(...) { ... }`, brace-matched. */
function functionBody(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`no function ${name} in lib/queries/forms.ts`);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

function selectedColumns(constName: string): string[] {
  const m = SOURCE.match(new RegExp(`const ${constName} =\\s*([^;]+);`));
  if (!m) throw new Error(`no ${constName}`);
  return m[1]!
    .replace(/["'\n\s]/g, "")
    .split(",")
    .filter(Boolean);
}

describe("form queries · selected Arabic columns are mapped", () => {
  it("maps every _ar column FIELD_COLUMNS selects", () => {
    const twins = selectedColumns("FIELD_COLUMNS").filter((c) => c.endsWith("_ar"));
    const body = functionBody(SOURCE, "toStoredField");
    const dropped = twins.filter((c) => !new RegExp(`\\b${c}\\b`).test(body));

    expect(
      dropped,
      `lib/queries/forms.ts selects these columns and toStoredField never ` +
        `reads them:\n${dropped.join("\n")}\n\n` +
        `The Arabic is then fetched and thrown away: the public site silently ` +
        `falls back to English, and the CMS renders a blank input over stored ` +
        `content — so the next save writes the blank back and the translation ` +
        `is gone. TypeScript cannot see it, because every twin on ` +
        `FormFieldDef is optional.`,
    ).toEqual([]);
  });

  it("selects the twins in the first place", () => {
    // The mirror failure: mapping a column nobody selected yields undefined
    // just as silently. Both halves have to be true for the fold to work.
    const twins = selectedColumns("FIELD_COLUMNS").filter((c) => c.endsWith("_ar"));
    expect(twins.sort()).toEqual(["help_ar", "label_ar", "placeholder_ar", "unit_ar"]);
  });

  it("scans a believable source file", () => {
    expect(SOURCE.length).toBeGreaterThan(3000);
    expect(functionBody(SOURCE, "toStoredField").length).toBeGreaterThan(200);
  });
});

describe("form fields · the fold reaches Arabic", () => {
  const field = (over: Partial<StoredField> = {}): StoredField =>
    ({
      key: "budget",
      label: "Budget",
      label_ar: "الميزانية",
      type: "text",
      mapping: "none",
      placeholder: "e.g. 2,000,000",
      placeholder_ar: "مثال: 2,000,000",
      help: "Roughly what you plan to spend.",
      help_ar: "ما تخطط لإنفاقه تقريبًا.",
      required: false,
      enabled: true,
      width: "full",
      options: [],
      optionSource: null,
      rows: null,
      min: null,
      max: null,
      step: null,
      unit: null,
      unit_ar: null,
      showWhen: null,
      locked: false,
      position: 0,
      ...over,
    }) as StoredField;

  it("renders the Arabic on /ar", () => {
    const folded = localiseDeep([field()], "ar");
    expect(folded[0]!.label).toBe("الميزانية");
    expect(folded[0]!.placeholder).toBe("مثال: 2,000,000");
    expect(folded[0]!.help).toBe("ما تخطط لإنفاقه تقريبًا.");
    // The storage shape never reaches a renderer.
    expect("label_ar" in folded[0]!).toBe(false);
  });

  it("keeps English on /en", () => {
    const folded = localiseDeep([field()], "en");
    expect(folded[0]!.label).toBe("Budget");
    expect("label_ar" in folded[0]!).toBe(false);
  });

  it("resolves a blank twin through the shared store", () => {
    /*
     * A blank `_ar` no longer means English — it means "ask the store", the
     * same fallback `fillFormArabic` and `fillArabic` already gave forms and
     * master-page sections. Before this, `localiseDeep` returned "Budget" here
     * while `resolveForm` two tests below returned الميزانية for the same
     * field: one store, two answers, depending on which function you happened
     * to call. They agree now.
     */
    const folded = localiseDeep([field({ label_ar: null, help_ar: "" })], "ar");
    expect(folded[0]!.label).toBe("الميزانية");
  });

  it("keeps English when the store has never seen the phrase", () => {
    const folded = localiseDeep(
      [field({ label: "Preferred completion quarter", label_ar: null })],
      "ar",
    );
    expect(folded[0]!.label).toBe("Preferred completion quarter");
  });

  it("survives resolveForm, which is what the page actually calls", () => {
    const resolved = resolveForm("home_list_property", null, localiseDeep([field()], "ar"));
    expect(resolved).not.toBeNull();
    const budget = resolved!.fields.find((f) => f.key === "budget");
    expect(budget?.label).toBe("الميزانية");
  });
});

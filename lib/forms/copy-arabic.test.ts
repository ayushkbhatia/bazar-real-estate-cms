/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveForm } from "./resolve";
import { FORM_COPY_KEYS, FORM_COPY_ALL_KEYS, copyArKey } from "./copy-keys";
import { formCopySchema } from "@/lib/schemas/form";
import { localiseRow } from "@/lib/i18n/localise";
import { FORM_DEFS } from "./registry";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

describe("FORM_COPY_KEYS is the single source", () => {
  it("covers exactly the keys the registry writes", () => {
    // If a form ever grew an eighth copy key without this list learning about
    // it, the key would be stripped by zod and destroyed on save.
    for (const def of FORM_DEFS) {
      expect(Object.keys(def.copy).sort()).toEqual(
        FORM_COPY_KEYS.map((k) => k.key).sort(),
      );
    }
  });

  it("gives every English key an Arabic twin in the schema", () => {
    const shape = Object.keys(formCopySchema.shape);
    for (const { key } of FORM_COPY_KEYS) {
      expect(shape).toContain(key);
      expect(shape, `${key} has no Arabic twin`).toContain(copyArKey(key));
    }
    expect(shape.sort()).toEqual([...FORM_COPY_ALL_KEYS].sort());
  });

  it("keeps the twins optional, so a form with no Arabic still saves", () => {
    const english = Object.fromEntries(
      FORM_COPY_KEYS.map((k) => [k.key, k.optional ? null : "x"]),
    );
    expect(formCopySchema.safeParse(english).success).toBe(true);
  });

  it("accepts and preserves Arabic when it is there", () => {
    const input = {
      ...Object.fromEntries(FORM_COPY_KEYS.map((k) => [k.key, k.optional ? null : "x"])),
      submit_label_ar: "إرسال",
    };
    const parsed = formCopySchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.submit_label_ar).toBe("إرسال");
  });

  it("allows Arabic longer than its English cap", () => {
    // 1.5x, per arMax. Reusing the English cap silently rejects correct Arabic,
    // and a rejected translation is a field that stays English.
    const english = Object.fromEntries(
      FORM_COPY_KEYS.map((k) => [k.key, k.optional ? null : "x"]),
    );
    expect(
      formCopySchema.safeParse({ ...english, submit_label_ar: "ب".repeat(85) }).success,
    ).toBe(true);
    expect(
      formCopySchema.safeParse({ ...english, submit_label_ar: "ب".repeat(95) }).success,
    ).toBe(false);
  });
});

describe("mergeCopy carries the Arabic through", () => {
  const key = FORM_DEFS[0]!.key;

  it("keeps a stored twin that the registry has no default for", () => {
    // The bug: the old loop iterated the registry defaults, which carry only
    // the seven English keys, so a stored `title_ar` was discarded on read.
    const resolved = resolveForm(key, { enabled: true, copy: { submit_label_ar: "إرسال" } } as never, null);
    expect((resolved!.copy as Record<string, unknown>).submit_label_ar).toBe("إرسال");
  });

  it("still falls back to the registry English", () => {
    const resolved = resolveForm(key, { enabled: true, copy: {} } as never, null);
    expect(resolved!.copy.submit_label).toBe(FORM_DEFS[0]!.copy.submit_label);
  });

  it("folds to Arabic on /ar and English on /en", () => {
    const resolved = resolveForm(
      key,
      { enabled: true, copy: { submit_label: "Send", submit_label_ar: "إرسال" } } as never,
      null,
    );
    expect(localiseRow(resolved!.copy as Record<string, unknown>, "ar").submit_label).toBe("إرسال");
    expect(localiseRow(resolved!.copy as Record<string, unknown>, "en").submit_label).toBe("Send");
  });

  it("falls back to English where the Arabic is blank", () => {
    const resolved = resolveForm(
      key,
      { enabled: true, copy: { submit_label: "Send", submit_label_ar: "" } } as never,
      null,
    );
    expect(localiseRow(resolved!.copy as Record<string, unknown>, "ar").submit_label).toBe("Send");
  });
});

describe("the save payload cannot forget a key", () => {
  /**
   * `_actions.ts` REPLACES the stored copy bag rather than merging into it, so
   * a key missing from its payload is destroyed on every save.
   * `docs/I18N.md:139` names that as the trap. This asserts the payload is
   * derived rather than hand-listed, which is what makes it impossible.
   */
  it("builds the payload from FORM_COPY_KEYS", () => {
    const src = readFileSync(
      join(REPO_ROOT, "app/[locale]/(admin)/admin/forms/_actions.ts"),
      "utf8",
    );
    expect(src).toContain("FORM_COPY_KEYS");
    expect(src).toContain("copyArKey");
    // No hand-written list of the seven names beside `copyPayload`.
    const payload = src.slice(src.indexOf("const copyPayload"), src.indexOf("const row = {"));
    for (const { key } of FORM_COPY_KEYS) {
      expect(payload, `${key} is hand-listed in the payload`).not.toContain(`${key}:`);
    }
  });
});

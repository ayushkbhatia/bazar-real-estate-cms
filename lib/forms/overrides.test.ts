import { describe, expect, it } from "vitest";
import { defaultForm, resolveForm, type StoredField } from "./resolve";
import { getFormDef } from "./registry";
import { formOverrides, pinToRegistry } from "./overrides";
import { localiseResolved } from "@/lib/queries/forms";
import type { ResolvedForm } from "./types";

const KEY = "services_sell_list_property";

/** The stored rows an editor's first save writes: the registry, as-is. */
function storedFrom(form: ResolvedForm): StoredField[] {
  return form.fields.map((field, index) => ({
    ...field,
    position: (index + 1) * 10,
  }));
}

function resolvedWith(
  edit: (rows: StoredField[]) => StoredField[],
): ResolvedForm {
  const rows = edit(storedFrom(defaultForm(KEY)!));
  return resolveForm(
    KEY,
    { key: KEY, enabled: true, copy: {}, notify_emails: [] },
    rows,
  )!;
}

const base = () => defaultForm(KEY)!;

describe("what an editor changed", () => {
  it("finds nothing on a form nobody has touched", () => {
    // The whole contract: an untouched form hands the component nothing, so it
    // keeps every translated string it already had.
    expect(formOverrides(base(), base())).toEqual({});
  });

  it("finds nothing when the editor saved without editing", () => {
    // Opening a form and pressing Save writes the registry back verbatim. That
    // must not read as fourteen overrides — it would swap the whole page onto
    // the registry's English on the next load.
    expect(formOverrides(resolvedWith((rows) => rows), base())).toEqual({});
  });

  it("reports a relabelled question, and only that", () => {
    const resolved = resolvedWith((rows) =>
      rows.map((r) =>
        r.key === "intent" ? { ...r, label: "What brings you here?" } : r,
      ),
    );

    expect(formOverrides(resolved, base())).toEqual({
      intent: { label: "What brings you here?" },
    });
  });

  it("reports a renamed answer under the value the server accepts", () => {
    const resolved = resolvedWith((rows) =>
      rows.map((r) =>
        r.key === "property_type"
          ? {
              ...r,
              options: (r.options ?? []).map((o) =>
                o.value === "Apartment" ? { ...o, label: "Flat" } : o,
              ),
            }
          : r,
      ),
    );

    expect(formOverrides(resolved, base())).toEqual({
      property_type: { options: { Apartment: "Flat" } },
    });
  });

  it("ignores an option the registry doesn't declare", () => {
    // A `labels` save is pinned to the registry's shape, so this can only come
    // from a row written before a field was retired. The component has no pill
    // for it and the server would reject the answer.
    const resolved = resolvedWith((rows) =>
      rows.map((r) =>
        r.key === "furnishing"
          ? {
              ...r,
              options: [
                ...(r.options ?? []),
                { label: "Part-furnished", value: "part_furnished" },
              ],
            }
          : r,
      ),
    );

    expect(formOverrides(resolved, base())).toEqual({});
  });

  it("treats a cleared label as no change, not as an empty label", () => {
    // The component's own default is a real string. "The editor emptied the
    // box" cannot mean "render an unlabelled control".
    const resolved = resolvedWith((rows) =>
      rows.map((r) => (r.key === "intent" ? { ...r, label: "   " } : r)),
    );

    expect(formOverrides(resolved, base())).toEqual({});
  });

  it("carries a placeholder and a unit as well as a label", () => {
    const resolved = resolvedWith((rows) =>
      rows.map((r) =>
        r.key === "area_sqft"
          ? { ...r, placeholder: "e.g. 1,450", unit: "sq ft" }
          : r,
      ),
    );

    expect(formOverrides(resolved, base())).toEqual({
      area_sqft: { placeholder: "e.g. 1,450", unit: "sq ft" },
    });
  });

  /**
   * The reason both sides are folded before comparing.
   *
   * `getForm` folds `label_ar` into `label` on /ar. Diffing an Arabic resolved
   * label against the bare English registry would mark every field overridden
   * and hand the component generated Arabic for a form nobody has edited.
   */
  describe("on /ar", () => {
    const arabic = (form: ResolvedForm) => localiseResolved(form, "ar");

    it("finds nothing on an untouched form, in either language", () => {
      expect(formOverrides(arabic(base()), arabic(base()))).toEqual({});
    });

    it("reports the editor's Arabic when they wrote some", () => {
      const resolved = resolvedWith((rows) =>
        rows.map((r) =>
          r.key === "intent" ? { ...r, label_ar: "ما الذي تريد فعله؟" } : r,
        ),
      );

      expect(formOverrides(arabic(resolved), arabic(base()))).toEqual({
        intent: { label: "ما الذي تريد فعله؟" },
      });
      // …and the English page is untouched by an Arabic-only edit.
      expect(formOverrides(resolved, base())).toEqual({});
    });
  });
});

describe("the sell wizard's keys", () => {
  it("names a field for every question the component asks", () => {
    // The component looks these up by key. A rename in the registry that the
    // component doesn't follow is a label that silently stops being editable —
    // the failure this whole tier exists to end.
    const keys = getFormDef(KEY)!.fields.map((f) => f.key);
    expect(keys).toEqual([
      "intent",
      "location",
      "category",
      "property_type",
      "bedrooms",
      "area_sqft",
      "furnishing",
      "urgency",
      "urgency_rent_out",
      "name",
      "mobile",
      "email",
      "call_window",
      "consent",
    ]);
  });
});

/**
 * The write side of the same idea.
 *
 * The editor's screen offers wording and nothing else on a `labels` form, so
 * anything structural in the payload is a stale tab or a hand-rolled request.
 * The save doesn't reject it — it takes the wording and ignores the rest, which
 * is the same posture `copyFromPage` takes on a form's CTA.
 */
describe("pinning a labels save to the registry", () => {
  const def = getFormDef(KEY)!;
  const asSent = () =>
    defaultForm(KEY)!.fields.map((f) => ({
      ...f,
      label_ar: f.label_ar ?? null,
      placeholder_ar: f.placeholder_ar ?? null,
      help_ar: f.help_ar ?? null,
      unit_ar: f.unit_ar ?? null,
      options: f.options ?? [],
    })) as Parameters<typeof pinToRegistry>[1];

  it("keeps the wording an editor typed", () => {
    const sent = asSent().map((f) =>
      f.key === "intent" ? { ...f, label: "What brings you here?" } : f,
    );

    const pinned = pinToRegistry(def, sent);
    expect(pinned.find((f) => f.key === "intent")!.label).toBe(
      "What brings you here?",
    );
  });

  it("puts a reordered list back in the registry's order", () => {
    const pinned = pinToRegistry(def, asSent().slice().reverse());
    expect(pinned.map((f) => f.key)).toEqual(def.fields.map((f) => f.key));
  });

  it("restores a field the payload dropped", () => {
    const pinned = pinToRegistry(
      def,
      asSent().filter((f) => f.key !== "bedrooms"),
    );
    // Its wording is the registry's, because the request carried none.
    expect(pinned.find((f) => f.key === "bedrooms")!.label).toBe("Bedrooms");
    expect(pinned).toHaveLength(def.fields.length);
  });

  it("refuses a retype, a re-map and a widened option list", () => {
    const sent = asSent().map((f) =>
      f.key === "furnishing"
        ? {
            ...f,
            type: "text" as const,
            mapping: "message" as const,
            required: true,
            options: [
              ...(f.options ?? []),
              { label: "Part-furnished", label_ar: null, value: "part", intent: null },
            ],
          }
        : f,
    );

    const pinned = pinToRegistry(def, sent);
    const furnishing = pinned.find((f) => f.key === "furnishing")!;
    expect(furnishing.type).toBe("select");
    expect(furnishing.mapping).toBe("custom");
    expect(furnishing.required).toBe(false);
    expect(furnishing.options!.map((o) => o.value)).toEqual([
      "unfurnished",
      "semi_furnished",
      "fully_furnished",
    ]);
  });

  it("renames an answer without moving the value under it", () => {
    const sent = asSent().map((f) =>
      f.key === "property_type"
        ? {
            ...f,
            options: (f.options ?? []).map((o) =>
              o.value === "Villa" ? { ...o, label: "Detached home" } : o,
            ),
          }
        : f,
    );

    const villa = pinToRegistry(def, sent)
      .find((f) => f.key === "property_type")!
      .options!.find((o) => o.label === "Detached home")!;
    expect(villa.value).toBe("Villa");
  });

  it("drops a label edit that arrives under a rewritten value", () => {
    // Options are matched by value, because the value is the wire format and
    // the label is what moves. A payload that rewrites both has no anchor, and
    // guessing by position would attach "Detached home" to whichever answer
    // happened to sit there — a mislabelled pill is worse than an unrenamed
    // one. The editor's own screen can't produce this: the value input is off
    // on a `labels` form.
    const sent = asSent().map((f) =>
      f.key === "property_type"
        ? {
            ...f,
            options: (f.options ?? []).map((o) =>
              o.value === "Villa"
                ? { ...o, label: "Detached home", value: "detached" }
                : o,
            ),
          }
        : f,
    );

    const options = pinToRegistry(def, sent).find(
      (f) => f.key === "property_type",
    )!.options!;
    expect(options.map((o) => o.value)).toContain("Villa");
    expect(options.map((o) => o.value)).not.toContain("detached");
    expect(options.find((o) => o.value === "Villa")!.label).toBe("Villa");
  });

  it("leaves a Pages & blocks string to Pages & blocks", () => {
    const sent = asSent().map((f) =>
      f.key === "consent" ? { ...f, label: "Tick to agree" } : f,
    );

    expect(pinToRegistry(def, sent).find((f) => f.key === "consent")!.label).toBe(
      "Consent to be contacted",
    );
  });
});

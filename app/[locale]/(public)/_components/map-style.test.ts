import { describe, expect, it } from "vitest";
import { localiseLabels } from "./map-style";

/**
 * The style MapLibre is handed must be valid, and "valid" is stricter than it
 * looks.
 *
 * This exists because of a bug that typechecked, linted and built cleanly, and
 * still produced a blank map on every Arabic page. The first version of
 * `localiseLabels` wrapped whatever `text-field` already held as the fallback
 * arm of a `coalesce`:
 *
 *     ["coalesce", ["get", "name:ar"], field]
 *
 * That reads as the conservative choice — keep whatever the style had — and it
 * is the opposite. CARTO Positron's text-fields are *legacy* forms: token
 * strings like "{name_en}" and stop objects like { stops: [...] }. Neither is
 * legal inside an expression, so MapLibre rejected the whole style with
 *
 *     layers[69].layout.text-field[2]: Bare objects invalid.
 *
 * A rejected style means the source never resolves, which means zero tile
 * requests, which means a blank rectangle. Nothing in the build said a word;
 * only the browser console did.
 *
 * The fixtures below are the two legacy shapes that actually appear in that
 * style, so a future edit that reintroduces embedding fails here rather than
 * in production.
 */

/** Does this value contain a bare object anywhere inside an expression? */
function hasBareObject(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasBareObject);
  return typeof value === "object" && value !== null;
}

function styleWith(textField: unknown) {
  return {
    layers: [
      { id: "place-label", layout: { "text-field": textField } },
      { id: "no-labels-here", layout: {} },
      { id: "no-layout-at-all" },
    ],
  };
}

describe("localiseLabels", () => {
  it("leaves a non-Arabic locale completely alone", () => {
    const style = styleWith("{name_en}");
    const out = localiseLabels(style, "en");
    expect(out.layers[0].layout["text-field"]).toBe("{name_en}");
  });

  it("replaces a legacy token string with a pure expression", () => {
    const out = localiseLabels(styleWith("{name_en}"), "ar");
    expect(out.layers[0].layout["text-field"]).toEqual([
      "coalesce",
      ["get", "name:ar"],
      ["get", "name_en"],
      ["get", "name"],
    ]);
  });

  it("replaces a legacy stop object rather than embedding it", () => {
    // This is the exact shape that produced "Bare objects invalid".
    const legacyStops = { stops: [[6, "{name_en}"], [12, "{name}"]] };
    const out = localiseLabels(styleWith(legacyStops), "ar");
    const field = out.layers[0].layout["text-field"];
    expect(
      hasBareObject(field),
      "a bare object inside text-field makes MapLibre reject the entire style, " +
        "so the map requests no tiles and renders blank",
    ).toBe(false);
  });

  it("never emits a bare object for any legacy input", () => {
    for (const legacy of [
      "{name_en}",
      "{name}",
      { stops: [[6, "{name_en}"]] },
      ["concat", ["get", "name"], " "],
    ]) {
      const field = localiseLabels(styleWith(legacy), "ar").layers[0].layout[
        "text-field"
      ];
      expect(hasBareObject(field), `bare object from ${JSON.stringify(legacy)}`).toBe(
        false,
      );
    }
  });

  it("skips layers with no text-field instead of inventing one", () => {
    const out = localiseLabels(styleWith("{name_en}"), "ar");
    expect(out.layers[1].layout["text-field"]).toBeUndefined();
    expect(out.layers[2].layout).toBeUndefined();
  });

  it("falls back through Arabic, then English, then the default name", () => {
    // The order is the point: most features outside the Gulf have no
    // `name:ar`, and dropping to a blank label would be worse than English.
    const field = localiseLabels(styleWith("{name_en}"), "ar").layers[0].layout[
      "text-field"
    ] as unknown[];
    expect(field.slice(1)).toEqual([
      ["get", "name:ar"],
      ["get", "name_en"],
      ["get", "name"],
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  CARD_LABEL_DEFAULTS,
  cardLabelId,
  labelText,
  labelsFor,
  resolveCardLabels,
  type CardLabel,
} from "./card-labels";
import { parseCardLabels } from "@/lib/schemas/card-labels";

const label = (
  over: Partial<CardLabel> & Pick<CardLabel, "id">,
): CardLabel => ({
  text: over.id,
  text_ar: "",
  kind: "ink",
  enabled: true,
  ...over,
});

describe("the shipped vocabulary", () => {
  /**
   * The migration changes nothing on apply, and this is the assertion behind
   * that claim: the two built-ins carry the exact words and colours
   * `listingBadge` returned, so a site whose client never opens the new screen
   * renders what it rendered before.
   */
  it("reproduces what listingBadge used to return", () => {
    const [exclusive, vacant] = CARD_LABEL_DEFAULTS;
    expect(exclusive).toMatchObject({
      id: "exclusive",
      text: "Exclusive",
      text_ar: "حصري",
      kind: "ink",
    });
    expect(vacant).toMatchObject({
      id: "vacant_on_transfer",
      text: "Vacant on transfer",
      text_ar: "شاغر عند نقل الملكية",
      kind: "accent",
    });
  });

  it("says something different in Arabic", () => {
    for (const l of CARD_LABEL_DEFAULTS) expect(l.text_ar).not.toBe(l.text);
  });
});

describe("resolveCardLabels", () => {
  it("returns the built-ins for an empty bag", () => {
    expect(resolveCardLabels(null).map((l) => l.id)).toEqual([
      "exclusive",
      "vacant_on_transfer",
    ]);
  });

  it("keeps the client's order and their renames", () => {
    const out = resolveCardLabels({
      labels: [
        label({ id: "new_launch", text: "New launch", kind: "success" }),
        label({ id: "exclusive", text: "Sole agency", kind: "ink" }),
        label({ id: "vacant_on_transfer", text: "Vacant", kind: "accent" }),
      ],
    });
    expect(out.map((l) => l.id)).toEqual([
      "new_launch",
      "exclusive",
      "vacant_on_transfer",
    ]);
    expect(out[1]!.text).toBe("Sole agency");
  });

  /**
   * The one that stops a support ticket nobody could diagnose: a bag written
   * before a built-in existed, or saved with one deleted, would otherwise
   * strand every property carrying that flag with no badge and no row to look
   * at.
   */
  it("restores a built-in that is missing from the bag", () => {
    const out = resolveCardLabels({ labels: [label({ id: "new_launch" })] });
    expect(out.map((l) => l.id)).toContain("exclusive");
    expect(out.map((l) => l.id)).toContain("vacant_on_transfer");
  });

  it("marks built-ins so the form can refuse to delete them", () => {
    const out = resolveCardLabels(null);
    expect(out.every((l) => l.builtIn)).toBe(true);
    expect(
      resolveCardLabels({ labels: [label({ id: "new_launch" })] })[0]!.builtIn,
    ).toBeUndefined();
  });

  it("survives a malformed bag rather than rendering nothing", () => {
    expect(resolveCardLabels(parseCardLabels("nonsense")).length).toBe(2);
    expect(resolveCardLabels(parseCardLabels({ labels: 42 })).length).toBe(2);
    expect(
      resolveCardLabels(parseCardLabels({ labels: [{ id: "no_kind" }] }))
        .length,
    ).toBe(2);
  });

  it("refuses two labels sharing an id", () => {
    const twice = {
      labels: [label({ id: "dup" }), label({ id: "dup", text: "Other" })],
    };
    expect(parseCardLabels(twice).labels ?? []).toHaveLength(0);
  });
});

describe("labelsFor", () => {
  const vocab = resolveCardLabels({
    labels: [
      label({ id: "exclusive", text: "Exclusive" }),
      label({ id: "new_launch", text: "New launch", text_ar: "إطلاق جديد" }),
      label({ id: "vacant_on_transfer", text: "Vacant on transfer" }),
      label({ id: "off_market", text: "Off market", enabled: false }),
    ],
  });

  it("reads the new assignment list", () => {
    expect(
      labelsFor({ labels: ["new_launch"] }, vocab).map((l) => l.label),
    ).toEqual(["New launch"]);
  });

  /**
   * The back-compatibility surface. Every property in production carries its
   * badge as a boolean and nobody has re-tagged any of them, so this is what
   * makes the change invisible on the day it ships.
   */
  it("still reads the two legacy booleans", () => {
    expect(labelsFor({ exclusive: true }, vocab).map((l) => l.id)).toEqual([
      "exclusive",
    ]);
    expect(
      labelsFor({ vacant_on_transfer: true }, vocab).map((l) => l.id),
    ).toEqual(["vacant_on_transfer"]);
  });

  /** The reason the feature was asked for: one badge was never enough. */
  it("returns both when a listing is exclusive AND vacant on transfer", () => {
    expect(
      labelsFor({ exclusive: true, vacant_on_transfer: true }, vocab).map(
        (l) => l.id,
      ),
    ).toEqual(["exclusive", "vacant_on_transfer"]);
  });

  it("does not double-count a flag that is also in the list", () => {
    expect(
      labelsFor({ labels: ["exclusive"], exclusive: true }, vocab),
    ).toHaveLength(1);
  });

  it("orders by the vocabulary, not by the assignment", () => {
    expect(
      labelsFor({ labels: ["vacant_on_transfer", "new_launch"] }, vocab).map(
        (l) => l.id,
      ),
    ).toEqual(["new_launch", "vacant_on_transfer"]);
  });

  it("respects the card's room and the client's priority", () => {
    const three = { labels: ["exclusive", "new_launch", "vacant_on_transfer"] };
    expect(labelsFor(three, vocab).map((l) => l.id)).toEqual([
      "exclusive",
      "new_launch",
    ]);
    expect(labelsFor(three, vocab, "en", 3)).toHaveLength(3);
  });

  it("draws nothing for a disabled label or an id that no longer exists", () => {
    expect(labelsFor({ labels: ["off_market"] }, vocab)).toEqual([]);
    expect(labelsFor({ labels: ["deleted_last_week"] }, vocab)).toEqual([]);
  });

  it("folds to the locale, falling back to the English", () => {
    expect(labelsFor({ labels: ["new_launch"] }, vocab, "ar")[0]!.label).toBe(
      "إطلاق جديد",
    );
    // No Arabic on this one — the English stands rather than a blank chip.
    expect(labelsFor({ labels: ["exclusive"] }, vocab, "ar")[0]!.label).toBe(
      "Exclusive",
    );
  });

  it("is total on missing input", () => {
    expect(labelsFor(null, vocab)).toEqual([]);
    expect(labelsFor(undefined, vocab)).toEqual([]);
    expect(labelsFor({ labels: "not-an-array" }, vocab)).toEqual([]);
    expect(labelsFor({ labels: [1, 2] }, vocab)).toEqual([]);
  });
});

describe("labelText", () => {
  it("treats whitespace-only Arabic as absent", () => {
    expect(labelText(label({ id: "x", text: "X", text_ar: "   " }), "ar")).toBe(
      "X",
    );
  });
});

describe("cardLabelId", () => {
  it("slugs the English and counts up on a collision", () => {
    expect(cardLabelId("New launch", [])).toBe("new_launch");
    expect(cardLabelId("New launch", ["new_launch"])).toBe("new_launch_2");
    expect(cardLabelId("New launch", ["new_launch", "new_launch_2"])).toBe(
      "new_launch_3",
    );
  });

  /** Arabic-only text slugs to nothing, and an empty id is unaddressable. */
  it("falls back to a positional id when there is no ASCII to slug", () => {
    expect(cardLabelId("إطلاق جديد", ["a"])).toBe("label_2");
  });

  it("always produces something the schema accepts", () => {
    for (const text of ["New launch", "  ??? ", "إطلاق", "A–B", "50% off"])
      expect(cardLabelId(text, [])).toMatch(/^[a-z0-9_]+$/);
  });
});

import { describe, expect, it } from "vitest";
import { countMissingBlocks, mirrorBlocks } from "./mirror";

const A = "0d4c6b8e-5a1f-4e2b-9c3d-7f8e9a0b1c2d";
const B = "33333333-0000-0000-0000-000000000008";
const C = "44444444-0000-0000-0000-000000000001";

const block = (kind: string, id: string, variant = "card") =>
  `<div data-internal-link="${kind}" data-id="${id}" data-variant="${variant}"></div>`;

const EN =
  `<p>One.</p>${block("area", A)}<h2>Two</h2><p>Three.</p>` +
  `${block("development", B)}${block("property", C, "compact")}<p>Four.</p>`;
const AR = "<p>واحد.</p><h2>اثنان</h2><p>ثلاثة.</p><p>أربعة.</p>";

describe("mirrorBlocks", () => {
  it("places each block after the same paragraph it follows in the English", () => {
    const { html, added } = mirrorBlocks(EN, AR);
    expect(added).toBe(3);
    expect(html).toBe(
      `<p>واحد.</p>${block("area", A)}<h2>اثنان</h2><p>ثلاثة.</p>` +
        `${block("development", B)}${block("property", C, "compact")}<p>أربعة.</p>`,
    );
  });

  it("is a no-op the second time", () => {
    const once = mirrorBlocks(EN, AR).html;
    expect(mirrorBlocks(EN, once)).toEqual({ html: once, added: 0 });
    expect(countMissingBlocks(EN, once)).toBe(0);
  });

  it("never moves or duplicates a block the Arabic already has", () => {
    // The editor put the area card at the end of the Arabic on purpose.
    const ar = `${AR}${block("area", A, "compact")}`;
    const { html, added } = mirrorBlocks(EN, ar);
    expect(added).toBe(2);
    expect(html.match(/data-id="0d4c6b8e/g)).toHaveLength(1);
    expect(html.endsWith(`${block("area", A, "compact")}`)).toBe(true);
  });

  it("keeps blocks that sat together in the English together, in order", () => {
    const { html } = mirrorBlocks(EN, AR);
    expect(html).toContain(
      `${block("development", B)}${block("property", C, "compact")}`,
    );
  });

  it("puts a block that opens the English at the top of the Arabic", () => {
    const en = `${block("area", A)}<p>One.</p>`;
    expect(mirrorBlocks(en, "<p>واحد.</p>").html).toBe(
      `${block("area", A)}<p>واحد.</p>`,
    );
  });

  it("appends when the Arabic is shorter than the English", () => {
    const en = `<p>1</p><p>2</p><p>3</p>${block("area", A)}`;
    expect(mirrorBlocks(en, "<p>١</p>").html).toBe(
      `<p>١</p>${block("area", A)}`,
    );
  });

  it("links a record once, however many times the English does", () => {
    const en = `<p>1</p>${block("area", A)}<p>2</p>${block("area", A, "compact")}`;
    expect(countMissingBlocks(en, "<p>١</p><p>٢</p>")).toBe(1);
  });

  it("ignores blocks it cannot read", () => {
    const en = `<p>1</p><div data-internal-link="agent" data-id="${A}"></div>`;
    expect(countMissingBlocks(en, "<p>١</p>")).toBe(0);
  });

  it("has nothing to add from an empty English body", () => {
    expect(countMissingBlocks("", AR)).toBe(0);
  });
});

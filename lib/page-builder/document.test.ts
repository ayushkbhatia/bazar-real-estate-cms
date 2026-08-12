import { describe, expect, it } from "vitest";
import {
  parseLandingDocument,
  renderableBlocks,
  resolveDocument,
  serialiseDocument,
  unknownBlockCount,
  validateDocument,
} from "./document";
import { newBlockInstance } from "./catalogue";
import { faq } from "./blocks/content";
import type { BlockInstance } from "./types";

function block(over: Partial<BlockInstance> = {}): BlockInstance {
  return {
    id: "b1",
    type: "faq",
    v: 1,
    enabled: true,
    values: { title: "Questions", items: [] },
    ...over,
  };
}

describe("parseLandingDocument", () => {
  it("returns an empty document for anything that isn't an array", () => {
    for (const raw of [null, undefined, {}, "[]", 7]) {
      expect(parseLandingDocument(raw)).toEqual({ blocks: [], dropped: 0 });
    }
  });

  it("drops items with no type and counts them", () => {
    const doc = parseLandingDocument([
      block(),
      { id: "x", values: {} },
      null,
      "nope",
    ]);
    expect(doc.blocks).toHaveLength(1);
    expect(doc.dropped).toBe(3);
  });

  it("mints a deterministic id when one is missing", () => {
    const raw = [{ type: "faq", values: {} }];
    const a = parseLandingDocument(raw).blocks[0].id;
    const b = parseLandingDocument(raw).blocks[0].id;
    // Two reads of the same row must agree, or React remounts the subtree on
    // every render.
    expect(a).toBe(b);
    expect(a).toBe("faq-0");
  });

  it("defaults enabled to true, matching the master-page reader", () => {
    expect(parseLandingDocument([{ type: "faq" }]).blocks[0].enabled).toBe(true);
    expect(
      parseLandingDocument([{ type: "faq", enabled: false }]).blocks[0].enabled,
    ).toBe(false);
  });

  it("keeps two instances of one type distinct", () => {
    const doc = parseLandingDocument([
      block({ id: "a" }),
      block({ id: "b", values: { title: "More" } }),
    ]);
    expect(doc.blocks.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("the data-loss guard", () => {
  const unknown = block({
    id: "u1",
    type: "market_stats_strip",
    values: { title: "Q2 medians", body: "Copy that exists nowhere else." },
  });

  it("keeps an unknown block through parse and serialise", () => {
    const round = serialiseDocument(parseLandingDocument([unknown]));
    expect(round).toHaveLength(1);
    expect(round[0]).toMatchObject({
      id: "u1",
      type: "market_stats_strip",
      values: { title: "Q2 medians", body: "Copy that exists nowhere else." },
    });
  });

  it("resolves an unknown block with def null and untouched values", () => {
    const [resolved] = resolveDocument([unknown]);
    expect(resolved.def).toBeNull();
    expect(resolved.values).toEqual(unknown.values);
  });

  it("skips unknown blocks at render but still counts them", () => {
    const resolved = resolveDocument([unknown, block()]);
    expect(renderableBlocks(resolved).map((b) => b.type)).toEqual(["faq"]);
    expect(unknownBlockCount(resolved)).toBe(1);
  });

  it("round-trips an unknown block byte-identically through a save", () => {
    const result = validateDocument(
      // What a stale editor tab would send: the block reordered, with values
      // it never had a field editor for.
      [{ ...unknown, values: { title: "TAMPERED" } }],
      [unknown],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Values come from storage, never from the payload.
    expect(result.blocks[0].values).toEqual(unknown.values);
  });

  it("lets an editor hide an unknown block without editing it", () => {
    const result = validateDocument(
      [{ ...unknown, enabled: false }],
      [unknown],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks[0].enabled).toBe(false);
    expect(result.blocks[0].values).toEqual(unknown.values);
  });

  it("refuses an unknown block the database has never seen", () => {
    const result = validateDocument([unknown], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks).toHaveLength(0);
  });
});

describe("resolveDocument", () => {
  it("fills in a field added to the code after the document was written", () => {
    // A stored FAQ from before `eyebrow` existed.
    const [resolved] = resolveDocument([
      block({ values: { title: "Questions" } }),
    ]);
    expect(resolved.values.eyebrow).toBe(faq.defaults.eyebrow);
    expect(resolved.values.title).toBe("Questions");
  });

  it("runs a block's migrate hook and is idempotent", () => {
    const calls: number[] = [];
    const stored = block({ type: "faq", v: 0 });
    // Simulate a versioned def by patching the real one for this test.
    const original = { version: faq.version, migrate: faq.migrate };
    faq.version = 2;
    faq.migrate = (values, from) => {
      calls.push(from);
      return { ...values, title: "migrated" };
    };
    try {
      expect(resolveDocument([stored])[0].values.title).toBe("migrated");
      // A document already at the target version is left alone.
      expect(resolveDocument([block({ v: 2 })])[0].values.title).toBe("Questions");
      expect(calls).toEqual([0]);
    } finally {
      faq.version = original.version;
      faq.migrate = original.migrate;
    }
  });

  it("preserves order and ids across a reorder", () => {
    const a = block({ id: "a" });
    const b = block({ id: "b" });
    expect(resolveDocument([b, a]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("validateDocument", () => {
  it("reports a blank required field with the block and field named", () => {
    const result = validateDocument(
      [block({ type: "cta_band", values: { title: "" } })],
      [],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/Call to action · Heading/);
  });

  it("rejects a select value outside its closed option set", () => {
    const result = validateDocument(
      [block({ type: "cta_band", values: { title: "Go", variant: "neon" } })],
      [],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toMatch(/isn't one of the available choices/);
  });

  it("drops a duplicate id rather than writing it twice", () => {
    const result = validateDocument([block({ id: "a" }), block({ id: "a" })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks).toHaveLength(1);
  });

  it("stamps the current schema version on every saved block", () => {
    const result = validateDocument([block({ v: 0 })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks[0].v).toBe(faq.version ?? 1);
  });
});

describe("newBlockInstance", () => {
  it("clones the defaults so two instances can't share a list", () => {
    const a = newBlockInstance(faq);
    const b = newBlockInstance(faq);
    expect(a.id).not.toBe(b.id);
    (a.values.items as unknown[]).push({ q: "?", a: "!" });
    expect(b.values.items).toEqual([]);
    expect(faq.defaults.items).toEqual([]);
  });
});

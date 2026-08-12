import { describe, expect, it, vi } from "vitest";
import {
  hashSource,
  isStale,
  machineProvenance,
  modelFor,
  translateField,
  type MtClient,
} from "./translate";

/**
 * The API is never called here. Every test drives a fake client, the same
 * arrangement the concierge uses, so CI cannot spend money or fail on a
 * network blip.
 */
function fakeClient(...replies: string[]): MtClient & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  let i = 0;
  return {
    calls,
    messages: {
      create: vi.fn(async (args) => {
        calls.push([args]);
        const text = replies[Math.min(i++, replies.length - 1)];
        return { content: [{ type: "text", text }] };
      }),
    },
  } as MtClient & { calls: unknown[][] };
}

describe("translateField", () => {
  it("masks before sending and unmasks after", async () => {
    const client = fakeClient("فيلا بسعر ⟦0⟧");
    const result = await translateField({
      client,
      text: "Villa at AED 12,500,000",
      kind: "title",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The price came back intact because the model never had it.
    expect(result.text).toBe("فيلا بسعر AED 12,500,000");

    const sent = (client.messages.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as { messages: { content: string }[] };
    expect(sent.messages[0].content).toContain("⟦0⟧");
    expect(sent.messages[0].content).not.toContain("12,500,000");
  });

  it("substitutes a hand-authored toponym through overrides", async () => {
    const client = fakeClient("فيلا في ⟦0⟧");
    const result = await translateField({
      client,
      text: "Villa on BR-1042",
      kind: "title",
      overrides: { 0: "جزيرة السعديات" },
    });
    expect(result.ok && result.text).toBe("فيلا في جزيرة السعديات");
  });

  it("retries once with the specific failures named", async () => {
    // First reply drops the sentinel; second is clean.
    const client = fakeClient("فيلا للبيع", "فيلا بسعر ⟦0⟧");
    const result = await translateField({
      client,
      text: "Villa at AED 5,000,000",
      kind: "title",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.retried).toBe(true);

    const second = (client.messages.create as ReturnType<typeof vi.fn>).mock
      .calls[1][0] as { messages: { content: string }[] };
    // The retry says what was wrong rather than re-rolling the same prompt.
    expect(second.messages.at(-1)?.content).toContain("⟦0⟧ dropped");
  });

  it("gives up after the retry and returns the reasons, not an exception", async () => {
    const client = fakeClient("فيلا للبيع", "فيلا للبيع");
    const result = await translateField({
      client,
      text: "Villa at AED 5,000,000",
      kind: "title",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.code)).toContain("sentinel-missing");
    // The rejected text is unmasked so a reviewer reads real text.
    expect(result.raw).toBe("فيلا للبيع");
    expect((client.messages.create as ReturnType<typeof vi.fn>).mock.calls)
      .toHaveLength(2);
  });

  it("never writes a translation that changed a number", async () => {
    // The failure that matters most, end to end: 4 bedrooms became 5.
    const client = fakeClient("فيلا من 5 غرف نوم", "فيلا من 5 غرف نوم");
    const result = await translateField({
      client,
      text: "4 bedroom villa",
      kind: "title",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.code)).toContain("numeral-drift");
  });

  it("refuses empty input without calling the API", async () => {
    const client = fakeClient("unused");
    const result = await translateField({ client, text: "   ", kind: "title" });
    expect(result.ok).toBe(false);
    expect((client.messages.create as ReturnType<typeof vi.fn>).mock.calls)
      .toHaveLength(0);
  });

  it("retries when a caller's extra check fails, then reports it", async () => {
    // The rich-text path: a dropped <strong> marker should get the same second
    // chance a dropped price gets, without teaching validate() about HTML.
    const client = fakeClient("نص بلا علامات", "⟦m0⟧نص⟦m1⟧");
    const result = await translateField({
      client,
      text: "⟦m0⟧text⟦m1⟧",
      kind: "body",
      extraIssues: (out) =>
        out.includes("⟦m0⟧") ? [] : ["formatting marker ⟦m0⟧ dropped"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.retried).toBe(true);

    const second = (client.messages.create as ReturnType<typeof vi.fn>).mock
      .calls[1][0] as { messages: { content: string }[] };
    expect(second.messages.at(-1)?.content).toContain("⟦m0⟧ dropped");
  });

  it("reports a persistent markup failure under its own code", async () => {
    const client = fakeClient("بلا علامات", "بلا علامات");
    const result = await translateField({
      client,
      text: "⟦m0⟧text⟦m1⟧",
      kind: "body",
      extraIssues: () => ["formatting marker ⟦m0⟧ dropped"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.code)).toContain("markup");
  });

  it("sends alt text to the cheap model and prose to the expensive one", async () => {
    expect(modelFor("alt")).toContain("haiku");
    expect(modelFor("body")).toBe("claude-opus-5");
    expect(modelFor("title")).toBe("claude-opus-5");
  });
});

describe("provenance", () => {
  it("detects that the English changed under a translation", () => {
    const prov = machineProvenance("Sea view villa", "claude-opus-5", "2026-08-13T00:00:00Z");
    expect(isStale("Sea view villa", prov)).toBe(false);
    // An editor fixed a typo. The Arabic is now describing the old text.
    expect(isStale("Sea-view villa", prov)).toBe(true);
  });

  it("ignores surrounding whitespace, which is not a content change", () => {
    expect(hashSource("Villa ")).toBe(hashSource("Villa"));
  });

  it("treats a field with no provenance as not stale", () => {
    // Hand-authored Arabic with no recorded source has nothing to be stale
    // against, and flagging it would train editors to ignore the badge.
    expect(isStale("anything", undefined)).toBe(false);
  });
});

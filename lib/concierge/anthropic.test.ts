import { describe, it, expect } from "vitest";
import {
  runConciergeLoop,
  CONCIERGE_MODEL,
  MAX_INPUT_TOKENS_PER_SESSION,
  type LoopUpdate,
} from "./anthropic";

// A minimal fake of the Anthropic client. We only need `.messages.create`.
type FakeResponse = {
  stop_reason: string;
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >;
  usage?: { input_tokens: number; output_tokens: number };
};

function fakeClient(responses: FakeResponse[]) {
  let i = 0;
  const calls: unknown[] = [];
  const client = {
    messages: {
      create: async (req: unknown) => {
        calls.push(req);
        const next = responses[i++];
        if (!next) throw new Error("Fake client ran out of responses.");
        return next as unknown as never;
      },
    },
  };
  return { client, calls };
}

async function collect(gen: AsyncGenerator<LoopUpdate>): Promise<LoopUpdate[]> {
  const out: LoopUpdate[] = [];
  for await (const u of gen) out.push(u);
  return out;
}

describe("runConciergeLoop", () => {
  it("yields the assistant text then 'done' when the model returns end_turn", async () => {
    const { client, calls } = fakeClient([
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Hello, brief noted." }],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    ]);
    const updates = await collect(
      runConciergeLoop({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        messages: [{ role: "user", content: "I want a 4-bed villa" }],
        brief: { chips: [] },
        pinnedIds: [],
        anonymous: false,
        totalInputTokensSoFar: 0,
      }),
    );
    const kinds = updates.map((u) => u.kind);
    expect(kinds).toContain("tokens");
    expect(kinds).toContain("text");
    expect(kinds[kinds.length - 1]).toBe("done");
    const done = updates[updates.length - 1] as Extract<LoopUpdate, { kind: "done" }>;
    expect(done.reason).toBe("end_turn");

    // The model was called with our system prompt + tools.
    expect(calls).toHaveLength(1);
    const req = calls[0] as { model: string; tools: unknown[] };
    expect(req.model).toBe(CONCIERGE_MODEL);
    expect(req.tools.length).toBeGreaterThanOrEqual(5);
  });

  it("hides hand_off_to_advisor from anonymous sessions", async () => {
    const { client, calls } = fakeClient([
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "hi" }],
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    ]);
    await collect(
      runConciergeLoop({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        messages: [{ role: "user", content: "hello" }],
        brief: { chips: [] },
        pinnedIds: [],
        anonymous: true,
        totalInputTokensSoFar: 0,
      }),
    );
    const req = calls[0] as { tools: { name: string }[] };
    const toolNames = req.tools.map((t) => t.name);
    expect(toolNames).not.toContain("hand_off_to_advisor");
  });

  it("runs a tool, feeds the result back, then ends", async () => {
    const { client } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "pin_properties",
            input: { property_ids: ["a", "b", "c"] },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 20 },
      },
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Pinned three." }],
        usage: { input_tokens: 50, output_tokens: 30 },
      },
    ]);
    const updates = await collect(
      runConciergeLoop({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        messages: [{ role: "user", content: "Pin those" }],
        brief: { chips: [] },
        pinnedIds: [],
        anonymous: false,
        totalInputTokensSoFar: 0,
      }),
    );

    const kinds = updates.map((u) => u.kind);
    expect(kinds).toContain("tool_use");
    expect(kinds).toContain("tool_result");
    expect(kinds).toContain("state_patch");
    const statePatch = updates.find((u) => u.kind === "state_patch") as Extract<
      LoopUpdate,
      { kind: "state_patch" }
    >;
    expect(statePatch.patch.pinned_property_ids).toEqual(["a", "b", "c"]);

    const done = updates[updates.length - 1] as Extract<LoopUpdate, { kind: "done" }>;
    expect(done.kind).toBe("done");
    expect(done.reason).toBe("end_turn");
  });

  it("returns an error 'done' when the model picks an unknown tool", async () => {
    const { client } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "x",
            name: "nonexistent_tool",
            input: {},
          },
        ],
        usage: { input_tokens: 50, output_tokens: 10 },
      },
    ]);
    const updates = await collect(
      runConciergeLoop({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        messages: [{ role: "user", content: "Try it" }],
        brief: { chips: [] },
        pinnedIds: [],
        anonymous: false,
        totalInputTokensSoFar: 0,
      }),
    );
    const done = updates[updates.length - 1] as Extract<LoopUpdate, { kind: "done" }>;
    expect(done.kind).toBe("done");
    expect(done.reason).toBe("error");
    expect(done.error).toMatch(/Unknown tool/);
  });

  it("aborts when the token budget is already exhausted", async () => {
    const { client, calls } = fakeClient([
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "should not be reached" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);
    const updates = await collect(
      runConciergeLoop({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        messages: [{ role: "user", content: "anything" }],
        brief: { chips: [] },
        pinnedIds: [],
        anonymous: false,
        totalInputTokensSoFar: MAX_INPUT_TOKENS_PER_SESSION + 1,
      }),
    );
    expect(calls).toHaveLength(0);
    const done = updates[updates.length - 1] as Extract<LoopUpdate, { kind: "done" }>;
    expect(done.reason).toBe("error");
    expect(done.error).toMatch(/budget/);
  });

  it("surfaces an Anthropic call failure as 'done' with error", async () => {
    const client = {
      messages: {
        create: async () => {
          throw new Error("rate limited");
        },
      },
    };
    const updates = await collect(
      runConciergeLoop({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        messages: [{ role: "user", content: "hi" }],
        brief: { chips: [] },
        pinnedIds: [],
        anonymous: false,
        totalInputTokensSoFar: 0,
      }),
    );
    const done = updates[updates.length - 1] as Extract<LoopUpdate, { kind: "done" }>;
    expect(done.reason).toBe("error");
    expect(done.error).toContain("rate limited");
  });
});

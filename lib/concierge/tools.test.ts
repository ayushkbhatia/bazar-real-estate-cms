import { describe, it, expect } from "vitest";
import {
  CONCIERGE_TOOLS,
  TOOL_HANDLERS,
  toolsForSession,
  type ToolName,
} from "./tools";

const ALL_TOOL_NAMES = new Set<ToolName>([
  "search_properties",
  "semantic_search",
  "get_market_stats",
  "score_against_brief",
  "pin_properties",
  "hand_off_to_advisor",
]);

describe("CONCIERGE_TOOLS shape", () => {
  it("exposes the expected six tools", () => {
    expect(CONCIERGE_TOOLS).toHaveLength(6);
    const names = new Set(CONCIERGE_TOOLS.map((t) => t.name));
    expect(names).toEqual(ALL_TOOL_NAMES);
  });

  it("every tool has a non-empty description + an object input_schema", () => {
    for (const t of CONCIERGE_TOOLS) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.input_schema).toMatchObject({ type: "object" });
    }
  });

  it("score_against_brief requires property_ids", () => {
    const tool = CONCIERGE_TOOLS.find((t) => t.name === "score_against_brief");
    expect(tool).toBeDefined();
    expect((tool!.input_schema as { required: string[] }).required).toContain(
      "property_ids",
    );
  });

  it("pin_properties requires property_ids", () => {
    const tool = CONCIERGE_TOOLS.find((t) => t.name === "pin_properties");
    expect(
      (tool!.input_schema as { required: string[] }).required,
    ).toContain("property_ids");
  });

  it("semantic_search requires a query", () => {
    const tool = CONCIERGE_TOOLS.find((t) => t.name === "semantic_search");
    expect((tool!.input_schema as { required: string[] }).required).toContain(
      "query",
    );
  });

  it("get_market_stats requires an area_slug", () => {
    const tool = CONCIERGE_TOOLS.find((t) => t.name === "get_market_stats");
    expect((tool!.input_schema as { required: string[] }).required).toContain(
      "area_slug",
    );
  });
});

describe("TOOL_HANDLERS coverage", () => {
  it("every tool name maps to a handler", () => {
    for (const t of CONCIERGE_TOOLS) {
      expect(typeof TOOL_HANDLERS[t.name]).toBe("function");
    }
  });
});

describe("toolsForSession", () => {
  it("authenticated sessions can hand off to an advisor", () => {
    const tools = toolsForSession({ anonymous: false });
    expect(tools.map((t) => t.name)).toContain("hand_off_to_advisor");
  });

  it("anonymous sessions cannot hand off", () => {
    const tools = toolsForSession({ anonymous: true });
    expect(tools.map((t) => t.name)).not.toContain("hand_off_to_advisor");
    expect(tools).toHaveLength(5);
  });
});

describe("pin_properties handler", () => {
  it("returns a state patch with the requested ids (capped at 8)", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`);
    const result = await TOOL_HANDLERS.pin_properties(
      { property_ids: ids },
      { brief: { chips: [] }, pinnedIds: [] },
    );
    expect(result.state?.pinned_property_ids).toHaveLength(8);
    expect(result.state?.pinned_property_ids).toEqual(ids.slice(0, 8));
  });

  it("returns an empty state when no ids are passed", async () => {
    const result = await TOOL_HANDLERS.pin_properties(
      {},
      { brief: { chips: [] }, pinnedIds: [] },
    );
    expect(result.state?.pinned_property_ids).toEqual([]);
  });
});

describe("hand_off_to_advisor handler", () => {
  it("returns a confirmation message + state patch", async () => {
    const result = await TOOL_HANDLERS.hand_off_to_advisor(
      { message: "I want a viewing this Saturday." },
      { brief: { chips: [] }, pinnedIds: [] },
    );
    expect(result.state?.hand_off).toBeDefined();
    expect((result.output as { handed_off: boolean }).handed_off).toBe(true);
  });
});

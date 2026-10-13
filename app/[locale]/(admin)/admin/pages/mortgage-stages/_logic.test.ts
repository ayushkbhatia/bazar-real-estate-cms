import { describe, expect, it } from "vitest";
import { cleanStageName, moveStage, stageRefusal } from "./_logic";

describe("cleanStageName", () => {
  it("trims, and takes 1 to 40 characters", () => {
    expect(cleanStageName("  Valuation ")).toBe("Valuation");
    expect(cleanStageName("x".repeat(40))).toBe("x".repeat(40));
  });

  it("refuses an empty or over-long name", () => {
    expect(cleanStageName("")).toBeNull();
    expect(cleanStageName("   ")).toBeNull();
    expect(cleanStageName("x".repeat(41))).toBeNull();
  });
});

describe("moveStage", () => {
  const ids = ["a", "b", "c"];

  it("swaps a stage with its neighbour", () => {
    expect(moveStage(ids, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveStage(ids, "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("returns every id once and leaves the input alone", () => {
    const next = moveStage(ids, "c", -1)!;
    expect([...next].sort()).toEqual(ids);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("can't move past either end, or a stage that isn't there", () => {
    expect(moveStage(ids, "a", -1)).toBeNull();
    expect(moveStage(ids, "c", 1)).toBeNull();
    expect(moveStage(ids, "z", 1)).toBeNull();
  });
});

describe("stageRefusal", () => {
  it("says how many files are on a stage that can't be deleted", () => {
    expect(stageRefusal({ code: "MR409", message: "stage_in_use:3" }).message).toBe(
      "3 files are on this stage. Move them to another stage first.",
    );
    expect(stageRefusal({ code: "MR409", message: "stage_in_use:1" }).message).toBe(
      "1 file is on this stage. Move it to another stage first.",
    );
  });

  it("keeps the last stage, and refuses a name another stage has", () => {
    expect(stageRefusal({ code: "MR409", message: "last_stage" }).message).toBe("Keep at least one stage.");
    expect(stageRefusal({ code: "MR409", message: "stage_name_taken" }).message).toBe(
      "Another stage already has that name.",
    );
  });

  it("tells a bad name from a stale order", () => {
    expect(stageRefusal({ code: "MR422", message: "a name of 1 to 40 characters is needed" }).message).toMatch(/1 to 40/);
    expect(stageRefusal({ code: "MR422", message: "every stage, once" }).message).toMatch(/Reload/);
  });

  it("marks only the unexpected as worth reporting", () => {
    expect(stageRefusal({ code: "MR403", message: "not allowed" }).known).toBe(true);
    expect(stageRefusal({ code: "MR404", message: "no such stage" }).known).toBe(true);
    expect(stageRefusal({ code: "57014", message: "timeout" })).toEqual({ message: "That didn't save. Try again.", known: false });
  });
});

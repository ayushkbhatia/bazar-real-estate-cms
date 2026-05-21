import { describe, expect, it } from "vitest";
import {
  BULK_SELECTION_CAP,
  deselectVisible,
  headerCheckboxState,
  parseSelectedParam,
  selectAllVisible,
  selectionFromIterable,
  serializeSelection,
  toggleId,
  wouldExceedCap,
} from "./selection";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

describe("parseSelectedParam", () => {
  it("returns an empty array for null / empty input", () => {
    expect(parseSelectedParam(null)).toEqual([]);
    expect(parseSelectedParam(undefined)).toEqual([]);
    expect(parseSelectedParam("")).toEqual([]);
    expect(parseSelectedParam(",,")).toEqual([]);
  });

  it("splits a comma-separated list and trims whitespace", () => {
    expect(parseSelectedParam(` ${UUID_A} , ${UUID_B} `)).toEqual([
      UUID_A,
      UUID_B,
    ]);
  });

  it("drops duplicates, preserving first-seen order", () => {
    expect(parseSelectedParam(`${UUID_A},${UUID_B},${UUID_A}`)).toEqual([
      UUID_A,
      UUID_B,
    ]);
  });

  it("rejects obvious garbage but accepts opaque ids", () => {
    // < 8 chars → garbage.
    expect(parseSelectedParam("abc")).toEqual([]);
    // illegal chars → dropped.
    expect(parseSelectedParam("not legal id,abcdefghij")).toEqual(["abcdefghij"]);
    // UUID is fine.
    expect(parseSelectedParam(UUID_A)).toEqual([UUID_A]);
  });

  it("caps at BULK_SELECTION_CAP", () => {
    const ids = Array.from({ length: BULK_SELECTION_CAP + 25 }, (_, i) =>
      String(i).padStart(12, "x"),
    );
    const out = parseSelectedParam(ids.join(","));
    expect(out).toHaveLength(BULK_SELECTION_CAP);
    expect(out[0]).toBe(ids[0]);
    expect(out[BULK_SELECTION_CAP - 1]).toBe(ids[BULK_SELECTION_CAP - 1]);
  });
});

describe("serializeSelection", () => {
  it("returns null for an empty selection so the URL param drops out", () => {
    expect(serializeSelection([])).toBeNull();
    expect(serializeSelection(new Set())).toBeNull();
  });

  it("joins with commas in iteration order", () => {
    expect(serializeSelection([UUID_A, UUID_B])).toBe(`${UUID_A},${UUID_B}`);
  });

  it("trims and dedupes before serializing", () => {
    expect(
      serializeSelection([` ${UUID_A} `, UUID_B, UUID_A, ""]),
    ).toBe(`${UUID_A},${UUID_B}`);
  });

  it("round-trips through parseSelectedParam", () => {
    const initial = [UUID_A, UUID_B, UUID_C];
    const url = serializeSelection(initial);
    expect(url).not.toBeNull();
    expect(parseSelectedParam(url!)).toEqual(initial);
  });

  it("never produces a string longer than the cap", () => {
    const ids = Array.from({ length: BULK_SELECTION_CAP + 5 }, (_, i) =>
      String(i).padStart(10, "p"),
    );
    const out = serializeSelection(ids);
    expect(out).not.toBeNull();
    expect(out!.split(",")).toHaveLength(BULK_SELECTION_CAP);
  });
});

describe("selectionFromIterable", () => {
  it("returns a Set capped at BULK_SELECTION_CAP", () => {
    const ids = Array.from({ length: BULK_SELECTION_CAP + 5 }, (_, i) =>
      String(i).padStart(10, "z"),
    );
    const set = selectionFromIterable(ids);
    expect(set.size).toBe(BULK_SELECTION_CAP);
  });

  it("normalises an empty iterable to an empty Set", () => {
    expect(selectionFromIterable([])).toEqual(new Set());
  });
});

describe("toggleId", () => {
  it("adds when missing and removes when present", () => {
    const start = new Set<string>([UUID_A]);
    const added = toggleId(start, UUID_B);
    expect(added.has(UUID_A)).toBe(true);
    expect(added.has(UUID_B)).toBe(true);
    const removed = toggleId(added, UUID_A);
    expect(removed.has(UUID_A)).toBe(false);
    expect(removed.has(UUID_B)).toBe(true);
  });

  it("does not mutate the input set", () => {
    const start = new Set<string>([UUID_A]);
    toggleId(start, UUID_B);
    expect(start.size).toBe(1);
    expect(start.has(UUID_B)).toBe(false);
  });

  it("refuses to grow past the cap", () => {
    const full = new Set(
      Array.from({ length: BULK_SELECTION_CAP }, (_, i) =>
        String(i).padStart(10, "c"),
      ),
    );
    const same = toggleId(full, UUID_A);
    expect(same.size).toBe(BULK_SELECTION_CAP);
    expect(same.has(UUID_A)).toBe(false);
  });
});

describe("selectAllVisible", () => {
  it("adds every visible id to an empty selection", () => {
    const next = selectAllVisible(new Set(), [UUID_A, UUID_B, UUID_C]);
    expect(next.size).toBe(3);
  });

  it("preserves existing selections outside the visible page", () => {
    const start = new Set<string>([UUID_A]);
    const next = selectAllVisible(start, [UUID_B, UUID_C]);
    expect(next.has(UUID_A)).toBe(true);
    expect(next.has(UUID_B)).toBe(true);
    expect(next.has(UUID_C)).toBe(true);
  });

  it("stops adding once the cap is reached", () => {
    const existing = Array.from({ length: BULK_SELECTION_CAP - 1 }, (_, i) =>
      String(i).padStart(10, "e"),
    );
    const start = new Set<string>(existing);
    const next = selectAllVisible(start, [UUID_A, UUID_B, UUID_C]);
    expect(next.size).toBe(BULK_SELECTION_CAP);
    expect(next.has(UUID_A)).toBe(true);
    expect(next.has(UUID_B)).toBe(false);
  });
});

describe("deselectVisible", () => {
  it("removes only the visible ids", () => {
    const start = new Set<string>([UUID_A, UUID_B, UUID_C]);
    const next = deselectVisible(start, [UUID_A, UUID_B]);
    expect(next.has(UUID_A)).toBe(false);
    expect(next.has(UUID_B)).toBe(false);
    expect(next.has(UUID_C)).toBe(true);
  });
});

describe("headerCheckboxState", () => {
  it("returns 'none' when no visible row is selected", () => {
    expect(
      headerCheckboxState(new Set(), [UUID_A, UUID_B]),
    ).toBe("none");
  });
  it("returns 'all' when every visible row is selected", () => {
    expect(
      headerCheckboxState(new Set([UUID_A, UUID_B]), [UUID_A, UUID_B]),
    ).toBe("all");
  });
  it("returns 'some' when partial", () => {
    expect(
      headerCheckboxState(new Set([UUID_A]), [UUID_A, UUID_B]),
    ).toBe("some");
  });
  it("returns 'none' for an empty visible list even with selections", () => {
    expect(
      headerCheckboxState(new Set([UUID_A]), []),
    ).toBe("none");
  });
});

describe("wouldExceedCap", () => {
  it("is false within budget", () => {
    expect(wouldExceedCap(new Set([UUID_A]), 5)).toBe(false);
  });
  it("is true at the boundary +1", () => {
    const start = new Set(
      Array.from({ length: BULK_SELECTION_CAP }, (_, i) =>
        String(i).padStart(10, "x"),
      ),
    );
    expect(wouldExceedCap(start, 1)).toBe(true);
  });
});

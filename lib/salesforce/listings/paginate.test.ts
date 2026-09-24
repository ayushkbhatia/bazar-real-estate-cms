import { describe, expect, it } from "vitest";
import { allRows } from "./paginate";

describe("allRows", () => {
  it("keeps reading until a page comes back short", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => i);
    const seen: [number, number][] = [];
    const got = await allRows<number>(async (from, to) => {
      seen.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    });
    expect(got).toEqual(rows);
    expect(seen).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops at an exact multiple after one empty page", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => i);
    const got = await allRows<number>(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(got).toHaveLength(1000);
  });

  it("fails loudly rather than returning half a table", async () => {
    await expect(
      allRows(async () => ({ data: null, error: { message: "canceling statement due to statement timeout" } })),
    ).rejects.toThrow("statement timeout");
  });
});

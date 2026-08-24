import { describe, expect, it } from "vitest";
import { listingBadge } from "./listing-badge";

/*
 * Worth having despite the module being nine lines, because nothing else can
 * check it: no published listing currently carries `exclusive` or
 * `vacant_on_transfer`, so every surface that draws this badge draws nothing
 * today. An e2e assertion would pass against an empty page, and that is
 * exactly the shape of the defect this replaced — five copies of the same
 * English literal, live on five routes, that no instrument reported.
 */

const AR = { exclusive: "حصري", vacantOnTransfer: "شاغر عند نقل الملكية" };

describe("listingBadge", () => {
  it("renders the words it is handed, not words of its own", () => {
    expect(listingBadge({ exclusive: true }, AR)).toEqual({
      label: "حصري",
      kind: "ink",
    });
    expect(listingBadge({ vacant_on_transfer: true }, AR)).toEqual({
      label: "شاغر عند نقل الملكية",
      kind: "accent",
    });
  });

  it("prefers exclusive when a listing carries both", () => {
    // The card has room for one. All five copies this replaced ordered them
    // this way; the consolidation must not quietly change what any of them
    // showed.
    expect(
      listingBadge({ exclusive: true, vacant_on_transfer: true }, AR),
    ).toEqual({ label: "حصري", kind: "ink" });
  });

  it("returns undefined when no flag is set", () => {
    expect(listingBadge({}, AR)).toBeUndefined();
    expect(
      listingBadge({ exclusive: false, vacant_on_transfer: false }, AR),
    ).toBeUndefined();
  });

  it("survives a row with no flags at all", () => {
    // `flags` is nullable on the row and several callers pass it straight
    // through, so null and undefined are real inputs rather than defensive
    // padding.
    expect(listingBadge(null, AR)).toBeUndefined();
    expect(listingBadge(undefined, AR)).toBeUndefined();
  });
});

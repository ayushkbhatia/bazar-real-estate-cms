import { describe, it, expect } from "vitest";
import { isUuidLike, uuidLike, uuidLikeOrEmpty, UUID_SHAPE_RE } from "./uuid";

/** Ids the catalogue actually contains, alongside generated ones. */
const SEEDED = [
  "33333333-0000-0000-0000-000000000008", // development
  "22222222-0000-0000-0000-000000000001", // developer
  "11111111-0000-0000-0000-000000000001", // area
  "44444444-0000-0000-0000-000000000160", // property
];
const GENERATED = [
  "c9357ca4-3e68-4c22-b9b6-dae49e826d2b", // staff user
  "d9a6902c-efd6-4b94-aa67-7cd14595463d", // megamenu tile
];

describe("uuidLike", () => {
  it("accepts the seeded ids that z.string().uuid() rejects", () => {
    // The zero version nibble is why the strict check refused these, and why
    // picking a neighbouring project used to fail on every slot.
    for (const id of SEEDED) {
      expect(uuidLike().safeParse(id).success, id).toBe(true);
    }
  });

  it("accepts ordinary generated ids too", () => {
    for (const id of GENERATED) {
      expect(uuidLike().safeParse(id).success, id).toBe(true);
    }
  });

  it("still rejects anything that isn't an id", () => {
    for (const bad of [
      "",
      "nope",
      "33333333-0000-0000-0000",
      "33333333-0000-0000-0000-00000000000",
      "33333333-0000-0000-0000-0000000000008",
      "zzzzzzzz-0000-0000-0000-000000000008",
      "33333333_0000_0000_0000_000000000008",
      " 33333333-0000-0000-0000-000000000008 ",
    ]) {
      expect(uuidLike().safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("is case-insensitive, as Postgres is", () => {
    expect(
      uuidLike().safeParse("C9357CA4-3E68-4C22-B9B6-DAE49E826D2B").success,
    ).toBe(true);
  });
});

describe("uuidLikeOrEmpty", () => {
  it("treats blank and null as not set", () => {
    expect(uuidLikeOrEmpty().parse("")).toBeNull();
    expect(uuidLikeOrEmpty().parse(null)).toBeNull();
    expect(uuidLikeOrEmpty().parse(undefined)).toBeUndefined();
  });

  it("passes a real id through", () => {
    expect(uuidLikeOrEmpty().parse(SEEDED[0])).toBe(SEEDED[0]);
  });

  it("still rejects junk rather than nulling it", () => {
    expect(uuidLikeOrEmpty().safeParse("nope").success).toBe(false);
  });
});

describe("isUuidLike", () => {
  it("narrows unknown values", () => {
    expect(isUuidLike(SEEDED[0])).toBe(true);
    expect(isUuidLike(GENERATED[0])).toBe(true);
    expect(isUuidLike(42)).toBe(false);
    expect(isUuidLike(null)).toBe(false);
    expect(isUuidLike("nope")).toBe(false);
  });
});

describe("UUID_SHAPE_RE", () => {
  it("is not sticky — reusing it doesn't skip matches", () => {
    // A /g or /y flag would make the regex stateful and every other call
    // would fail, which is a genuinely nasty way for validation to break.
    expect(UUID_SHAPE_RE.flags).not.toContain("g");
    expect(UUID_SHAPE_RE.flags).not.toContain("y");
    expect(UUID_SHAPE_RE.test(SEEDED[0])).toBe(true);
    expect(UUID_SHAPE_RE.test(SEEDED[0])).toBe(true);
  });
});

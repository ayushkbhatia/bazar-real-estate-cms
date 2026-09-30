import { describe, expect, it } from "vitest";
import { mayActOn } from "./permissions";

describe("who may act on a request", () => {
  it("lets the Head act on any request, and an adviser on their own", () => {
    expect(mayActOn("head", "someone-else", "me")).toBe(true);
    expect(mayActOn("head", null, "me")).toBe(true);
    expect(mayActOn("adviser", "me", "me")).toBe(true);
  });

  it("keeps an adviser off anyone else's request, and off an unassigned one", () => {
    expect(mayActOn("adviser", "someone-else", "me")).toBe(false);
    expect(mayActOn("adviser", null, "me")).toBe(false);
  });
});

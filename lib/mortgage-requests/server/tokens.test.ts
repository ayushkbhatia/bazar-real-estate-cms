/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { bearerToken, hashToken, newToken, tokenMatches } from "./tokens";

describe("draft and link tokens (SPEC §8)", () => {
  it("are 256-bit random, URL-safe, and different every time", () => {
    const a = newToken();
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
  });

  it("are stored only as a hash, and match only themselves", () => {
    const token = newToken();
    const stored = hashToken(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(token);
    expect(tokenMatches(token, stored)).toBe(true);
    expect(tokenMatches(newToken(), stored)).toBe(false);
    expect(tokenMatches(token, "not-a-hash")).toBe(false);
  });

  it("come only from a Bearer header", () => {
    const token = newToken();
    expect(bearerToken(new Headers({ authorization: `Bearer ${token}` }))).toBe(token);
    expect(bearerToken(new Headers({ authorization: `Basic ${token}` }))).toBeNull();
    expect(bearerToken(new Headers({ authorization: "Bearer short" }))).toBeNull();
    expect(bearerToken(new Headers())).toBeNull();
  });
});

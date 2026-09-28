/**
 * Draft and link tokens (docs/mortgage/SPEC.md §8): 256-bit random, sent to
 * the browser once, stored only as a SHA-256 hash, compared in constant time.
 * A token is never logged and never put in a URL except the secure link's own.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The token from `Authorization: Bearer …`, or null. */
export function bearerToken(headers: Headers): string | null {
  const value = headers.get("authorization");
  const match = value?.match(/^Bearer\s+([A-Za-z0-9_-]{16,200})$/);
  return match ? match[1] : null;
}

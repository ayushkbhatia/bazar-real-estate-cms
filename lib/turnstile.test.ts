/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

const respond = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe("verifyTurnstile", () => {
  it("skips the check without a secret outside production, and refuses in production", async () => {
    expect(await verifyTurnstile("token", null, { secret: "", production: false })).toEqual({ ok: true });
    expect(await verifyTurnstile("token", null, { secret: "", production: true })).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("needs a token once configured", async () => {
    expect(await verifyTurnstile(undefined, null, { secret: "s" })).toEqual({ ok: false, reason: "missing" });
  });

  it("asks Cloudflare, sending the secret, the token and the visitor's IP", async () => {
    const fetchImpl = respond({ success: true });
    expect(await verifyTurnstile("tok", "203.0.113.5", { secret: "s", fetchImpl })).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const sent = new URLSearchParams(init.body as URLSearchParams);
    expect(Object.fromEntries(sent)).toEqual({ secret: "s", response: "tok", remoteip: "203.0.113.5" });
  });

  it("refuses a failed challenge, and says so when Cloudflare can't be reached", async () => {
    expect(await verifyTurnstile("tok", null, { secret: "s", fetchImpl: respond({ success: false }) })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await verifyTurnstile("tok", null, { secret: "s", fetchImpl: respond({}, false) })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const offline = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await verifyTurnstile("tok", null, { secret: "s", fetchImpl: offline })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

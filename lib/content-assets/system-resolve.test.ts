import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";

/**
 * A database that never answers must not hold a send path open. The reads in
 * front of every transactional email are bounded; past the deadline the
 * built-in email sends in the default design.
 */

const signals: AbortSignal[] = [];

/** A query builder whose request never resolves unless aborted. */
function hangingBuilder() {
  const builder: Record<string, unknown> = {};
  let signal: AbortSignal | undefined;
  for (const m of ["from", "select", "eq", "is"]) builder[m] = () => builder;
  builder.abortSignal = (s: AbortSignal) => {
    signal = s;
    signals.push(s);
    return builder;
  };
  builder.maybeSingle = () =>
    new Promise((resolve) => {
      signal?.addEventListener("abort", () =>
        resolve({ data: null, error: { message: "AbortError" } }),
      );
    });
  return builder;
}

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: true,
  env: { NEXT_PUBLIC_SITE_URL: "https://bazar.example" },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => hangingBuilder(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  signals.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("resolveSystemEmail against a database that does not answer", () => {
  it("sends the built-in email once the deadline passes, and cancels the reads", async () => {
    const { resolveSystemEmail, READ_DEADLINE_MS } = await import("./system-resolve");
    const builtin = { subject: "Built-in", text: "t", html: "h" };
    const fallback = vi.fn(() => builtin);

    let settled = false;
    const pending = resolveSystemEmail("newsletter_confirmation", { values: {} }, fallback).then(
      (r) => {
        settled = true;
        return r;
      },
    );

    await vi.advanceTimersByTimeAsync(READ_DEADLINE_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe(builtin);
    expect(fallback).toHaveBeenCalledWith(DEFAULT_EMAIL_BRAND);
    // Both the wording read and the design read were aborted, not left open.
    expect(signals.length).toBe(2);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });
});

/**
 * The bedroom / bathroom filter: any of the ticked counts, the top option
 * meaning "that many or more".
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/i18n/current", () => ({ currentLocale: async () => "en" }));

import { countFilter } from "./properties";

describe("countFilter", () => {
  it("is null when nothing is ticked", () => {
    expect(countFilter("beds", [], 5)).toBeNull();
  });

  it("matches exact counts with one `in`", () => {
    expect(countFilter("beds", [0, 1, 2], 5)).toBe("beds.in.(0,1,2)");
  });

  it("reads the cap as a minimum", () => {
    expect(countFilter("baths", [4], 4)).toBe("baths.gte.4");
  });

  it("combines both, so 2 or 5+ shows either", () => {
    expect(countFilter("beds", [2, 5], 5)).toBe("beds.in.(2),beds.gte.5");
  });
});

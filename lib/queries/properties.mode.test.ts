/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Sale or rent, exactly.
 *
 * Until 0168 `buy` was an umbrella the query layer expanded to
 * `in ('buy','off_plan')`, because off-plan stock was filed under its own
 * mode. 0168 re-filed those rows as `buy` (off-plan lives on `property_form`)
 * and a CHECK holds the column to buy/rent, so the filter is a plain `eq`.
 * The stub returns whatever it is given regardless of filter, so these
 * assert on the *filter calls the query builder receives*.
 */

type Call = { method: string; args: unknown[] };
let calls: Call[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/i18n/current", () => ({ currentLocale: async () => "en" }));

function stub() {
  return {
    from: () => {
      const chain: Record<string, unknown> = {};
      const proxy = new Proxy(chain, {
        get(_t, prop: string) {
          if (prop === "then")
            return (res: (v: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null, count: 0 }).then(res);
          return (...args: unknown[]) => {
            calls.push({ method: prop, args });
            return proxy;
          };
        },
      });
      return proxy;
    },
  };
}
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => stub(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => stub(),
}));

import { listPublishedProperties, getSimilarProperties } from "./properties";

/** The filter actually applied to the `mode` column, whatever its shape. */
function modeFilter() {
  const call = calls.find(
    (c) => (c.method === "eq" || c.method === "in") && c.args[0] === "mode",
  );
  return call ? { method: call.method, value: call.args[1] } : null;
}

beforeEach(() => {
  calls = [];
});

describe("listPublishedProperties mode filter", () => {
  it("filters sale and rent exactly", async () => {
    for (const mode of ["buy", "rent"] as const) {
      calls = [];
      await listPublishedProperties({ mode });
      expect(modeFilter()).toEqual({ method: "eq", value: mode });
    }
  });

  it("applies no mode filter when none is asked for", async () => {
    await listPublishedProperties({});
    expect(modeFilter()).toBeNull();
  });

  it("narrows by completion form on top of the mode", async () => {
    // /buy/ready, /buy/resale and /buy/search?form=off_plan.
    await listPublishedProperties({ mode: "buy", form: "off_plan" });
    expect(modeFilter()).toEqual({ method: "eq", value: "buy" });
    expect(
      calls.some(
        (c) =>
          c.method === "eq" &&
          c.args[0] === "property_form" &&
          c.args[1] === "off_plan",
      ),
    ).toBe(true);
  });
});

describe("getSimilarProperties mode filter", () => {
  it("keeps a sale listing's suggestions to sale stock", async () => {
    await getSimilarProperties("id-1", null, "buy");
    expect(modeFilter()).toEqual({ method: "eq", value: "buy" });
  });

  it("keeps rent to rent", async () => {
    await getSimilarProperties("id-1", null, "rent");
    expect(modeFilter()).toEqual({ method: "eq", value: "rent" });
  });
});

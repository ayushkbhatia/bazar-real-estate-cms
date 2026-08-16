/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "Buy" is an umbrella over ready, resale and off-plan.
 *
 * Every published row in the catalogue is `off_plan`, so an exact
 * `.eq('mode', 'buy')` renders /buy/search — and the home page's featured
 * rail — empty against a healthy catalogue. That is the regression this
 * pins, and it is invisible to any test that only counts returned rows:
 * the stub returns whatever it is given regardless of filter. So these
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
  it("expands buy to cover off-plan stock", async () => {
    await listPublishedProperties({ mode: "buy" });
    expect(modeFilter()).toEqual({ method: "in", value: ["buy", "off_plan"] });
  });

  it("leaves the narrow modes exact", async () => {
    for (const mode of ["rent", "commercial", "off_plan"] as const) {
      calls = [];
      await listPublishedProperties({ mode });
      expect(modeFilter()).toEqual({ method: "eq", value: mode });
    }
  });

  it("applies no mode filter when none is asked for", async () => {
    await listPublishedProperties({});
    expect(modeFilter()).toBeNull();
  });

  it("still narrows by completion form on top of the umbrella", async () => {
    // /buy/ready and /buy/resale stay exact: off-plan rows carry no
    // `property_form`, so widening the mode cannot leak them in.
    await listPublishedProperties({ mode: "buy", form: "ready_new" });
    expect(modeFilter()).toEqual({ method: "in", value: ["buy", "off_plan"] });
    expect(
      calls.some(
        (c) =>
          c.method === "eq" &&
          c.args[0] === "property_form" &&
          c.args[1] === "ready_new",
      ),
    ).toBe(true);
  });
});

describe("getSimilarProperties mode filter", () => {
  it("uses the same umbrella, so a sale listing can suggest off-plan", async () => {
    await getSimilarProperties("id-1", null, "buy");
    expect(modeFilter()).toEqual({ method: "in", value: ["buy", "off_plan"] });
  });

  it("keeps rent to rent", async () => {
    await getSimilarProperties("id-1", null, "rent");
    expect(modeFilter()).toEqual({ method: "eq", value: "rent" });
  });
});

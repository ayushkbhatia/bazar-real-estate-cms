import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The egress guard.
 *
 * This worktree is named after a Supabase egress scare, and a landing page is
 * the one CMS surface where a non-engineer can put eight catalogue-backed
 * sections on one screen. None of the query modules below is React-cached, so
 * "the component fetches what it needs" would mean one joined query per
 * section, on every revalidation, forever. These tests are what stop that
 * regressing: they count calls, not results.
 */

const listPropertiesByReference = vi.fn(async (refs: string[]) =>
  refs.map((reference) => ({ reference })),
);
const listExclusiveProperties = vi.fn(async () => [{ reference: "EX-1" }]);
const listNewThisWeek = vi.fn(async () => [{ reference: "NEW-1" }]);
const listPriceDrops = vi.fn(async () => [{ reference: "PD-1" }]);
const listPublishedDevelopments = vi.fn(async () => [{ slug: "one" }]);
const getForms = vi.fn(async (keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, { key: k, enabled: true }])),
);

vi.mock("@/lib/queries/featured-properties", () => ({
  listPropertiesByReference: (refs: string[]) => listPropertiesByReference(refs),
}));
vi.mock("@/lib/queries/curated-listings", () => ({
  listExclusiveProperties: () => listExclusiveProperties(),
  listNewThisWeek: () => listNewThisWeek(),
  listPriceDrops: () => listPriceDrops(),
}));
vi.mock("@/lib/queries/developments", () => ({
  listPublishedDevelopments: () => listPublishedDevelopments(),
}));
vi.mock("@/lib/queries/forms", () => ({
  getForms: (keys: string[]) => getForms(keys),
}));

const { collectDataRequest, resolveLandingData, LANDING_MAX_REFS } = await import(
  "./data"
);
const { getBlockDef } = await import("./catalogue");
const { resolveDocument } = await import("./document");
const { LANDING_QUERY_BUDGET } = await import("./types");

type Values = import("@/lib/master-pages").SectionValues;

let n = 0;
function inst(type: string, values: Values = {}) {
  n += 1;
  return { id: `b${n}`, type, v: 1, enabled: true, values };
}

function picks(...refs: string[]) {
  return refs.map((slug) => ({ slug }));
}

function resolve(blocks: ReturnType<typeof inst>[]) {
  return resolveDocument(blocks);
}

function calls() {
  return (
    listPropertiesByReference.mock.calls.length +
    listExclusiveProperties.mock.calls.length +
    listNewThisWeek.mock.calls.length +
    listPriceDrops.mock.calls.length +
    listPublishedDevelopments.mock.calls.length +
    getForms.mock.calls.length
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  n = 0;
});

describe("collectDataRequest", () => {
  it("unions and dedups picks across every featured block", () => {
    const request = collectDataRequest(
      resolve([
        inst("featured_properties", { source: "picked", picks: picks("A", "B") }),
        inst("featured_properties", { source: "picked", picks: picks("B", "C") }),
      ]),
    );
    expect(request.propertyRefs.sort()).toEqual(["A", "B", "C"]);
  });

  it("collapses two identical query-driven rails to one fetch key", () => {
    const request = collectDataRequest(
      resolve([
        inst("featured_properties", { source: "new_this_week", limit: "4" }),
        inst("featured_properties", { source: "new_this_week", limit: "4" }),
        inst("featured_properties", { source: "new_this_week", limit: "8" }),
      ]),
    );
    expect(request.queries.sort()).toEqual([
      "new_this_week:4",
      "new_this_week:8",
    ]);
  });

  it("caps refs at the filter limit the query itself enforces", () => {
    const many = Array.from({ length: 40 }, (_, i) => `R-${i}`);
    const request = collectDataRequest(
      resolve([inst("featured_properties", { source: "picked", picks: picks(...many) })]),
    );
    expect(request.propertyRefs).toHaveLength(LANDING_MAX_REFS);
  });

  it("ignores blocks the editor has switched off", () => {
    const blocks = resolve([
      inst("featured_developments", { picks: [] }),
      inst("featured_properties", { source: "picked", picks: picks("A") }),
    ]);
    blocks.forEach((b) => (b.enabled = false));
    const request = collectDataRequest(blocks);
    expect(request).toEqual({
      propertyRefs: [],
      queries: [],
      developments: false,
      formKeys: [],
    });
  });

  it("dedups form keys across hero and lead band", () => {
    const request = collectDataRequest(
      resolve([
        inst("hero_form", { form_key: "contact_enquiry" }),
        inst("form_band", { form_key: "contact_enquiry" }),
        inst("form_band", { form_key: "buy_lead_band" }),
      ]),
    );
    expect(request.formKeys.sort()).toEqual(["buy_lead_band", "contact_enquiry"]);
  });
});

describe("resolveLandingData", () => {
  it("makes exactly one properties call for eight picked rails", async () => {
    const blocks = resolve(
      Array.from({ length: 8 }, (_, i) =>
        inst("featured_properties", {
          source: "picked",
          picks: picks(`R-${i}`, "SHARED"),
        }),
      ),
    );
    await resolveLandingData(collectDataRequest(blocks));

    expect(listPropertiesByReference).toHaveBeenCalledTimes(1);
    const refs = listPropertiesByReference.mock.calls[0][0];
    expect(refs).toContain("SHARED");
    // Deduped: 8 unique + the one they share, not 16.
    expect(refs).toHaveLength(9);
  });

  it("makes exactly one developments call for three project rails", async () => {
    const blocks = resolve([
      inst("featured_developments", { picks: [] }),
      inst("featured_developments", { picks: picks("one") }),
      inst("featured_developments", { picks: [] }),
    ]);
    await resolveLandingData(collectDataRequest(blocks));
    expect(listPublishedDevelopments).toHaveBeenCalledTimes(1);
  });

  it("makes exactly one forms call however many forms are on the page", async () => {
    const blocks = resolve([
      inst("hero_form", { form_key: "a" }),
      inst("form_band", { form_key: "b" }),
      inst("form_band", { form_key: "c" }),
    ]);
    await resolveLandingData(collectDataRequest(blocks));
    expect(getForms).toHaveBeenCalledTimes(1);
    expect(getForms.mock.calls[0][0].sort()).toEqual(["a", "b", "c"]);
  });

  it("makes zero catalogue calls for a page with no data-backed block", async () => {
    const blocks = resolve([
      inst("hero_media", {}),
      inst("faq", { items: [] }),
      inst("rich_text", { body: "Copy." }),
      inst("cta_band", { title: "Go" }),
    ]);
    const data = await resolveLandingData(collectDataRequest(blocks));
    expect(calls()).toBe(0);
    expect(data.developments).toEqual([]);
    expect(data.propertiesByRef.size).toBe(0);
  });

  it("stays inside the round-trip ceiling for a maximal page", async () => {
    const blocks = resolve([
      inst("featured_properties", { source: "picked", picks: picks("A") }),
      inst("featured_properties", { source: "exclusive", limit: "4" }),
      inst("featured_properties", { source: "new_this_week", limit: "4" }),
      inst("featured_properties", { source: "price_drops", limit: "8" }),
      inst("featured_developments", { picks: [] }),
      inst("hero_form", { form_key: "contact_enquiry" }),
      inst("form_band", { form_key: "buy_lead_band" }),
    ]);
    await resolveLandingData(collectDataRequest(blocks));
    // 1 by-ref + 3 curated + 1 developments + 1 forms.
    expect(calls()).toBe(6);
  });

  it("keys query results so the adapter can find them", async () => {
    const blocks = resolve([
      inst("featured_properties", { source: "price_drops", limit: "8" }),
    ]);
    const data = await resolveLandingData(collectDataRequest(blocks));
    expect(data.propertiesByQuery.get("price_drops:8")).toEqual([
      { reference: "PD-1" },
    ]);
  });
});

describe("the declared budget", () => {
  it("refuses more live-inventory blocks than the gate allows", () => {
    const cost = (key: string) => getBlockDef(key)?.queryCost ?? 0;
    // Seven data-backed rails: over budget, and the publish gate is what says
    // so before the page ever renders.
    const total = Array.from({ length: 7 }, () => cost("featured_properties")).reduce(
      (a, b) => a + b,
      0,
    );
    expect(total).toBeGreaterThan(LANDING_QUERY_BUDGET);
  });
});

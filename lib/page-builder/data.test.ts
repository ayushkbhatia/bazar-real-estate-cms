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
const getTestimonials = vi.fn(async () => []);
const getPartners = vi.fn(async () => [{ slug: "adcb" }]);
const listLandingProjects = vi.fn(
  async (slugs: string[], _opts?: { units?: boolean; unitTypes?: boolean }) =>
    slugs.map((slug) => ({ slug })),
);
const listAgents = vi.fn(async () => [{ slug: "mariam" }, { slug: "omar" }]);

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
vi.mock("@/lib/queries/content-sections", () => ({
  getTestimonials: () => getTestimonials(),
  getPartners: () => getPartners(),
}));
vi.mock("@/lib/queries/landing-projects", () => ({
  LANDING_MAX_PROJECTS: 12,
  listLandingProjects: (
    slugs: string[],
    opts?: { units?: boolean; unitTypes?: boolean },
  ) => listLandingProjects(slugs, opts),
}));
vi.mock("@/lib/queries/agents", () => ({
  listAgents: () => listAgents(),
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
    getForms.mock.calls.length +
    getTestimonials.mock.calls.length +
    getPartners.mock.calls.length +
    listLandingProjects.mock.calls.length +
    listAgents.mock.calls.length
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
      testimonials: null,
      partners: false,
      projects: [],
      projectUnits: false,
      projectUnitTypes: false,
      advisors: [],
    });
  });

  /**
   * The shared-content case. Two testimonial blocks are not two lists — there
   * is one list in the section library — so the request carries a single
   * number, the largest slice any block asked for, and the adapter re-slices
   * per block.
   */
  it("collapses every testimonial block to one request for the largest slice", () => {
    const request = collectDataRequest(
      resolve([
        inst("testimonials", { limit: "2" }),
        inst("testimonials", { limit: "6" }),
      ]),
    );
    expect(request.testimonials).toBe(6);
  });

  it("asks for no reviews when no block shows them", () => {
    const request = collectDataRequest(resolve([inst("faq", { items: [] })]));
    expect(request.testimonials).toBeNull();
  });

  it("unions every project section's project into one list", () => {
    const request = collectDataRequest(
      resolve([
        inst("project_facts", { development: "yas-riva" }),
        inst("project_payment_plan", { development: "yas-riva" }),
        inst("project_master_plan", { development: "sei-saadiyat" }),
        inst("project_location", { development: "yas-riva" }),
      ]),
    );
    expect(request.projects.sort()).toEqual(["sei-saadiyat", "yas-riva"]);
    // The payment plan prices units; nothing here draws layouts.
    expect(request.projectUnits).toBe(true);
    expect(request.projectUnitTypes).toBe(false);
  });

  it("asks for nothing on a project section with no project picked", () => {
    const request = collectDataRequest(
      resolve([
        inst("project_payment_plan", { development: null }),
        inst("project_unit_plans", { development: "" }),
      ]),
    );
    expect(request.projects).toEqual([]);
    // No project means no embedded inventory either — the flags follow the
    // sections that will actually render.
    expect(request.projectUnits).toBe(false);
    expect(request.projectUnitTypes).toBe(false);
  });

  it("dedups advisors and flags the shared partner list", () => {
    const request = collectDataRequest(
      resolve([
        inst("advisor", { agent: "mariam" }),
        inst("advisor", { agent: "mariam" }),
        inst("partners", {}),
      ]),
    );
    expect(request.advisors).toEqual(["mariam"]);
    expect(request.partners).toBe(true);
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
      inst("mortgage_calculator", {}),
      inst("value_grid", {}),
      // A project section nobody has pointed at a project yet.
      inst("project_payment_plan", { development: null }),
    ]);
    const data = await resolveLandingData(collectDataRequest(blocks));
    expect(calls()).toBe(0);
    expect(data.developments).toEqual([]);
    expect(data.propertiesByRef.size).toBe(0);
  });

  /**
   * The project-section egress guard. A launch page is the one place an editor
   * will put five sections about one record; if each fetched its project the
   * page would read the same row five times on every revalidation.
   */
  it("makes exactly one projects call for every project section, across projects", async () => {
    const blocks = resolve([
      inst("project_facts", { development: "yas-riva" }),
      inst("project_payment_plan", { development: "yas-riva" }),
      inst("project_master_plan", { development: "yas-riva" }),
      inst("project_unit_plans", { development: "yas-riva" }),
      inst("project_location", { development: "yas-riva" }),
      inst("project_payment_plan", { development: "sei-saadiyat" }),
    ]);
    const data = await resolveLandingData(collectDataRequest(blocks));
    expect(listLandingProjects).toHaveBeenCalledTimes(1);
    expect(calls()).toBe(1);
    const [slugs, opts] = listLandingProjects.mock.calls[0]!;
    expect([...slugs].sort()).toEqual(["sei-saadiyat", "yas-riva"]);
    // Units and layouts ride along in the same call, not as two more.
    expect(opts).toMatchObject({ units: true, unitTypes: true });
    expect(data.projectsBySlug.get("yas-riva")).toEqual({ slug: "yas-riva" });
    // Nothing here gates its layouts, so the floor-plan form is not read.
    expect(getForms).not.toHaveBeenCalled();
  });

  /**
   * Which projects gate their layouts is only known once they are read, so
   * the form they gate with is a second read — made only when one does, and
   * only when the page draws layouts at all.
   */
  it("reads the floor-plan form once a drawn project turns out to gate", async () => {
    listLandingProjects.mockResolvedValueOnce([
      { slug: "yas-riva", floorplanGated: true } as never,
    ]);
    const data = await resolveLandingData(
      collectDataRequest(
        resolve([inst("project_unit_plans", { development: "yas-riva" })]),
      ),
    );
    expect(getForms).toHaveBeenCalledTimes(1);
    expect(getForms).toHaveBeenCalledWith(["development_floorplan"]);
    expect(data.forms.development_floorplan).toBeDefined();
    expect(calls()).toBe(2);
  });

  it("leaves the floor-plan form alone on a page that draws no layouts", async () => {
    listLandingProjects.mockResolvedValueOnce([
      { slug: "yas-riva", floorplanGated: true } as never,
    ]);
    await resolveLandingData(
      collectDataRequest(
        resolve([inst("project_payment_plan", { development: "yas-riva" })]),
      ),
    );
    expect(getForms).not.toHaveBeenCalled();
  });

  it("reads the roster once and keeps only the advisors a block named", async () => {
    const blocks = resolve([
      inst("advisor", { agent: "mariam" }),
      inst("advisor", { agent: "mariam" }),
    ]);
    const data = await resolveLandingData(collectDataRequest(blocks));
    expect(listAgents).toHaveBeenCalledTimes(1);
    expect([...data.advisorsBySlug.keys()]).toEqual(["mariam"]);
  });

  it("reads the partner list once however many blocks show it", async () => {
    const blocks = resolve([inst("partners", {}), inst("partners", {})]);
    const data = await resolveLandingData(collectDataRequest(blocks));
    expect(getPartners).toHaveBeenCalledTimes(1);
    expect(data.partners).toEqual([{ slug: "adcb" }]);
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

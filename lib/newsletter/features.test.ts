import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://project-one.supabase.co", NEXT_PUBLIC_SITE_URL: "https://www.bazarrealestate.ae" },
  isSupabaseConfigured: true,
}));

const { DEFAULT_EMAIL_BRAND } = await import("@/lib/content-assets/email-brand");
const {
  featureAttrs,
  featureBlocksIn,
  featureRefsIn,
  normaliseFeatureBlock,
  readFeatureAttrs,
  FEATURE_MAX,
} = await import("@/lib/content-assets/email-feature");
const { sanitizeEmailBody, renderEmailBodyHtml, renderEmailBodyText } = await import(
  "@/lib/content-assets/email-html"
);
const { renderFeatureBlock, missingFeatures, featureParts } = await import("./feature-render");
const { resolveFeatures, shapeArticle } = await import("./features");
const { unitLabelsFor } = await import("@/lib/preferences/unit-labels");
const { campaignProblems, renderNewsletter, toArabicLinks, isBlankBody } = await import("./campaign");
const { starterDraft, STARTERS } = await import("./starters");

type Lookup = import("./feature-render").FeatureLookup;
type Record_ = import("./feature-render").FeatureRecord;

const P1 = "11111111-0000-0000-0000-000000000001";
const P2 = "11111111-0000-0000-0000-000000000002";
const P3 = "11111111-0000-0000-0000-000000000003";
const D1 = "33333333-0000-0000-0000-000000000008";
const A1 = "44444444-0000-0000-0000-000000000004";

const villa: Record_ = {
  kind: "property",
  id: P1,
  href: "/p/yas-villa-BAZ-AD-01445",
  name: "Yas Riva <Reserve>",
  reference: "BAZ-AD-01445",
  area: "Yas Island",
  mode: "buy",
  type: "villa",
  priceAed: 13_300_000,
  beds: 5,
  baths: 6,
  builtUpFt2: 5942,
  image: { url: "https://project-one.supabase.co/storage/v1/object/public/media/listings/a.jpg", alt: "Pool" },
};
const flat: Record_ = { ...villa, id: P2, name: "Marina flat", mode: "rent", type: "apartment", priceAed: 180_000, beds: 0, image: null };

const lookupOf = (records: Record_[], gone: string[] = []): Lookup => ({
  get(kind, id) {
    const hit = records.find((r) => r.kind === kind && r.id === id);
    if (hit) return hit;
    return gone.includes(id) ? null : undefined;
  },
});

const opts = (locale: "en" | "ar") => ({
  brand: DEFAULT_EMAIL_BRAND,
  locale,
  labels: unitLabelsFor(locale),
  photo: (url: string, w: number) => `${url}?w=${w}`,
});

const blockTag = (kind: string, ids: string[], layout = "card", labels: string[] = []) => {
  const attrs = featureAttrs(normaliseFeatureBlock({ kind, ids, layout, labels })!);
  return `<div ${Object.entries(attrs)
    .map(([k, v]) => `${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join(" ")}></div>`;
};

describe("the featured block model", () => {
  it("normalises: lowercases, dedupes, drops non-ids, caps at the maximum, defaults the layout", () => {
    const ids = [P1.toUpperCase(), P1, "nope", P2, ...Array.from({ length: 10 }, (_, i) => `22222222-0000-0000-0000-00000000000${i}`)];
    const block = normaliseFeatureBlock({ kind: "property", ids, layout: "mosaic", labels: ["A", "dup", "x", "B"] })!;
    expect(block.ids[0]).toBe(P1);
    expect(block.ids).toHaveLength(FEATURE_MAX);
    expect(block.layout).toBe("card");
    expect(block.labels.slice(0, 2)).toEqual(["A", "B"]);
    expect(normaliseFeatureBlock({ kind: "agent", ids: [P1] })).toBeNull();
    expect(normaliseFeatureBlock({ kind: "property", ids: ["x"] })).toBeNull();
  });

  it("round-trips through its attributes and is found in a body", () => {
    const block = normaliseFeatureBlock({ kind: "article", ids: [A1], layout: "list", labels: ['Say "hi"'] })!;
    expect(readFeatureAttrs(featureAttrs(block))).toEqual(block);
    const html = `<p>a</p>${blockTag("property", [P1, P2], "grid")}<p>b</p>${blockTag("property", [P2, P3])}`;
    expect(featureBlocksIn(html).map((b) => b.layout)).toEqual(["grid", "card"]);
    expect(featureRefsIn(html, blockTag("article", [A1]))).toEqual([
      { kind: "property", id: P1 },
      { kind: "property", id: P2 },
      { kind: "property", id: P3 },
      { kind: "article", id: A1 },
    ]);
  });
});

describe("the sanitiser and featured blocks", () => {
  const tag = blockTag("property", [P1], "grid", ["Villa"]);

  it("keeps a block only where features are asked for", () => {
    expect(sanitizeEmailBody(`<p>x</p>${tag}`)).toBe("<p>x</p>");
    const kept = sanitizeEmailBody(`<p>x</p>${tag}`, { features: true });
    expect(featureBlocksIn(kept)).toHaveLength(1);
    expect(sanitizeEmailBody(kept, { features: true })).toBe(kept);
  });

  it("drops any other div with what it held, and junk attributes", () => {
    const out = sanitizeEmailBody(
      `<div class="x" onclick="evil()">pasted</div><div data-email-feature="property" data-ids="nope"></div>`,
      { features: true },
    );
    expect(out).toBe("");
    const extra = sanitizeEmailBody(`<div data-email-feature="property" data-ids="${P1}" style="x" onclick="y"></div>`, {
      features: true,
    });
    expect(extra).not.toMatch(/style|onclick/);
    expect(extra).toContain(`data-ids="${P1}"`);
  });

  it("keeps a linked image's target when it is safe, and only then", () => {
    const src = "https://project-one.supabase.co/storage/v1/object/public/media/brand/a.jpg";
    expect(sanitizeEmailBody(`<img src="${src}" data-href="/insights/x">`)).toContain('data-href="/insights/x"');
    expect(sanitizeEmailBody(`<img src="${src}" data-href="javascript:alert(1)">`)).not.toContain("data-href");
    expect(sanitizeEmailBody(`<img src="${src}" data-href="//evil.com">`)).not.toContain("data-href");
  });

  it("renders a linked image inside its link, made absolute", () => {
    const src = "https://project-one.supabase.co/storage/v1/object/public/media/brand/a.jpg";
    const html = renderEmailBodyHtml(`<img src="${src}" alt="Launch" data-href="/developments/x">`, { values: {} }, DEFAULT_EMAIL_BRAND);
    expect(html).toMatch(/<a href="https:\/\/www\.bazarrealestate\.ae\/developments\/x"[^>]*><img [^>]*src="https:\/\/project-one/);
    expect(html).not.toContain("data-href");
    const text = renderEmailBodyText(`<img src="${src}" alt="Launch" data-href="/developments/x">`, { values: {} });
    expect(text).toContain("Launch: https://www.bazarrealestate.ae/developments/x");
  });

  it("swaps each block for what the hook draws, after the token pass, and drops one it can't draw", () => {
    const body = `<p>Hi {{site_url}}</p>${tag}${blockTag("property", [P3])}`;
    const features = vi.fn((b: { ids: string[] }) =>
      b.ids[0] === P1 ? { html: "<table>{{site_url}} CARD</table>", text: "CARD {{site_url}}" } : null,
    );
    const html = renderEmailBodyHtml(body, { values: { site_url: "https://s" }, features }, DEFAULT_EMAIL_BRAND);
    expect(html).toContain("<table>{{site_url}} CARD</table>");
    expect(html).not.toContain("data-email-feature");
    expect(features).toHaveBeenCalledTimes(2);
    const text = renderEmailBodyText(body, { values: { site_url: "https://s" }, features });
    expect(text).toContain("CARD {{site_url}}");
    expect(text).toContain("Hi https://s");
  });

  it("never ships a div that held content, nor its editor-only labels", () => {
    const crafted = `<div data-email-feature="property" data-ids="${P1}" data-labels="[&quot;secret&quot;]"><p>inside</p></div>`;
    const html = renderEmailBodyHtml(crafted, { values: {}, features: () => ({ html: "CARD", text: "CARD" }) }, DEFAULT_EMAIL_BRAND);
    expect(html).not.toMatch(/<div|secret/);
    expect(html).toContain("inside");
  });

  it("strips blocks entirely when no hook is given (every system email)", () => {
    expect(renderEmailBodyHtml(`<p>a</p>${tag}`, { values: {} }, DEFAULT_EMAIL_BRAND)).not.toContain("data-email");
  });
});

describe("drawing featured records", () => {
  it("draws a card with the record's own words, escaped, a price and a link to its page", () => {
    const out = renderFeatureBlock(normaliseFeatureBlock({ kind: "property", ids: [P1] })!, lookupOf([villa]), opts("en"))!;
    expect(out.html).toContain("Yas Riva &lt;Reserve&gt;");
    expect(out.html).not.toContain("<Reserve>");
    expect(out.html).toContain("Villa · For sale");
    expect(out.html).toContain("5 beds · 6 baths · 5,942 ft²");
    expect(out.html).toContain("AED 13.3M");
    expect(out.html).toContain('href="https://www.bazarrealestate.ae/p/yas-villa-BAZ-AD-01445"');
    expect(out.html).toContain("listings/a.jpg?w=980");
    expect(out.text).toContain("https://www.bazarrealestate.ae/p/yas-villa-BAZ-AD-01445");
  });

  it("draws Arabic for an Arabic reader: words, price, /ar link, right to left", () => {
    const out = renderFeatureBlock(normaliseFeatureBlock({ kind: "property", ids: [P1, P2], layout: "grid" })!, lookupOf([villa, flat]), opts("ar"))!;
    expect(out.html).toContain('dir="rtl"');
    expect(out.html).toContain("فيلا · للبيع");
    expect(out.html).toContain("درهم");
    expect(out.html).toContain("/ar/p/yas-villa-BAZ-AD-01445");
    expect(out.html).toContain("text-align:right");
    const card = featureParts(villa, opts("ar"));
    expect(card.facts[0]).toMatch(/^5 غرف نوم · 6 حمّامات · /);
    expect(featureParts(flat, opts("ar")).facts[0]).toMatch(/^استوديو · /);
    expect(featureParts(flat, opts("en")).price).toMatch(/a year$/);
    const article = (n: number): Record_ => ({ kind: "article", id: A1, href: "/insights/x", name: "مقال", image: null, excerpt: null, category: null, readMinutes: n });
    expect([1, 2, 5, 12].map((n) => featureParts(article(n), opts("ar")).sub)).toEqual([
      "دقيقة قراءة",
      "دقيقتا قراءة",
      "5 دقائق قراءة",
      "12 دقيقة قراءة",
    ]);
  });

  it("leaves out records that aren't live, and draws nothing when none are", () => {
    const block = normaliseFeatureBlock({ kind: "property", ids: [P1, P3], layout: "list", labels: ["Villa", "Gone"] })!;
    const out = renderFeatureBlock(block, lookupOf([villa], [P3]), opts("en"))!;
    expect(out.html.match(/<a href="https:\/\/www\.bazarrealestate\.ae\/p\//g)!.length).toBeGreaterThan(0);
    expect(out.html).not.toContain("Gone");
    expect(missingFeatures(block, lookupOf([villa], [P3]))).toEqual([{ id: P3, label: "Gone" }]);
    expect(renderFeatureBlock(block, lookupOf([], [P1, P3]), opts("en"))).toBeNull();
  });

  it("lays a grid out two to a row, filling an odd row with an empty cell", () => {
    const three = [villa, flat, { ...villa, id: P3, name: "Third" }];
    const html = renderFeatureBlock(normaliseFeatureBlock({ kind: "property", ids: [P1, P2, P3], layout: "grid" })!, lookupOf(three), opts("en"))!.html;
    expect(html.match(/<tr><td width="50%"/g)).toHaveLength(2);
  });
});

describe("renderNewsletter with featured blocks", () => {
  it("draws the blocks for the edition being sent, and a body of only blocks is not blank", () => {
    const body = blockTag("property", [P1]);
    expect(isBlankBody(body)).toBe(false);
    const draw = vi.fn((edition: "en" | "ar") => (b: Parameters<typeof renderFeatureBlock>[0]) =>
      renderFeatureBlock(b, lookupOf([villa]), opts(edition)),
    );
    const email = renderNewsletter(
      { subject: "S", preheader: "", body, subject_ar: "ع", preheader_ar: "", body_ar: body },
      { brand: DEFAULT_EMAIL_BRAND, locale: "ar", unsubscribeUrl: "https://x/u", features: draw },
    );
    expect(draw).toHaveBeenCalledWith("ar");
    expect(email.html).toContain("فيلا · للبيع");
  });
});

describe("resolving featured records", () => {
  function fakeClient(tables: Record<string, { data?: unknown[]; error?: { message: string } }>) {
    const calls: string[] = [];
    const chain = (table: string) => {
      calls.push(table);
      const result = tables[table] ?? { data: [] };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "in", "eq", "is", "not", "order", "limit"]) q[m] = () => q;
      q.then = (resolve: (v: unknown) => unknown) => resolve({ data: result.data ?? null, error: result.error ?? null, count: 0 });
      return q;
    };
    return { client: { from: chain } as never, calls };
  }

  it("answers an article in the reader's language, null for an unpublished one, one query per kind", async () => {
    const { client, calls } = fakeClient({
      articles: {
        data: [{ id: A1, slug: "guide", title: "Guide", title_ar: "دليل", excerpt: "E", excerpt_ar: "م", category: "guides", read_minutes: 6, hero: null }],
      },
      article_categories: { data: [{ slug: "guides", label: "Guides", label_ar: "أدلة" }] },
    });
    const gone = "44444444-0000-0000-0000-000000000009";
    const lookup = await resolveFeatures([{ kind: "article", id: A1 }, { kind: "article", id: gone }], "ar", client);
    const hit = lookup.get("article", A1);
    expect(hit && hit.name).toBe("دليل");
    expect(hit && hit.kind === "article" && hit.category).toBe("أدلة");
    expect(lookup.get("article", gone)).toBeNull();
    expect(calls.filter((c) => c === "articles")).toHaveLength(1);
  });

  it("answers undefined, not null, when the lookup fails", async () => {
    const { client } = fakeClient({ articles: { error: { message: "down" } } });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const lookup = await resolveFeatures([{ kind: "article", id: A1 }], "en", client);
    expect(lookup.get("article", A1)).toBeUndefined();
    err.mockRestore();
  });

  it("folds an article's twins away", () => {
    const row = shapeArticle({ id: A1, slug: "s", title: "T", title_ar: "ت", excerpt: null, excerpt_ar: null, category: null, read_minutes: null, hero: null }, "ar");
    expect(row.name).toBe("ت");
    expect(JSON.stringify(row)).not.toContain("_ar");
  });
});

describe("starter layouts", () => {
  const picks = {
    property: [{ id: P1, name: "Villa" }, { id: P2, name: "Flat" }],
    development: [{ id: D1, name: "Saadiyat Lagoons" }],
    article: [{ id: A1, name: "Guide" }],
  };

  it("fill both editions with the same featured blocks, and block sending until the placeholder is replaced", () => {
    const draft = { subject: "", preheader: "", body: "", subject_ar: "", preheader_ar: "", body_ar: "", audience: "all" as const, ...starterDraft("digest", picks) };
    expect(featureRefsIn(draft.body)).toEqual(featureRefsIn(draft.body_ar));
    expect(featureRefsIn(draft.body)).toHaveLength(4);
    expect(draft.body_ar).toContain("{{contact_url}}");
    const problems = campaignProblems(draft);
    expect(problems.body).toMatch(/brackets/);
    expect(problems.body_ar).toMatch(/brackets/);
    const written = {
      ...draft,
      body: draft.body.replace(/\[Write[^\]]*\]/, "Hello."),
      body_ar: draft.body_ar.replace(/\[اكتب[^\]]*\]/, "مرحبًا."),
    };
    expect(campaignProblems(written)).toEqual({});
  });

  it("skip a section with nothing to fill it, and blank is blank", () => {
    const body = starterDraft("digest", { property: [], development: [], article: [] }).body!;
    expect(featureRefsIn(body)).toEqual([]);
    expect(body).not.toContain("<h2>Featured project</h2>");
    expect(starterDraft("blank", picks)).toEqual({});
    expect(STARTERS).toContain("listings");
  });

  it("survive the save sanitiser unchanged in what they feature", () => {
    const { body } = starterDraft("listings", picks) as { body: string };
    expect(featureRefsIn(sanitizeEmailBody(body, { features: true }))).toEqual(featureRefsIn(body));
  });
});

describe("toArabicLinks", () => {
  it("points site paths at their Arabic pages and leaves the rest", () => {
    const html =
      '<a href="/insights/x">a</a><a href="/ar/p/y">b</a><a href="https://x.com/z">c</a><a href="{{contact_url}}">d</a><img data-href="/developments/q" src="s"><a href="/">h</a><a href="/api/n">n</a>';
    expect(toArabicLinks(html)).toBe(
      '<a href="/ar/insights/x">a</a><a href="/ar/p/y">b</a><a href="https://x.com/z">c</a><a href="{{contact_url}}">d</a><img data-href="/ar/developments/q" src="s"><a href="/ar">h</a><a href="/api/n">n</a>',
    );
  });
});

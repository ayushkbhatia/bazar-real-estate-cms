import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_BRAND } from "@/lib/content-assets/email-brand";
import { chainStops, fillUrl, mixHex } from "@/lib/newsletter/fill";
import { AMENITY_ICONS, amenityGroup, amenityIconUrl, matchAmenity } from "./amenity-icons";
import { AMENITY_GLYPHS } from "./amenity-glyphs";
import { emptyDesign, newBlock, normaliseDesign, textSlots } from "./document";
import { renderDesign, type DesignRenderContext } from "./render";
import { amenityGroups, downPayment, planSplit, priceParts, showcaseTemplate, unitTile } from "./showcase";
import type { LaunchProject, SiteFooter } from "./templates";

const SITE_URL = "https://www.bazarrealestate.ae";
const ctx = (locale: "en" | "ar" = "en"): DesignRenderContext => ({
  locale,
  brand: DEFAULT_EMAIL_BRAND,
  siteUrl: SITE_URL,
  values: {},
  subject: "Subject",
  footer: { html: "Bye.", text: "Bye." },
});

const site: SiteFooter = {
  socials: [{ network: "instagram", url: "https://www.instagram.com/bazarrealestate" }],
  phone: "+971 2 632 2223",
  whatsapp: "+971 50 691 1103",
  email: "info@bazarrealestate.ae",
  address: "Al Bateen, Abu Dhabi",
  address_ar: "البطين، أبوظبي",
  legal: "ORN:28209",
  legal_ar: "ORN:28209",
};

const img = (n: number) => ({ url: `https://cdn.example.com/${n}.jpg`, key: null, alt: "" });

/** Shaped like JW Marriott Residences' record in production (Nov 2026). */
const project = (over: Partial<LaunchProject> = {}): LaunchProject => ({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "jw-marriott-residences",
  name: "JW Marriott Residences",
  name_ar: "مساكن جي دبليو ماريوت",
  area: "Yas Island",
  area_ar: "جزيرة ياس",
  developer: "Taraf",
  developer_ar: "طرف",
  tagline: "Branded residences on Yas Island",
  tagline_ar: "مساكن فندقية في جزيرة ياس",
  bedrooms: "1 - 4",
  bedrooms_ar: "1 - 4",
  handover: "Q2 2030",
  handover_ar: "الربع 2 2030",
  hero: img(0),
  features: ["Private Beach Access", "Direct Golf Course Access", "Swimming Pool", "Outdoor Yoga Spaces", "Indoor Gym", "Spa & Recovery Centre"].map((title, n) => ({
    title,
    title_ar: `ميزة ${n}`,
    copy: "",
    copy_ar: "",
    image: img(n + 1),
  })),
  amenities: [],
  amenities_ar: [],
  description: "A collection of 199 branded residences on Yas Island. Designed with Marriott. Third sentence that should not fit.",
  description_ar: "مجموعة من 199 مسكناً فندقياً في جزيرة ياس.",
  startingPrice: 3_300_000,
  paymentPlan: {
    name: "50/50 Payment Plan",
    milestones: [
      { label: "Down Payment", percent: 5 },
      { label: "Instalment 1", percent: 45 },
      { label: "On Handover", percent: 50 },
    ],
  },
  unitTypes: [
    { label: "1 Bedroom Apartment", label_ar: "شقة 1 غرفة نوم", beds: 1 },
    { label: "2 Bedroom Apartment", label_ar: "شقة 2 غرف نوم", beds: 2 },
    { label: "3 Bedroom Apartment", label_ar: "شقة 3 غرف نوم", beds: 3 },
    { label: "4 Bedroom Duplex", label_ar: "دوبلكس 4 غرف نوم", beds: 4 },
  ],
  developerLogo: img(99),
  ...over,
});

describe("amenity icons", () => {
  it("draws every icon from a glyph that exists, with an Arabic name", () => {
    for (const icon of AMENITY_ICONS) {
      expect(AMENITY_GLYPHS[icon.glyph], icon.id).toMatch(/^<(path|circle|rect|line|polyline|ellipse|polygon) /);
      expect(icon.label_ar, icon.id).toMatch(/[؀-ۿ]/);
    }
    expect(new Set(AMENITY_ICONS.map((i) => i.id)).size).toBe(AMENITY_ICONS.length);
  });

  it("matches a project's own titles to the right drawing", () => {
    const id = (t: string) => matchAmenity(t).id;
    expect(id("Private Beach Access")).toBe("beach");
    expect(id("Direct Golf Course Access")).toBe("golf");
    expect(id("Direct Waterfront Views")).toBe("waterfront");
    expect(id("Spa & Recovery Centre")).toBe("spa");
    expect(id("Children's Play Area")).toBe("play");
    expect(id("Landscaped Podium Garden")).toBe("garden");
    expect(id("Residents' Co-working Lounge")).toBe("coworking");
    expect(id("مسبح لا متناهي")).toBe("pool");
    expect(id("Something else entirely")).toBe("amenity");
  });

  it("finds a short word only as a word: 'spa' isn't in 'spaces', 'park' isn't parking", () => {
    expect(matchAmenity("Open Spaces").id).not.toBe("spa");
    expect(matchAmenity("Covered Parking").id).toBe("parking");
    expect(matchAmenity("Pools and Spas").id).toBe("pool");
  });

  it("files an amenity by its own words first: outdoor yoga is outdoor", () => {
    expect(amenityGroup("Outdoor Yoga Spaces", matchAmenity("Outdoor Yoga Spaces"))).toBe("outdoor");
    expect(amenityGroup("Yoga studio", matchAmenity("Yoga studio"))).toBe("indoor");
    expect(amenityGroup("Indoor pool", matchAmenity("Indoor pool"))).toBe("indoor");
  });

  it("asks the icon route for a known icon and a clean colour, nothing else", () => {
    expect(amenityIconUrl(SITE_URL, "pool", "#ffffff")).toBe(`${SITE_URL}/api/newsletter/icon?n=pool&c=FFFFFF`);
    expect(amenityIconUrl(SITE_URL, "<script>", "red")).toBe(`${SITE_URL}/api/newsletter/icon?n=amenity&c=FFFFFF`);
  });
});

describe("colour fades", () => {
  it("chains: each band starts on the colour the last one ended on", () => {
    const stops = chainStops("#003452", "#005777", 3);
    expect(stops[0]![0]).toBe("#003452");
    expect(stops[2]![1]).toBe("#005777");
    expect(stops[1]![0]).toBe(stops[0]![1]);
    expect(stops[2]![0]).toBe(stops[1]![1]);
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  it("paints a block's fade as a stretched image over the halfway colour, and a flat band when there is no second colour", () => {
    const fadeBlock = newBlock("text", { text: "Hi", background: "#003452", backgroundTo: "#005777" });
    const html = renderDesign({ ...emptyDesign(), blocks: [fadeBlock] }, ctx()).html;
    expect(html).toContain(`background-image:url('${fillUrl(SITE_URL, "#003452", "#005777")!.replace("&", "&amp;")}')`);
    expect(html).toContain("background-size:100% 102%");
    expect(html).toContain(`bgcolor="${mixHex("#003452", "#005777", 0.5)}"`);
    const flat = renderDesign({ ...emptyDesign(), blocks: [newBlock("text", { text: "Hi", background: "#003452" })] }, ctx()).html;
    expect(flat).not.toContain("/api/newsletter/fill");
    expect(fillUrl(SITE_URL, "#003452", "#003452")).toBeNull();
    expect(fillUrl(SITE_URL, "url(x)", "#003452")).toBeNull();
  });
});

describe("showcase pieces", () => {
  it("writes a price in each language's order", () => {
    expect(priceParts(3_300_000)).toMatchObject({ currency: "AED", currency_ar: "درهم", value: "3.3", unit: "Million", unit_ar: "مليون" });
    expect(priceParts(1_660_000)).toMatchObject({ value: "1.66" });
    expect(priceParts(950_000)).toMatchObject({ value: "950,000", unit: "", unit_ar: "" });
  });

  it("turns a unit type into a figure over a word", () => {
    expect(unitTile({ label: "1 Bedroom Apartment", label_ar: "شقة 1 غرفة نوم", beds: 1 })).toEqual({ value: "1", value_ar: "1", label: "Bedroom", label_ar: "غرفة نوم" });
    expect(unitTile({ label: "4 Bedroom Duplex", label_ar: "", beds: 4 })).toMatchObject({ value: "4", label: "Bedroom Duplex" });
    expect(unitTile({ label: "Studio", label_ar: "استوديو", beds: 0 })).toMatchObject({ value: "", label: "Studio", label_ar: "استوديو" });
    expect(unitTile({ label: "Penthouse", label_ar: "", beds: 5 })).toMatchObject({ value: "", label: "Penthouse" });
  });

  it("reads the payment terms from the plan", () => {
    const plan = project().paymentPlan;
    expect(downPayment(plan)).toBe("5%");
    expect(planSplit(plan)).toBe("50/50");
    expect(planSplit({ name: "Flexible plan", milestones: [{ label: "Booking", percent: 10 }, { label: "Construction", percent: 45 }, { label: "On handover", percent: 45 }] })).toBe("55/45");
    expect(downPayment({ name: "", milestones: [{ label: "Instalment 1", percent: 10 }] })).toBe("");
    expect(planSplit(null)).toBe("");
  });

  it("groups the project's amenities outdoor, indoor, services, each matched to an icon", () => {
    const groups = amenityGroups(project());
    expect(groups.map((g) => g.group)).toEqual(["outdoor", "indoor"]);
    expect(groups[0]!.items.map((i) => i.icon)).toEqual(["beach", "golf", "pool", "yoga"]);
    expect(groups[1]!.items.map((i) => i.icon)).toEqual(["gym", "spa"]);
    expect(groups[0]!.items[0]).toMatchObject({ label: "Private Beach Access", label_ar: "ميزة 0" });
  });
});

describe("the showcase template", () => {
  it("lays the project out in the inspiration's order", () => {
    const { design } = showcaseTemplate(project(), site);
    expect(design.blocks.map((b) => b.type)).toEqual([
      "hero",
      "text",
      "image",
      "tiles",
      "price",
      "stats",
      "image",
      "amenities",
      "amenities",
      "gallery",
      "text",
      "button",
      "social",
      "contact",
    ]);
    // What the editor stores is what the template made: nothing dropped on save.
    expect(normaliseDesign(design).blocks.map((b) => b.type)).toEqual(design.blocks.map((b) => b.type));
  });

  it("signs the hero with Bazar's logo and the developer's, and puts the area in a pill", () => {
    const hero = showcaseTemplate(project(), site).design.blocks[0]!;
    expect(hero.props).toMatchObject({ logoPosition: "corners", partnerLogo: img(99), tag: "Yas Island, Abu Dhabi", subheadingStyle: "caps" });
    const html = renderDesign(showcaseTemplate(project(), site).design, ctx()).html;
    expect(html).toContain("/email/bazar-logo-white.png");
    expect(html).toContain("https://cdn.example.com/99.jpg");
    expect(html).toContain("border-radius:999px");
    expect(html).toContain("text-transform:uppercase");
  });

  it("fades each section down several blocks without a seam", () => {
    const blocks = showcaseTemplate(project(), site).design.blocks;
    const run = (types: string[]) => blocks.filter((b) => types.includes(b.type));
    for (const section of [run(["tiles", "price", "stats"]), run(["amenities"]), blocks.slice(-4)]) {
      for (let i = 1; i < section.length; i++) expect(section[i]!.props.background).toBe(section[i - 1]!.props.backgroundTo);
    }
    expect(run(["tiles"])[0]!.props.background).toBe("#003452");
    expect(run(["stats"])[0]!.props.backgroundTo).toBe("#005777");
    expect(blocks.at(-1)!.props.backgroundTo).toBe("#00233A");
  });

  it("draws the residences, the price, the terms and the icons in both languages", () => {
    const draft = showcaseTemplate(project(), site);
    const en = renderDesign(draft.design, ctx());
    expect(en.text).toContain("1 Bedroom · 2 Bedroom · 3 Bedroom · 4 Bedroom Duplex");
    expect(en.text).toContain("Starting price: AED 3.3 Million");
    expect(en.text).toContain("5% — Down payment");
    expect(en.text).toContain("50/50 — Payment plan");
    expect(en.html).toContain("/api/newsletter/icon?n=beach&amp;c=FFFFFF");
    expect(en.html).toContain("Outdoor leisure &amp; recreation");
    const ar = renderDesign(draft.design, ctx("ar"));
    expect(ar.text).toContain("ابتداءً من: 3.3 مليون درهم");
    expect(ar.text).toContain("غرفة نوم");
    expect(ar.html).toContain("الترفيه في الهواء الطلق");
    expect(draft.subject).toBe("JW Marriott Residences: residences from AED 3.3M");
    expect(draft.subject_ar).toContain("مساكن جي دبليو ماريوت");
  });

  it("writes every word's Arabic, so the Arabic edition can send as made", () => {
    const missing = textSlots(showcaseTemplate(project(), site).design).filter((slot) => !slot.ar);
    expect(missing.map((m) => `${m.blockLabel} › ${m.label}`)).toEqual([]);
  });

  it("sends its one ask to the project's sign-up page", () => {
    const { design } = showcaseTemplate(project(), site);
    expect(design.blocks.find((b) => b.type === "button")!.props.url).toBe("/developments/jw-marriott-residences/register");
  });

  it("leaves out what the project doesn't have, rather than a placeholder", () => {
    const bare = showcaseTemplate(
      project({ startingPrice: null, paymentPlan: null, handover: "", unitTypes: [], bedrooms: "", features: [], description: "", tagline: "", developerLogo: null }),
      site,
    ).design.blocks.map((b) => b.type);
    expect(bare).toEqual(["hero", "image", "text", "button", "social", "contact"]);
    const fromRange = showcaseTemplate(project({ unitTypes: [], bedrooms: "1 - 3" }), site).design.blocks.find((b) => b.type === "tiles")!;
    expect((fromRange.props.items as { value: string }[]).map((t) => t.value)).toEqual(["1", "2", "3"]);
  });

  it("keeps the unsubscribe line on the dark foot", () => {
    const { design } = showcaseTemplate(project(), site);
    expect(design.settings.contentBackground).toBe("#00233A");
  });
});

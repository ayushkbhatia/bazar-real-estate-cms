import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_BRAND } from "@/lib/content-assets/email-brand";
import { campaignProblems, renderNewsletter, hasArabicEdition, type CampaignDraft } from "../campaign";
import { BLOCKS, blockDef } from "./catalogue";
import { PRESETS } from "./presets";
import {
  designFeatureHtml,
  emptyDesign,
  isUsableLink,
  newBlock,
  normaliseDesign,
  textSlots,
  withArabic,
  withoutArabic,
} from "./document";
import { href, renderDesign, type DesignRenderContext } from "./render";
import { BUILT_IN_TEMPLATES, launchTemplate, staticTemplate, type LaunchProject, type SiteFooter } from "./templates";

const site: SiteFooter = {
  socials: [
    { network: "instagram", url: "https://www.instagram.com/bazarrealestate" },
    { network: "linkedin", url: "https://www.linkedin.com/company/bazarrealestate" },
  ],
  phone: "+971 2 632 2223",
  whatsapp: "+971 50 691 1103",
  email: "info@bazarrealestate.ae",
  address: "Al Bateen, Abu Dhabi",
  address_ar: "البطين، أبوظبي",
  legal: "© 2026 Bazar Real Estate L.L.C. · ORN:28209",
  legal_ar: "© 2026 بازار العقارية ذ.م.م. · ORN:28209",
};

const img = (n: number) => ({ url: `https://cdn.example.com/${n}.jpg`, key: null, alt: "" });
const project: LaunchProject = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "jw-marriott-residences",
  name: "JW Marriott Residences",
  name_ar: "مساكن جي دبليو ماريوت",
  area: "Yas Island",
  area_ar: "جزيرة ياس",
  developer: "Taraf",
  developer_ar: "طرف",
  tagline: "Apartments on Yas Island",
  tagline_ar: "شقق في جزيرة ياس",
  bedrooms: "1 - 4",
  bedrooms_ar: "١ - ٤",
  handover: "Q3 2030",
  handover_ar: "الربع 3 2030",
  hero: img(0),
  features: [1, 2, 3, 4, 5].map((n) => ({
    title: `Feature ${n}`,
    title_ar: `ميزة ${n}`,
    copy: `A sentence about feature ${n}. And another one.`,
    copy_ar: `جملة عن الميزة ${n}.`,
    image: img(n),
  })),
  amenities: [],
  amenities_ar: [],
};

const ctx = (locale: "en" | "ar" = "en"): DesignRenderContext => ({
  locale,
  brand: DEFAULT_EMAIL_BRAND,
  siteUrl: "https://www.bazarrealestate.ae",
  values: { unsubscribe_url: "https://www.bazarrealestate.ae/newsletter/unsubscribe/tok", site_url: "https://www.bazarrealestate.ae" },
  subject: "Subject",
  footer: { html: 'Bye. <a href="https://u">Unsubscribe</a>', text: "Bye. https://u" },
});

describe("block catalogue", () => {
  it("has a preset for every block, and every preset names a real block", () => {
    for (const def of BLOCKS) expect(PRESETS.some((p) => p.type === def.type), def.type).toBe(true);
    for (const p of PRESETS) expect(blockDef(p.type), p.id).toBeDefined();
    expect(PRESETS.length).toBeGreaterThanOrEqual(50);
  });

  it("renders every preset in English and Arabic without throwing, Arabic right to left", () => {
    for (const p of PRESETS) {
      const design = { ...emptyDesign(), blocks: [newBlock(p.type, { ...p.props, image: img(1), photo: img(2), portrait: img(3) })] };
      for (const locale of ["en", "ar"] as const) {
        const out = renderDesign(design, ctx(locale));
        expect(out.html, p.id).toContain("<!doctype html>");
        expect(out.html, p.id).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
        expect(out.text, p.id).toContain("Bye.");
      }
    }
  });

  it("never letter-spaces or upper-cases Arabic (it breaks the joins between letters)", () => {
    const design = launchTemplate(project, site).design;
    const ar = renderDesign(design, ctx("ar")).html;
    expect(ar).not.toMatch(/letter-spacing:0\.1[48]em/);
    expect(ar).not.toContain("text-transform:uppercase");
    expect(ar).toContain("مساكن جي دبليو ماريوت");
  });
});

describe("normaliseDesign", () => {
  it("drops unknown blocks, bad colours, unsafe images and over-long text", () => {
    const d = normaliseDesign({
      settings: { headingColor: "red", buttonColor: "#123abc", headingFont: "comic" },
      blocks: [
        { type: "nope", props: {} },
        { type: "heading", id: "a", props: { heading: "x".repeat(1000), textColor: "javascript:alert(1)", size: "huge" } },
        { type: "image", id: "a", props: { image: { url: "http://insecure/x.png" } } },
      ],
    });
    expect(d.blocks.map((b) => b.type)).toEqual(["heading", "image"]);
    expect(d.blocks[0]!.props.heading).toHaveLength(300);
    expect(d.blocks[0]!.props.textColor).toBe("");
    expect(d.blocks[0]!.props.size).toBe("l");
    expect(d.blocks[1]!.props.image).toBeNull();
    expect(d.blocks[0]!.id).not.toBe(d.blocks[1]!.id);
    expect(d.settings.headingColor).toBe("#003452");
    expect(d.settings.buttonColor).toBe("#123ABC");
    expect(d.settings.headingFont).toBe("serif");
  });
});

describe("renderDesign", () => {
  it("escapes words and draws an unsafe link as plain text", () => {
    const design = {
      ...emptyDesign(),
      blocks: [
        newBlock("text", { text: '<script>x</script> **bold** [ok](/contact) [bad](javascript:alert(1))' }),
        newBlock("button", { label: "Go", url: "javascript:alert(1)" }),
      ],
    };
    const html = renderDesign(design, ctx()).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://www.bazarrealestate.ae/contact"');
    expect(html).not.toContain("javascript:");
  });

  it("points site links at the /ar pages in the Arabic edition, and fills tokens", () => {
    expect(href("/off-plan", ctx("ar"))).toBe("https://www.bazarrealestate.ae/ar/off-plan");
    expect(href("/", ctx("ar"))).toBe("https://www.bazarrealestate.ae/ar");
    expect(href("/off-plan", ctx("en"))).toBe("https://www.bazarrealestate.ae/off-plan");
    expect(href("{{unsubscribe_url}}", ctx())).toBe("https://www.bazarrealestate.ae/newsletter/unsubscribe/tok");
    expect(href("mailto:a@b.com", ctx())).toBe("mailto:a@b.com");
    expect(href("//evil.com", ctx())).toBeNull();
    expect(isUsableLink("javascript:x")).toBe(false);
    expect(isUsableLink("/contact")).toBe(true);
  });

  it("always ends with the newsletter's footer, whatever the design", () => {
    const out = renderDesign(emptyDesign(), ctx());
    expect(out.html).toContain("Unsubscribe");
  });
});

describe("built-in templates", () => {
  it("lists every template, and each renders in both languages", () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    const picks = { property: [], development: [], article: [] };
    for (const t of BUILT_IN_TEMPLATES) {
      const draft = t.id === "launch" ? launchTemplate(project, site) : staticTemplate(t.id, site, picks);
      for (const locale of ["en", "ar"] as const) expect(renderDesign(draft.design, ctx(locale)).html).toContain("</html>");
    }
  });

  it("builds the launch mailer from the project: hero, features, glance, closing ask, footer", () => {
    const { design, subject, subject_ar } = launchTemplate(project, site);
    expect(subject).toContain("JW Marriott Residences");
    expect(subject_ar).toContain("مساكن جي دبليو ماريوت");
    expect(design.blocks.map((b) => b.type)).toEqual(
      expect.arrayContaining(["hero", "section", "image", "features", "chips", "list", "key_values", "cta_band", "social", "contact"]),
    );
    const html = renderDesign(design, ctx()).html;
    expect(html).toContain("/developments/jw-marriott-residences");
    expect(html).toContain("/email/bazar-logo-white.png");
    expect(html).toContain("Feature 1");
    expect(html).not.toMatch(/PSI|Property Shop|Marriott International/);
  });
});

describe("block-built campaigns", () => {
  const base = (over: Partial<CampaignDraft> = {}): CampaignDraft => ({
    format: "blocks",
    design: launchTemplate(project, site).design,
    subject: "Launch",
    preheader: "",
    body: "",
    subject_ar: "",
    preheader_ar: "",
    body_ar: "",
    audience: "all",
    list_ids: [],
    ...over,
  });

  it("has an Arabic edition once the Arabic subject is written, and then wants every text's Arabic", () => {
    expect(hasArabicEdition(base())).toBe(false);
    expect(campaignProblems(base())).toEqual({});
    const stripped = withoutArabic(base().design!);
    const problems = campaignProblems(base({ subject_ar: "إطلاق", design: stripped }));
    expect(problems.body_ar).toMatch(/no Arabic yet/);
    const slots = textSlots(stripped);
    const filled = withArabic(stripped, new Map(slots.map((s) => [s, `ع ${s.en}`])));
    expect(campaignProblems(base({ subject_ar: "إطلاق", design: filled })).body_ar).toBeUndefined();
  });

  it("blocks sending an empty design, a template placeholder or a link an inbox can't follow", () => {
    expect(campaignProblems(base({ design: emptyDesign() })).body).toMatch(/at least one block/);
    const placeholder = { ...emptyDesign(), blocks: [newBlock("text", { text: "[Write the intro.]" })] };
    expect(campaignProblems(base({ design: placeholder })).body).toMatch(/brackets/);
    const bad = { ...emptyDesign(), blocks: [newBlock("button", { url: "javascript:alert(1)" })] };
    expect(campaignProblems(base({ design: bad })).body).toMatch(/isn't a link/);
    const link = { ...emptyDesign(), blocks: [newBlock("text", { text: "See [our page](/contact)." })] };
    expect(campaignProblems(base({ design: link }))).toEqual({});
  });

  it("renders through renderNewsletter with the preview line and the unsubscribe link", () => {
    const email = renderNewsletter(base({ preheader: "First access" }), {
      brand: DEFAULT_EMAIL_BRAND,
      locale: "en",
      unsubscribeUrl: "https://www.bazarrealestate.ae/newsletter/unsubscribe/abc",
    });
    expect(email.subject).toBe("Launch");
    expect(email.html).toContain("First access");
    expect(email.html).toContain("/newsletter/unsubscribe/abc");
    expect(email.text).toContain("/newsletter/unsubscribe/abc");
  });

  it("reads featured records out of a design as the shared feature tags", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const design = { ...emptyDesign(), blocks: [newBlock("records", { records: { kind: "property", ids: [id], labels: [""], layout: "grid" } })] };
    expect(designFeatureHtml(design)).toContain(`data-ids="${id}"`);
  });
});

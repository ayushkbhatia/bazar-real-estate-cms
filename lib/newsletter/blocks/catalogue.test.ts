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
import { href, renderDesign, scaleForPhones, type DesignRenderContext } from "./render";
import { BUILT_IN_TEMPLATES, isProjectTemplate, launchTemplate, staticTemplate, type LaunchProject, type SiteFooter } from "./templates";
import { showcaseTemplate } from "./showcase";

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
  description: "",
  description_ar: "",
  startingPrice: null,
  paymentPlan: null,
  unitTypes: [],
  developerLogo: null,
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
    const presets = { ...emptyDesign(), blocks: PRESETS.map((p) => newBlock(p.type, p.props)) };
    for (const design of [launchTemplate(project, site).design, showcaseTemplate(project, site).design, presets]) {
      const ar = renderDesign(design, ctx("ar")).html;
      expect(ar).not.toMatch(/letter-spacing:0\.\d+em/);
      expect(ar).not.toContain("text-transform:uppercase");
    }
    expect(renderDesign(launchTemplate(project, site).design, ctx("ar")).html).toContain("مساكن جي دبليو ماريوت");
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

  it("runs an opening hero to the top edge, with no band of page colour above it", () => {
    const opener = (type: string) => renderDesign({ ...emptyDesign(), blocks: [newBlock(type)] }, ctx()).html;
    expect(opener("hero")).toContain('style="padding:0px 0 24px"');
    expect(opener("text")).toContain('style="padding:24px 0 24px"');
  });

  it("puts a wide hero's headline at the bottom of the photo, the logos at the top", () => {
    const hero = (props: Record<string, unknown>) =>
      renderDesign({ ...emptyDesign(), blocks: [newBlock("hero", { image: img(0), projectLogo: img(1), heading: "NEW LAUNCH", ...props })] }, ctx()).html;
    const wide = hero({ shape: "wide" });
    expect(wide).toMatch(/valign="top"[^>]*>[\s\S]*<\/td><\/tr><tr><td[^>]*valign="bottom"[^>]*>[\s\S]*NEW LAUNCH/);
    expect(wide).toContain('height="450"');
    expect(hero({ shape: "wide", textPosition: "middle" })).toContain('height="300"');
    expect(hero({})).not.toContain('valign="bottom"');
  });

  it("sets the headline beside a bottom-corner logo, level with it", () => {
    const html = renderDesign(
      { ...emptyDesign(), blocks: [newBlock("hero", { image: img(0), shape: "wide", logo: "white", logoPosition: "bottom", logoWidth: 70, heading: "NEW LAUNCH", note: "" })] },
      ctx(),
    ).html;
    // One row: the logo's cell, then the words' cell, then the balancing spacer.
    expect(html).toMatch(/<td width="70" valign="bottom"[^>]*><img[^>]*><\/td><td valign="bottom" align="center"[^>]*>[\s\S]*NEW LAUNCH[\s\S]*?<\/td><td width="70"/);
    expect(launchTemplate(project, site).design.blocks[0].props.note).toBe("");
  });

  it("draws the desktop email smaller on a phone: every pixel size scaled by the phone's width over 600", () => {
    const html = renderDesign(launchTemplate(project, site).design, ctx()).html;
    // No stacking: nothing is turned into a block on a phone.
    expect(html).not.toMatch(/@media[^{]*max-width[^{]*\{[^@]*display:block/);
    const step = (max: number) => new RegExp(`@media only screen and \\(max-width:${max}px\\)\\{([^\\n]*)\\}`).exec(html)?.[1] ?? "";
    // The hero's 42px headline: 42 × 390/600 = 27.3 at a 390–413px phone, × 320/600 = 22.4 at the smallest.
    const h1 = /<h1 [^>]*class="([^"]*)"/.exec(html)?.[1].split(" ") ?? [];
    const sized = (css: string, px: string) => new RegExp(`\\.(z[0-9a-z]+)\\{font-size:${px}px!important\\}`).exec(css)?.[1];
    expect(h1).toContain(sized(step(413), "27.3"));
    expect(h1).toContain(sized(step(359), "22.4"));
    // A 4:3 band, 450px tall, keeps its shape: 292.5px at 390.
    expect(step(413)).toContain("{height:292.5px!important}");
  });

  it("scales padding shorthands value by value and leaves percentages and max-widths alone", () => {
    const { html, css } = scaleForPhones('<td style="padding:28px 40px 0;width:100%;max-width:600px;font-size:15px;line-height:1.6">x</td>');
    expect(html).toBe('<td style="padding:28px 40px 0;width:100%;max-width:600px;font-size:15px;line-height:1.6" class="z0 z1">x</td>');
    expect(css).toContain("@media only screen and (max-width:389px){.z0{padding:17.5px 25px 0!important}.z1{font-size:9.4px!important}}");
    expect(css).not.toMatch(/\{max-width:/);
    expect(css.match(/@media/g)).toHaveLength(8);
  });

  it("is a fluid column — 100% up to 600px — with a fixed 600px table only for Outlook for Windows", () => {
    const html = renderDesign(emptyDesign(), ctx()).html;
    expect(html).toContain("width:100%;max-width:600px");
    expect(html).not.toMatch(/style="width:600px/);
    expect(html).toContain('<!--[if mso]><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"');
  });

  it("locks its colours against dark mode, in a <style> element of their own", () => {
    const design = { ...emptyDesign(), blocks: [newBlock("text", { text: "Hello", textColor: "#003452", background: "#F0E1D2" })] };
    const html = renderDesign(design, ctx()).html;
    expect(html).toContain('<meta name="color-scheme" content="light only">');
    expect(html).toMatch(/<td class="px[^"]*\bdk-bf0e1d2"[^>]*bgcolor="#F0E1D2"/);
    expect(html).toMatch(/<p style="[^"]*color:#003452[^"]*" class="[^"]*\bdk-c003452">/);
    const [, base, locks] = /<style>([\s\S]*?)<\/style><style>([\s\S]*?)<\/style>/.exec(html) ?? [];
    expect(base).not.toContain("data-og");
    expect(locks).toContain(":root{color-scheme:light only");
    expect(locks).toContain("[data-ogsc] .dk-c003452,.dk-c003452[data-ogsc]{color:#003452!important}");
    expect(locks).toContain("[data-ogsb] .dk-bf0e1d2,.dk-bf0e1d2[data-ogsb]{background-color:#f0e1d2!important}");
    expect(locks).toContain("@media (prefers-color-scheme:dark){");
  });
});

describe("built-in templates", () => {
  it("lists every template, and each renders in both languages", () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    const picks = { property: [], development: [], article: [] };
    for (const t of BUILT_IN_TEMPLATES) {
      const draft = isProjectTemplate(t.id)
        ? (t.id === "showcase" ? showcaseTemplate : launchTemplate)(project, site)
        : staticTemplate(t.id, site, picks);
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
    expect(html).toContain("/email/bazar-logo-white.png");
    expect(html).toContain("Feature 1");
    expect(html).not.toMatch(/PSI|Property Shop|Marriott International/);
  });

  it("sends both of the launch mailer's asks to the project's sign-up page, in each language's own site", () => {
    const { design } = launchTemplate(project, site);
    const asks = design.blocks.flatMap((b) => [b.props.buttonUrl, b.props.primaryUrl]).filter(Boolean);
    expect(asks).toEqual(["/developments/jw-marriott-residences/register", "/developments/jw-marriott-residences/register"]);
    const en = renderDesign(design, ctx()).html;
    const ar = renderDesign(design, ctx("ar")).html;
    expect(en).toContain('href="https://www.bazarrealestate.ae/developments/jw-marriott-residences/register"');
    expect(ar).toContain('href="https://www.bazarrealestate.ae/ar/developments/jw-marriott-residences/register"');
    expect(en).not.toMatch(/href="[^"]*\/developments\/jw-marriott-residences"/);
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
    from_name: "",
    from_name_ar: "",
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

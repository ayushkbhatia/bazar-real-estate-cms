import { describe, it, expect } from "vitest";
import {
  ACCENT_TOKENS,
  ACCENT_TOKEN_HEX,
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_LABEL,
  HERO_VARIANTS,
  HERO_VARIANT_DESCRIPTION,
  HERO_VARIANT_LABEL,
  LOGO_STYLES,
  LOGO_STYLE_DESCRIPTION,
  LOGO_STYLE_LABEL,
  brandSettingsSchema,
  displaySettingsSchema,
  emailTemplateOverrideSchema,
  emailTemplatesSchema,
  leadRoutingRuleSchema,
  leadRoutingSettingsSchema,
  mortgageSettingsSchema,
  parseMortgageSettings,
  MORTGAGE_SETTINGS_DEFAULTS,
} from "./site-settings";
import { toMortgageAssumptions } from "@/lib/queries/site-settings";
import { DEFAULT_MORTGAGE_ASSUMPTIONS } from "@/lib/mortgage";

describe("brandSettingsSchema", () => {
  it("accepts a minimal payload (just name)", () => {
    const r = brandSettingsSchema.safeParse({ brand_name: "Bazar" });
    expect(r.success).toBe(true);
  });

  it("coerces empty-string contact_email to null", () => {
    const r = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      contact_email: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.contact_email).toBeNull();
  });

  it("rejects an invalid contact_email", () => {
    const r = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      contact_email: "not-an-email",
    });
    expect(r.success).toBe(false);
  });

  it("trims brand_name", () => {
    const r = brandSettingsSchema.safeParse({ brand_name: "  Bazar  " });
    expect(r.success && r.data.brand_name).toBe("Bazar");
  });

  it("coerces an empty logo_url to null", () => {
    const r = brandSettingsSchema.safeParse({ brand_name: "Bazar", logo_url: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.logo_url).toBeNull();
  });

  it("accepts an absolute logo URL and a same-origin path", () => {
    for (const logo_url of [
      "https://cdn.example.com/logo.png",
      "/brand/logo.png",
    ]) {
      const r = brandSettingsSchema.safeParse({ brand_name: "Bazar", logo_url });
      expect(r.success).toBe(true);
    }
  });

  it("rejects a logo_url that is neither http(s) nor a path", () => {
    // `javascript:` is the one that matters — the value lands in an <img src>.
    for (const logo_url of [
      "javascript:alert(1)",
      "data:image/svg+xml;base64,AAAA",
      "cdn.example.com/logo.png",
    ]) {
      const r = brandSettingsSchema.safeParse({ brand_name: "Bazar", logo_url });
      expect(r.success).toBe(false);
    }
  });

  it("validates favicon_url on the same rules as logo_url", () => {
    const ok = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      favicon_url: "https://cdn.example.com/icon.png",
    });
    expect(ok.success).toBe(true);

    const cleared = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      favicon_url: "",
    });
    expect(cleared.success && cleared.data.favicon_url).toBeNull();

    // The favicon URL is emitted into <link rel="icon"> in the root layout.
    const bad = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      favicon_url: "javascript:alert(1)",
    });
    expect(bad.success).toBe(false);
  });

  it("validates footer_logo_url on the same rules as logo_url", () => {
    const ok = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      footer_logo_url: "https://cdn.example.com/logo-reversed.png",
    });
    expect(ok.success).toBe(true);

    const cleared = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      footer_logo_url: "",
    });
    expect(cleared.success && cleared.data.footer_logo_url).toBeNull();

    // Lands in an <img src> in the public footer, so the same scheme guard
    // that protects the top bar applies here.
    const bad = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      footer_logo_url: "javascript:alert(1)",
    });
    expect(bad.success).toBe(false);
  });

  it("validates search_logo_url on the same rules as logo_url", () => {
    const ok = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      search_logo_url: "https://cdn.example.com/search-mark.png",
    });
    expect(ok.success).toBe(true);

    const cleared = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      search_logo_url: "",
    });
    expect(cleared.success && cleared.data.search_logo_url).toBeNull();

    // Lands in a <link rel="icon"> and in the Organization JSON-LD `logo`.
    const bad = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      search_logo_url: "javascript:alert(1)",
    });
    expect(bad.success).toBe(false);
  });

  it("accepts both logo styles and rejects anything else", () => {
    for (const logo_style of LOGO_STYLES) {
      const r = brandSettingsSchema.safeParse({ brand_name: "Bazar", logo_style });
      expect(r.success).toBe(true);
    }
    const bad = brandSettingsSchema.safeParse({
      brand_name: "Bazar",
      logo_style: "stacked",
    });
    expect(bad.success).toBe(false);
  });

  it("logo style labels + descriptions cover every style", () => {
    for (const s of LOGO_STYLES) {
      expect(LOGO_STYLE_LABEL[s].length).toBeGreaterThan(2);
      expect(LOGO_STYLE_DESCRIPTION[s].length).toBeGreaterThan(10);
    }
  });
});

describe("displaySettingsSchema", () => {
  it("rejects an unknown hero variant", () => {
    const r = displaySettingsSchema.safeParse({
      hero_variant: "carousel",
      accent_token: "moss",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown accent token", () => {
    const r = displaySettingsSchema.safeParse({
      hero_variant: "fullbleed",
      accent_token: "neon",
    });
    expect(r.success).toBe(false);
  });

  it("accepts all four hero variants", () => {
    for (const v of HERO_VARIANTS) {
      const r = displaySettingsSchema.safeParse({
        hero_variant: v,
        accent_token: "moss",
      });
      expect(r.success).toBe(true);
    }
  });

  it("variant labels + descriptions cover every variant", () => {
    for (const v of HERO_VARIANTS) {
      expect(HERO_VARIANT_LABEL[v].length).toBeGreaterThan(2);
      expect(HERO_VARIANT_DESCRIPTION[v].length).toBeGreaterThan(10);
    }
  });

  it("accent_token hex map covers every token", () => {
    for (const t of ACCENT_TOKENS) {
      expect(ACCENT_TOKEN_HEX[t]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("leadRoutingRuleSchema + leadRoutingSettingsSchema", () => {
  it("accepts a valid rule", () => {
    const r = leadRoutingRuleSchema.safeParse({
      area_slug: "saadiyat-island",
      agent_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-uuid agent id", () => {
    const r = leadRoutingRuleSchema.safeParse({
      area_slug: "saadiyat-island",
      agent_id: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("allows fallback_agent_id to be empty (coerced to null)", () => {
    const r = leadRoutingSettingsSchema.safeParse({
      rules: [],
      fallback_agent_id: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fallback_agent_id).toBeNull();
  });

  it("caps rules at 40", () => {
    const rules = Array.from({ length: 41 }, () => ({
      area_slug: "x",
      agent_id: "550e8400-e29b-41d4-a716-446655440000",
    }));
    const r = leadRoutingSettingsSchema.safeParse({
      rules,
      fallback_agent_id: null,
    });
    expect(r.success).toBe(false);
  });
});

describe("emailTemplateOverrideSchema", () => {
  it("requires a string subject + body", () => {
    const ok = emailTemplateOverrideSchema.safeParse({
      subject: "Welcome",
      body: "Hello",
    });
    expect(ok.success).toBe(true);
    const bad = emailTemplateOverrideSchema.safeParse({ subject: 1, body: 2 });
    expect(bad.success).toBe(false);
  });

  it("rejects bodies over 8k chars", () => {
    const r = emailTemplateOverrideSchema.safeParse({
      subject: "X",
      body: "a".repeat(8001),
    });
    expect(r.success).toBe(false);
  });
});

describe("emailTemplatesSchema record", () => {
  it("accepts an empty overrides map", () => {
    const r = emailTemplatesSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("validates each entry against the override schema", () => {
    const r = emailTemplatesSchema.safeParse({
      enquiry_auto_reply: { subject: "Hi", body: "Body" },
    });
    expect(r.success).toBe(true);
    const bad = emailTemplatesSchema.safeParse({
      enquiry_auto_reply: { subject: 1, body: 2 },
    });
    expect(bad.success).toBe(false);
  });
});

describe("EMAIL_TEMPLATE_KEYS / LABEL", () => {
  it("every key has a human label", () => {
    for (const k of EMAIL_TEMPLATE_KEYS) {
      expect(EMAIL_TEMPLATE_LABEL[k].length).toBeGreaterThan(2);
    }
  });
});

describe("mortgageSettingsSchema", () => {
  it("accepts the built-in figures", () => {
    expect(mortgageSettingsSchema.safeParse(MORTGAGE_SETTINGS_DEFAULTS).success).toBe(
      true,
    );
  });

  it("fills a partial bag from the defaults rather than failing whole", () => {
    // The shape a column written before a field existed has. Parsing it bare
    // would fail, and a failed parse reverts every figure beside the one that
    // is missing.
    const parsed = parseMortgageSettings({ dld_transfer_pct: 5 });
    expect(parsed.dld_transfer_pct).toBe(5);
    expect(parsed.trustee_office_fee_aed).toBe(
      MORTGAGE_SETTINGS_DEFAULTS.trustee_office_fee_aed,
    );
  });

  it("falls back whole when a stored value is out of range", () => {
    // Not a partial application: a bag carrying a negative fee is a bag we
    // cannot reason about, and half-applying it puts figures on the page that
    // no one typed.
    expect(parseMortgageSettings({ dld_transfer_pct: -1 })).toEqual(
      MORTGAGE_SETTINGS_DEFAULTS,
    );
  });

  it.each([null, undefined, "nonsense", []])(
    "treats %p as an empty bag",
    (raw) => {
      expect(parseMortgageSettings(raw)).toEqual(MORTGAGE_SETTINGS_DEFAULTS);
    },
  );

  it("rejects a comfort line above the cap", () => {
    const r = mortgageSettingsSchema.safeParse({
      ...MORTGAGE_SETTINGS_DEFAULTS,
      dbr_comfortable_pct: 60,
      dbr_max_pct: 50,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a higher LTV tier that asks for less than the standard one", () => {
    const r = mortgageSettingsSchema.safeParse({
      ...MORTGAGE_SETTINGS_DEFAULTS,
      min_down_resident_pct: 40,
      min_down_resident_high_pct: 35,
    });
    expect(r.success).toBe(false);
  });
});

describe("toMortgageAssumptions", () => {
  /**
   * The one invariant holding the two copies of these figures together: the
   * settings defaults are the model's defaults in percent. If someone edits
   * one and not the other, an install that has never opened the settings form
   * computes differently from one that opened it and pressed Save without
   * changing anything.
   */
  it("turns the built-in settings back into the model's own defaults", () => {
    expect(toMortgageAssumptions(MORTGAGE_SETTINGS_DEFAULTS)).toEqual(
      DEFAULT_MORTGAGE_ASSUMPTIONS,
    );
  });

  it("reads percentages as percent, not fractions", () => {
    const a = toMortgageAssumptions({
      ...MORTGAGE_SETTINGS_DEFAULTS,
      dld_transfer_pct: 4,
    });
    expect(a.dldTransferPct).toBe(0.04);
  });

  it("passes dirham figures through untouched", () => {
    const a = toMortgageAssumptions({
      ...MORTGAGE_SETTINGS_DEFAULTS,
      trustee_office_fee_aed: 4_400,
    });
    expect(a.trusteeOfficeFeeAed).toBe(4_400);
  });
});

import { describe, it, expect } from "vitest";
import {
  ACCENT_TOKENS,
  ACCENT_TOKEN_HEX,
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_LABEL,
  HERO_VARIANTS,
  HERO_VARIANT_DESCRIPTION,
  HERO_VARIANT_LABEL,
  brandSettingsSchema,
  displaySettingsSchema,
  emailTemplateOverrideSchema,
  emailTemplatesSchema,
  leadRoutingRuleSchema,
  leadRoutingSettingsSchema,
} from "./site-settings";

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

import { z } from "zod";
import { uuidLike } from "@/lib/uuid";

export const HERO_VARIANTS = [
  "fullbleed",
  "editorial",
  "map",
  "concierge",
] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export const HERO_VARIANT_LABEL: Record<HeroVariant, string> = {
  fullbleed: "Fullbleed photography",
  editorial: "Editorial split",
  map: "Map-led",
  concierge: "Concierge prompt",
};

export const HERO_VARIANT_DESCRIPTION: Record<HeroVariant, string> = {
  fullbleed: "Edge-to-edge hero image with overlay copy. The default.",
  editorial: "50/50 split — large copy left, single hero photo right.",
  map: "Live mini-map of Abu Dhabi pins above the headline.",
  concierge: "Big concierge-prompt textbox replaces the photo.",
};

export const ACCENT_TOKENS = ["moss", "rust", "sand", "ink"] as const;
export type AccentToken = (typeof ACCENT_TOKENS)[number];

export const ACCENT_TOKEN_HEX: Record<AccentToken, string> = {
  moss: "#005777",
  rust: "#a85a3a",
  sand: "#c8a878",
  ink: "#1a1a1a",
};

/**
 * What the uploaded logo file actually is.
 *
 * A monogram and a finished lockup want opposite treatment in the top bar —
 * one sits beside the "Bazar" wordmark, the other has the name drawn into it
 * already and must replace the text or the name appears twice. The navbar
 * cannot tell them apart from the bytes, so the operator says which.
 */
export const LOGO_STYLES = ["mark_and_name", "logo_only"] as const;
export type LogoStyle = (typeof LOGO_STYLES)[number];

export const LOGO_STYLE_LABEL: Record<LogoStyle, string> = {
  mark_and_name: "Mark + wordmark",
  logo_only: "Logo only",
};

export const LOGO_STYLE_DESCRIPTION: Record<LogoStyle, string> = {
  mark_and_name: "The logo sits to the left of the Bazar wordmark. Best for a square icon or monogram.",
  logo_only: "The logo replaces the Bazar wordmark. Use when the file already contains the name.",
};

/**
 * A stored image reference — a media-library public URL, an external CDN URL,
 * or a same-origin path.
 *
 * Not `z.string().url()`: a path like /brand/logo.png is a legitimate value and
 * fails that check. What matters is that it resolves as an image source and is
 * not a `javascript:` or `data:` payload, since it lands in an `<img src>` and
 * in a `<link rel="icon">`. So the shape is asserted directly. Empty string
 * (the "cleared" state the select emits) becomes null.
 */
function assetUrl() {
  return z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .max(600)
        .refine(
          (v) => /^https?:\/\//i.test(v) || v.startsWith("/"),
          "Enter an https:// URL or a path starting with /",
        ),
    ])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
}

/** Brand & identity section. */
export const brandSettingsSchema = z.object({
  brand_name: z.string().trim().min(2).max(80),
  /* Arabic twins. `.optional()` here, unlike the megamenu's required-with-null:
   * this action does a partial UPDATE rather than a delete-and-reinsert, so an
   * omitted key leaves the stored value alone instead of destroying it. Caps
   * are 1.5x their English siblings, matching arMax. */
  brand_name_ar: z.string().trim().max(120).nullable().optional(),
  brand_tagline: z.string().trim().max(160).nullable().optional(),
  brand_tagline_ar: z.string().trim().max(240).nullable().optional(),
  logo_url: assetUrl(),
  favicon_url: assetUrl(),
  // The footer's own lockup. Separate from `logo_url` because the footer is
  // drawn on the ink surface and normally wants the reversed artwork; null
  // keeps the typeset wordmark.
  footer_logo_url: assetUrl(),
  // The square mark search engines draw beside the result. Separate from
  // `favicon_url` because a file authored to survive a 16px tab strip is
  // normally cruder than the one that should stand for the brand in a SERP
  // row or a knowledge panel; null falls back to the favicon, then the logo.
  search_logo_url: assetUrl(),
  // `.optional()` rather than `.default()`: a zod default makes the *input*
  // type optional and the output required, and react-hook-form's resolver
  // types reject that asymmetry. The column is `not null default
  // 'mark_and_name'`, so an omitted value leaves the stored one alone —
  // readers fill the gap from DEFAULTS.
  logo_style: z.enum(LOGO_STYLES).optional(),
  orn: z.string().trim().max(40).nullable().optional(),
  contact_email: z
    .union([z.literal(""), z.string().email("Enter a valid email")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  contact_phone: z.string().trim().max(40).nullable().optional(),
});
export type BrandSettingsInput = z.infer<typeof brandSettingsSchema>;

/** Hero & display section. */
export const displaySettingsSchema = z.object({
  hero_variant: z.enum(HERO_VARIANTS),
  accent_token: z.enum(ACCENT_TOKENS),
});
export type DisplaySettingsInput = z.infer<typeof displaySettingsSchema>;

/** Lead-routing rule: when an enquiry comes from a property in this area,
 *  route it to this agent. The rules array is evaluated top-to-bottom;
 *  first match wins. If no rule matches, the fallback agent gets it. */
export const leadRoutingRuleSchema = z.object({
  area_slug: z.string().min(1).max(80),
  agent_id: uuidLike(),
});

export const leadRoutingSettingsSchema = z.object({
  rules: z.array(leadRoutingRuleSchema).max(40),
  fallback_agent_id: z
    .union([z.literal(""), uuidLike()])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});
export type LeadRoutingSettings = z.infer<typeof leadRoutingSettingsSchema>;
export type LeadRoutingRule = z.infer<typeof leadRoutingRuleSchema>;

/** Email-template overrides. We keep the shape open here — each template
 *  key maps to a { subject, body } override. Concrete keys arrive in
 *  Phase 7 alongside the Resend templates. */
export const emailTemplateOverrideSchema = z.object({
  subject: z.string().max(160),
  body: z.string().max(8000),
});

export const emailTemplatesSchema = z
  .record(z.string(), emailTemplateOverrideSchema)
  .default({});
export type EmailTemplatesOverrides = z.infer<typeof emailTemplatesSchema>;

export const EMAIL_TEMPLATE_KEYS = [
  "enquiry_auto_reply",
  "viewing_confirmation",
  "valuation_request_ack",
  "newsletter_welcome",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export const EMAIL_TEMPLATE_LABEL: Record<EmailTemplateKey, string> = {
  enquiry_auto_reply: "Enquiry auto-reply",
  viewing_confirmation: "Viewing confirmation",
  valuation_request_ack: "Valuation request acknowledgement",
  newsletter_welcome: "Newsletter welcome",
};

/**
 * The mortgage calculator's assumptions — everything /tools/mortgage computes
 * with that the visitor does not type.
 *
 * Percentages are stored as WHOLE PERCENTS here (4 = 4%), not fractions. The
 * model in `lib/mortgage.ts` works in fractions and converts on the way in:
 * an admin typing a fee schedule reads it off a DLD circular in percent, and
 * a field that silently wanted 0.04 is a field that eventually gets 4.
 *
 * Every default matches `DEFAULT_MORTGAGE_ASSUMPTIONS`, plus the four opening
 * values of the calculator's own inputs. Keep the two in step — the model's
 * copy is what renders when this column is empty or fails to parse.
 */
const percent = (max: number) =>
  z
    .number({ message: "Enter a number" })
    .min(0, "Cannot be negative")
    .max(max, `Cannot exceed ${max}%`);
const money = (max: number) =>
  z
    .number({ message: "Enter a number" })
    .int("Whole dirhams")
    .min(0, "Cannot be negative")
    .max(max);

export const mortgageSettingsSchema = z
  .object({
    // ── what the calculator opens on ──
    default_price_aed: money(500_000_000),
    default_down_payment_pct: percent(100),
    default_rate_pct: percent(30),
    default_term_years: z.number().int().min(1).max(40),
    default_annual_income_aed: money(500_000_000),

    // ── cash to close ──
    dld_transfer_pct: percent(25),
    mortgage_registration_pct: percent(25),
    bank_arrangement_pct: percent(25),
    advisory_pct: percent(25),
    trustee_office_fee_aed: money(1_000_000),
    property_valuation_fee_aed: money(1_000_000),
    noc_misc_fee_aed: money(1_000_000),

    // ── Central Bank LTV tiers ──
    ltv_high_tier_price_aed: money(500_000_000),
    min_down_resident_pct: percent(100),
    min_down_resident_high_pct: percent(100),
    min_down_non_resident_pct: percent(100),

    // ── debt-burden ratio ──
    dbr_comfortable_pct: percent(100),
    dbr_max_pct: percent(100),
  })
  /**
   * Two orderings the arithmetic does not enforce but the screen does: a
   * comfort line above the cap paints "stretched" over a band that cannot
   * exist, and a high-tier deposit below the standard one means crossing the
   * five-million threshold asks for *less* money down.
   */
  .refine((v) => v.dbr_comfortable_pct <= v.dbr_max_pct, {
    message: "The comfortable DBR must be at or below the maximum",
    path: ["dbr_comfortable_pct"],
  })
  .refine((v) => v.min_down_resident_pct <= v.min_down_resident_high_pct, {
    message: "The higher tier must ask for at least as much as the standard one",
    path: ["min_down_resident_high_pct"],
  });

export type MortgageSettings = z.infer<typeof mortgageSettingsSchema>;

/**
 * The figures the tool shipped with. Mirrors `DEFAULT_MORTGAGE_ASSUMPTIONS` in
 * lib/mortgage.ts (in percent rather than fractions) plus the calculator's own
 * opening values — keep the two in step.
 *
 * A literal rather than `schema.parse({})` with per-field `.default()`, because
 * a schema whose every key is optional types the form as a bag of `unknown`
 * and hands the editor "expected number, received undefined" instead of a
 * field-level message.
 */
export const MORTGAGE_SETTINGS_DEFAULTS: MortgageSettings = {
  default_price_aed: 4_200_000,
  default_down_payment_pct: 25,
  default_rate_pct: 4.25,
  default_term_years: 25,
  default_annual_income_aed: 950_000,

  dld_transfer_pct: 4,
  mortgage_registration_pct: 0.25,
  bank_arrangement_pct: 1,
  advisory_pct: 1.5,
  trustee_office_fee_aed: 4_200,
  property_valuation_fee_aed: 3_150,
  noc_misc_fee_aed: 5_800,

  ltv_high_tier_price_aed: 5_000_000,
  min_down_resident_pct: 25,
  min_down_resident_high_pct: 35,
  min_down_non_resident_pct: 50,

  dbr_comfortable_pct: 40,
  dbr_max_pct: 50,
};

/**
 * A stored bag, filled out from the defaults before it is validated.
 *
 * The merge is what lets a bag written before a field existed still parse: the
 * alternative — a schema where every key carries its own `.default()` — makes
 * every key optional on the way in, which is exactly the type the admin form
 * cannot be written against.
 */
export function parseMortgageSettings(raw: unknown): MortgageSettings {
  const bag =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const parsed = mortgageSettingsSchema.safeParse({
    ...MORTGAGE_SETTINGS_DEFAULTS,
    ...bag,
  });
  return parsed.success ? parsed.data : MORTGAGE_SETTINGS_DEFAULTS;
}


/** What the route handler returns when reading the singleton row. */
export type SiteSettings = {
  brand: BrandSettingsInput;
  display: DisplaySettingsInput;
  lead_routing: LeadRoutingSettings;
  email_templates: EmailTemplatesOverrides;
};

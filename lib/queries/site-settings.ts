import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
import { type Locale } from "@/lib/i18n/locales";
import {
  brandSettingsSchema,
  displaySettingsSchema,
  emailTemplatesSchema,
  leadRoutingSettingsSchema,
  LOGO_STYLES,
  parseMortgageSettings,
  MORTGAGE_SETTINGS_DEFAULTS,
  type LogoStyle,
  type MortgageSettings,
  type SiteSettings,
} from "@/lib/schemas/site-settings";
import { type MortgageAssumptions } from "@/lib/mortgage";

const DEFAULTS: SiteSettings = {
  brand: {
    brand_name: "Bazar Real Estate",
    // No Arabic default. A hardcoded Arabic wordmark would be a brand decision
    // made in a defaults object; blank falls back to the English in place,
    // which is the site-wide rule.
    brand_name_ar: null,
    brand_tagline: "Abu Dhabi, properly understood.",
    brand_tagline_ar: null,
    logo_url: null,
    logo_style: "mark_and_name",
    favicon_url: null,
    footer_logo_url: null,
    orn: null,
    contact_email: null,
    contact_phone: null,
  },
  display: {
    hero_variant: "fullbleed",
    accent_token: "moss",
  },
  lead_routing: {
    rules: [],
    fallback_agent_id: null,
  },
  email_templates: {},
};

function shape(raw: Record<string, unknown> | null | undefined): SiteSettings {
  if (!raw) return DEFAULTS;
  const brand = brandSettingsSchema.safeParse({
    brand_name: raw.brand_name ?? DEFAULTS.brand.brand_name,
    brand_name_ar: raw.brand_name_ar ?? null,
    brand_tagline: raw.brand_tagline ?? DEFAULTS.brand.brand_tagline,
    brand_tagline_ar: raw.brand_tagline_ar ?? null,
    logo_url: raw.logo_url ?? null,
    logo_style: raw.logo_style ?? DEFAULTS.brand.logo_style,
    favicon_url: raw.favicon_url ?? null,
    footer_logo_url: raw.footer_logo_url ?? null,
    orn: raw.orn ?? null,
    contact_email: raw.contact_email ?? null,
    contact_phone: raw.contact_phone ?? null,
  });
  const display = displaySettingsSchema.safeParse({
    hero_variant: raw.hero_variant ?? DEFAULTS.display.hero_variant,
    accent_token: raw.accent_token ?? DEFAULTS.display.accent_token,
  });
  const lead_routing = leadRoutingSettingsSchema.safeParse(
    raw.lead_routing ?? DEFAULTS.lead_routing,
  );
  const email_templates = emailTemplatesSchema.safeParse(
    raw.email_templates ?? {},
  );
  return {
    brand: brand.success ? brand.data : DEFAULTS.brand,
    display: display.success ? display.data : DEFAULTS.display,
    lead_routing: lead_routing.success
      ? lead_routing.data
      : DEFAULTS.lead_routing,
    email_templates: email_templates.success
      ? email_templates.data
      : DEFAULTS.email_templates,
  };
}

/**
 * Settings → the shape `lib/mortgage.ts` computes with.
 *
 * The only place whole percents become fractions. Doing it once, at the read
 * boundary, is what lets the model stay in fractions (where 1% of a loan is
 * `0.01 * principal` and not a division nobody remembers) while the admin form
 * stays in the units a DLD circular is written in.
 */
export function toMortgageAssumptions(
  settings: MortgageSettings,
): MortgageAssumptions {
  const frac = (p: number) => p / 100;
  return {
    trusteeOfficeFeeAed: settings.trustee_office_fee_aed,
    nocMiscAed: settings.noc_misc_fee_aed,
    propertyValuationAed: settings.property_valuation_fee_aed,
    dldTransferPct: frac(settings.dld_transfer_pct),
    mortgageRegistrationPct: frac(settings.mortgage_registration_pct),
    bankArrangementPct: frac(settings.bank_arrangement_pct),
    bazarAdvisoryPct: frac(settings.advisory_pct),
    ltvHighTierPriceAed: settings.ltv_high_tier_price_aed,
    minDownResidentPct: frac(settings.min_down_resident_pct),
    minDownResidentHighPct: frac(settings.min_down_resident_high_pct),
    minDownNonResidentPct: frac(settings.min_down_non_resident_pct),
    dbrComfortablePct: frac(settings.dbr_comfortable_pct),
    dbrMaxPct: frac(settings.dbr_max_pct),
  };
}

/** Server (RLS-aware) read for /admin pages. */
export async function getSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured) return DEFAULTS;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      "brand_name, brand_name_ar, brand_tagline, brand_tagline_ar, logo_url, logo_style, favicon_url, footer_logo_url, orn, contact_email, contact_phone, hero_variant, accent_token, lead_routing, email_templates",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULTS;
  return shape(data as unknown as Record<string, unknown>);
}

/** The subset of `site_settings` an anon key may read (0096, 0097). */
export type PublicBranding = {
  brand_name: string;
  brand_tagline: string | null;
  logo_url: string | null;
  logo_style: LogoStyle;
  favicon_url: string | null;
  footer_logo_url: string | null;
};

const BRANDING_DEFAULTS: PublicBranding = {
  brand_name: DEFAULTS.brand.brand_name,
  brand_tagline: DEFAULTS.brand.brand_tagline ?? null,
  logo_url: null,
  logo_style: "mark_and_name",
  favicon_url: null,
  footer_logo_url: null,
};

/**
 * Branding for the public chrome — the top bar's logo, above all.
 *
 * Separate from `getPublicSiteSettings` because of what 0096 could safely
 * open up. `site_settings` is one row holding both public copy and internal
 * wiring (`lead_routing` carries staff user ids), and RLS grants rows, not
 * columns — so the anon read is scoped by column grants instead, and asking
 * for an ungranted column is a permission error that fails the *whole* select.
 * This function therefore names only the granted columns. The wide read next
 * to it still asks for `lead_routing`, so under an anon key it still answers
 * from DEFAULTS, exactly as it has since 0010.
 */
export async function getPublicBranding(
  /** Overridable for tests; defaults to the locale of the request. */
  locale?: Locale,
): Promise<PublicBranding> {
  if (!isSupabaseConfigured) return BRANDING_DEFAULTS;
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("site_settings")
      .select(
        "brand_name, brand_name_ar, brand_tagline, brand_tagline_ar, logo_url, logo_style, favicon_url, footer_logo_url",
      )
      .eq("id", 1)
      .maybeSingle();
    if (!data) return BRANDING_DEFAULTS;
    // Folded before anything reads it, so the wordmark component keeps asking
    // for `brand_name` and never learns a twin exists.
    const row = localiseRow(
      data as unknown as Record<string, unknown>,
      locale ?? (await currentLocale()),
    );
    const style = row.logo_style as string | null;
    return {
      brand_name:
        (row.brand_name as string | null) ?? BRANDING_DEFAULTS.brand_name,
      brand_tagline: (row.brand_tagline as string | null) ?? null,
      logo_url: (row.logo_url as string | null) ?? null,
      logo_style: (LOGO_STYLES as readonly string[]).includes(style ?? "")
        ? (style as LogoStyle)
        : "mark_and_name",
      favicon_url: (row.favicon_url as string | null) ?? null,
      footer_logo_url: (row.footer_logo_url as string | null) ?? null,
    };
  } catch {
    return BRANDING_DEFAULTS;
  }
}

/** Public read for the marketplace pages — uses the cookie-free public
 *  client so the homepage stays ISR-eligible. */
export async function getPublicSiteSettings(
  /** Overridable for tests; defaults to the locale of the request. */
  locale?: Locale,
): Promise<SiteSettings> {
  if (!isSupabaseConfigured) return DEFAULTS;
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("site_settings")
      .select(
        "brand_name, brand_name_ar, brand_tagline, brand_tagline_ar, logo_url, logo_style, favicon_url, footer_logo_url, orn, contact_email, contact_phone, hero_variant, accent_token, lead_routing, email_templates",
      )
      .eq("id", 1)
      .maybeSingle();
    if (!data) return shape(null);
    return shape(
      localiseRow(
        data as unknown as Record<string, unknown>,
        locale ?? (await currentLocale()),
      ),
    );
  } catch {
    return DEFAULTS;
  }
}

/**
 * The calculator's settings, for /tools/mortgage.
 *
 * Its own function rather than a field off `getPublicSiteSettings` for the
 * reason 0096 documents above: that read asks for `lead_routing`, which anon
 * may not see, so under the anon key it answers from DEFAULTS every time. This
 * one names only granted columns, so it actually returns what an admin saved.
 *
 * Every failure — no env, no row, a revoked grant, a bag that fails validation
 * — lands on the figures the tool shipped with. A calculator that renders a
 * stale fee is a support ticket; one that renders nothing is a lost lead.
 */
export async function getPublicMortgageSettings(): Promise<MortgageSettings> {
  if (!isSupabaseConfigured) return MORTGAGE_SETTINGS_DEFAULTS;
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("site_settings")
      .select("mortgage")
      .eq("id", 1)
      .maybeSingle();
    return parseMortgageSettings(
      (data as { mortgage?: unknown } | null)?.mortgage,
    );
  } catch {
    return MORTGAGE_SETTINGS_DEFAULTS;
  }
}

/**
 * The same read for /admin/settings/mortgage, through the caller's session so
 * the staff policy applies.
 *
 * A dedicated read rather than a field on `getSiteSettings`, and the reason is
 * the column-grant trap 0096 documents from the other side: a select naming a
 * column that does not exist yet fails WHOLE, so folding `mortgage` into the
 * wide settings read would mean an unapplied 0105 blanked Brand, Routing and
 * Templates too. Scoped like this, the blast radius of a missing migration is
 * the one screen that needs it — which then shows the built-in figures.
 */
export async function getMortgageSettings(): Promise<MortgageSettings> {
  if (!isSupabaseConfigured) return MORTGAGE_SETTINGS_DEFAULTS;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("site_settings")
      .select("mortgage")
      .eq("id", 1)
      .maybeSingle();
    return parseMortgageSettings(
      (data as { mortgage?: unknown } | null)?.mortgage,
    );
  } catch {
    return MORTGAGE_SETTINGS_DEFAULTS;
  }
}

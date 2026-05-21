import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import {
  brandSettingsSchema,
  displaySettingsSchema,
  emailTemplatesSchema,
  leadRoutingSettingsSchema,
  type SiteSettings,
} from "@/lib/schemas/site-settings";

const DEFAULTS: SiteSettings = {
  brand: {
    brand_name: "Bazar Real Estate",
    brand_tagline: "Abu Dhabi, properly understood.",
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
    brand_tagline: raw.brand_tagline ?? DEFAULTS.brand.brand_tagline,
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
    lead_routing: lead_routing.success ? lead_routing.data : DEFAULTS.lead_routing,
    email_templates: email_templates.success
      ? email_templates.data
      : DEFAULTS.email_templates,
  };
}

/** Server (RLS-aware) read for /admin pages. */
export async function getSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured) return DEFAULTS;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      "brand_name, brand_tagline, orn, contact_email, contact_phone, hero_variant, accent_token, lead_routing, email_templates",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULTS;
  return shape(data as unknown as Record<string, unknown>);
}

/** Public read for the marketplace pages — uses the cookie-free public
 *  client so the homepage stays ISR-eligible. */
export async function getPublicSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured) return DEFAULTS;
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("site_settings")
      .select(
        "brand_name, brand_tagline, orn, contact_email, contact_phone, hero_variant, accent_token, lead_routing, email_templates",
      )
      .eq("id", 1)
      .maybeSingle();
    return shape(data as unknown as Record<string, unknown> | null);
  } catch {
    return DEFAULTS;
  }
}

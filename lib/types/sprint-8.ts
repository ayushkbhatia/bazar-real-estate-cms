/**
 * Sprint 8 — type stubs for new tables.
 *
 * These mirror the shape declared in supabase/migrations/0015-0026 SQL.
 * They are not yet in `db/types.ts` because the generator cannot run
 * until a Bazar Supabase project is wired (the connected MCP project
 * belongs to a different app). Once the project is provisioned, run
 * `npm run db:types` and these stubs can be removed — query helpers will
 * pick up the generated types automatically.
 */

// ─────────────────────────────────────────────────────────────────────
// 0015 — referrals
// ─────────────────────────────────────────────────────────────────────
export type ReferralStatus =
  | "pending"
  | "signed_up"
  | "first_deal"
  | "paid"
  | "void";

export type ReferralRow = {
  id: string;
  code: string;
  referrer_account_id: string;
  referee_account_id: string | null;
  status: ReferralStatus;
  payout_amount_aed: number;
  notes: string | null;
  signed_up_at: string | null;
  first_deal_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0016 — recently_viewed
// ─────────────────────────────────────────────────────────────────────
export type RecentlyViewedRow = {
  user_id: string;
  property_id: string;
  viewed_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0017 — tour_requests
// ─────────────────────────────────────────────────────────────────────
export type TourRequestStatus =
  | "pending"
  | "contacted"
  | "scheduled"
  | "completed"
  | "cancelled";

export type TourRequestRow = {
  id: string;
  property_id: string;
  account_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_window: string | null;
  message: string | null;
  status: TourRequestStatus;
  assigned_agent_id: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0018 — area_guides
// ─────────────────────────────────────────────────────────────────────
export type AreaGuideStat = {
  medianApt?: number;
  medianVilla?: number;
  daysOnMarket?: number;
  rentalYield?: number;
  popPerKm2?: number;
  [k: string]: unknown;
};

export type AreaGuideSchool = {
  name: string;
  kind: "school" | "nursery" | "university";
  distance_km: number;
  rating?: number;
};

export type AreaGuideAmenity = {
  name: string;
  kind: "mall" | "park" | "beach" | "metro" | "hospital" | "mosque";
  distance_km: number;
};

export type AreaGuideRow = {
  area_id: string;
  intro_md: string | null;
  stats: AreaGuideStat;
  schools: AreaGuideSchool[];
  amenities: AreaGuideAmenity[];
  related_areas: string[];
  hero_image_id: string | null;
  seo: Record<string, unknown> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0019 — amenities_taxonomy
// ─────────────────────────────────────────────────────────────────────
// Mirrors lib/schemas/amenity-taxonomy.ts AMENITY_CATEGORIES.
export type AmenityCategory =
  | "indoor"
  | "outdoor"
  | "building"
  | "community"
  | "view"
  | "security"
  | "wellness";

export type AmenityTaxonomyRow = {
  code: string;
  label: string;
  category: AmenityCategory;
  icon: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0020 — property_extras (additive columns on properties)
//   bazar_verified, advisor_note, featured_on_homepage, sold_at
// (consumed by lib/queries/properties.ts extensions)
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// 0021 — licenses
// ─────────────────────────────────────────────────────────────────────
export type LicenseKind = "orn" | "brn" | "trakheesi" | "rera" | "dmt";
export type LicenseHolderKind = "firm" | "staff" | "development";
export type LicenseStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "revoked";

export type LicenseRow = {
  id: string;
  kind: LicenseKind;
  holder_kind: LicenseHolderKind;
  holder_id: string | null;
  number: string;
  issued_at: string | null;
  expires_at: string;
  file_id: string | null;
  status: LicenseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0022 — api_keys
// ─────────────────────────────────────────────────────────────────────
export type ApiKeyRole =
  | "read_only"
  | "read_write"
  | "webhook_dispatch"
  | "syndication";

export type ApiKeyStatus = "active" | "revoked";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  role: ApiKeyRole;
  status: ApiKeyStatus;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// 0023 — webhooks
// ─────────────────────────────────────────────────────────────────────
export type WebhookEvent =
  | "property.published"
  | "property.updated"
  | "property.archived"
  | "property.sold"
  | "enquiry.created"
  | "enquiry.assigned"
  | "viewing.scheduled"
  | "viewing.cancelled"
  | "deal.stage_changed"
  | "valuation.submitted"
  | "kyc.approved"
  | "kyc.rejected";

export type WebhookStatus = "active" | "paused" | "failing";

export type WebhookRow = {
  id: string;
  name: string;
  target_url: string;
  events: WebhookEvent[];
  secret: string;
  status: WebhookStatus;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0024 — integrations
// ─────────────────────────────────────────────────────────────────────
export type IntegrationKind =
  | "mapbox"
  | "meilisearch"
  | "voyage_ai"
  | "property_finder"
  | "bayut"
  | "mailchimp"
  | "whatsapp_cloud"
  | "dld_open_data"
  | "docusign"
  | "posthog"
  | "sentry"
  | "resend";

export type IntegrationStatus =
  | "disconnected"
  | "connected"
  | "error"
  | "paused";

export type IntegrationRow = {
  kind: IntegrationKind;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  last_synced_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0025 — roles_custom
// ─────────────────────────────────────────────────────────────────────
export type RolePermissions = Record<string, boolean>;

export type RolesCustomRow = {
  name: string;
  display_name: string;
  description: string | null;
  permissions: RolePermissions;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// 0026 — developer_profiles
// ─────────────────────────────────────────────────────────────────────
export type DeveloperAward = {
  name: string;
  year: number;
  body: string;
};

export type DeveloperProfileRow = {
  developer_id: string;
  bio: string | null;
  founded: number | null;
  headquarters: string | null;
  website: string | null;
  awards: DeveloperAward[];
  signature_styles: string[];
  current_focus: string | null;
  hero_image_id: string | null;
  seo: Record<string, unknown> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

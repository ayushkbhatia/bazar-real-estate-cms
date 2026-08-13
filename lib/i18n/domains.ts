/**
 * Every table in the schema, and what its public text owes Arabic.
 *
 * This is the schema-level counterpart to the Page Builder choke point. A
 * developer who adds a `FieldDef` to a section gets an Arabic twin for free,
 * derived from the field list. A developer who adds a *table* gets nothing —
 * there is no field list to derive from, and the English renders perfectly, so
 * neither the type checker nor any test notices the hole. `domains.test.ts`
 * closes that: a table in `db/types.ts` that appears in neither list below
 * fails the build.
 *
 * `CLAUDE.md` and `docs/I18N.md` have pointed contributors at this file since
 * the epic started. It did not exist until now, which meant step 3 of "I added
 * a new column with public text" was an instruction to edit a missing file.
 *
 * Every entry was traced to the JSX that renders it, and the exclusions were
 * then given to a separate reviewer whose only job was to find a public render
 * path anyway — because a wrong exclusion is the one mistake here that never
 * surfaces. That pass found one: `dld_comparables.property_type`, classified
 * as an internal join key, is printed verbatim in the public transactions
 * table.
 */

/** How a column's Arabic is produced. */
export type Strategy =
  /** A person authors it — curated copy, names, navigation, headings. */
  | "hand"
  /** Safe for the MT pipeline — long prose, alt text. */
  | "machine"
  /** Renders publicly and must NOT be translated. */
  | "never";

export type PublicColumn = {
  column: string;
  strategy: Strategy;
  /** Where a visitor reads it. Kept so a future reader can re-check the claim. */
  evidence: string;
  /**
   * True when the column is a jsonb/array bag and the Arabic lives *inside* it
   * (`meta_title` → `meta_title_ar` within the same object), so there is no
   * `<column>_ar` sibling to look for.
   */
  inBag?: boolean;
  note?: string;
};

export type Domain = {
  table: string;
  /** Columns a visitor can read. Empty means nothing public. */
  columns: PublicColumn[];
  /** Required when `columns` is empty: why this table has no public text. */
  excluded?: string;
};

export const DOMAINS: Domain[] = [
  // ── Catalogue ────────────────────────────────────────────────────────────
  {
    table: "properties",
    columns: [
      { column: "title", strategy: "machine", evidence: "p/[slug]/page.tsx:467" },
      { column: "short_description", strategy: "machine", evidence: "p/[slug]/page.tsx:201" },
      { column: "description", strategy: "machine", evidence: "p/[slug]/page.tsx:532" },
      {
        column: "address_line",
        strategy: "hand",
        evidence: "p/[slug]/page.tsx:586",
        note: "Place-name heavy; a machine pass mangles Abu Dhabi street naming.",
      },
      { column: "view", strategy: "hand", evidence: "p/[slug]/page.tsx:344" },
      { column: "orientation", strategy: "hand", evidence: "p/[slug]/page.tsx:346" },
      { column: "reference", strategy: "never", evidence: "p/[slug]/page.tsx:423" },
      { column: "listing_permit_no", strategy: "never", evidence: "p/[slug]/page.tsx:594" },
      {
        column: "dld_plot_number",
        strategy: "never",
        evidence: "p/[slug]/page.tsx:600",
        note: "Same class as the permit number. Belongs in PROTECTED_FIELDS.",
      },
    ],
  },
  {
    table: "media_assets",
    columns: [
      {
        column: "alt_text",
        strategy: "machine",
        evidence: "p/[slug]/page.tsx:303",
        note: "Highest-volume public string in the schema — ~25 render sites.",
      },
    ],
  },
  {
    table: "areas",
    columns: [
      { column: "name", strategy: "hand", evidence: "areas/[slug]/page.tsx:268" },
      { column: "description", strategy: "hand", evidence: "areas/[slug]/page.tsx:272" },
      {
        column: "seo_meta",
        strategy: "hand",
        evidence: "areas/[slug]/page.tsx:124",
        inBag: true,
        note: "meta_title / meta_description live inside the bag.",
      },
    ],
  },
  {
    table: "area_guides",
    columns: [
      { column: "intro_md", strategy: "hand", evidence: "areas/[slug]/page.tsx:272" },
      {
        column: "amenities",
        strategy: "hand",
        evidence: "areas/[slug]/page.tsx:562",
        inBag: true,
      },
      {
        column: "schools",
        strategy: "hand",
        evidence: "areas/[slug]/page.tsx:525",
        inBag: true,
        note: "Real institution names — a person supplies the official Arabic.",
      },
    ],
  },
  {
    table: "developers",
    columns: [
      { column: "name", strategy: "hand", evidence: "developers/page.tsx:160" },
      { column: "description", strategy: "hand", evidence: "developers/page.tsx:164" },
    ],
  },
  {
    table: "developments",
    columns: [
      { column: "name", strategy: "hand", evidence: "developments/[slug]/page.tsx:753" },
      { column: "tagline", strategy: "hand", evidence: "developments/[slug]/page.tsx:732" },
      { column: "description", strategy: "machine", evidence: "developments/[slug]/page.tsx:760" },
      {
        column: "vision",
        strategy: "machine",
        evidence: "developments/[slug]/page.tsx:361",
        note: "Longest field on the record (4,000 chars) — the shape MT is built for.",
      },
      { column: "bedrooms_text", strategy: "hand", evidence: "developments/[slug]/page.tsx:772" },
      { column: "amenities", strategy: "hand", evidence: "developments/[slug]/page.tsx:560" },
      {
        column: "escrow_account",
        strategy: "never",
        evidence: "_components/development-faq.tsx:134",
        note: "Regulatory-financial identifier inside the RERA escrow answer.",
      },
      { column: "facts", strategy: "hand", evidence: "developments/[slug]/page.tsx:373", inBag: true },
      { column: "master_plan", strategy: "hand", evidence: "developments/[slug]/page.tsx:414", inBag: true },
      { column: "payment_plan", strategy: "hand", evidence: "developments/[slug]/page.tsx:792", inBag: true },
      { column: "meta", strategy: "hand", evidence: "_components/feature-row.tsx:132", inBag: true },
    ],
  },
  {
    table: "development_unit_types",
    columns: [
      { column: "label", strategy: "hand", evidence: "_components/unit-floor-plans.tsx:157" },
      { column: "blurb", strategy: "hand", evidence: "_components/unit-floor-plans.tsx" },
    ],
  },
  {
    table: "floor_plans",
    columns: [
      { column: "label", strategy: "hand", evidence: "_components/unit-floor-plans.tsx" },
      { column: "description", strategy: "hand", evidence: "_components/unit-floor-plans.tsx" },
    ],
  },
  {
    table: "development_units",
    columns: [
      { column: "unit_type", strategy: "hand", evidence: "developments/[slug]/_units-table.tsx" },
      { column: "orientation", strategy: "hand", evidence: "developments/[slug]/_units-table.tsx" },
      { column: "lagoon_access", strategy: "hand", evidence: "developments/[slug]/_units-table.tsx" },
      { column: "plot_number", strategy: "never", evidence: "developments/[slug]/_units-table.tsx" },
    ],
  },
  {
    table: "amenities_taxonomy",
    columns: [{ column: "label", strategy: "hand", evidence: "p/[slug]/page.tsx:545" }],
  },
  {
    table: "dld_comparables",
    columns: [
      {
        column: "property_type",
        strategy: "hand",
        evidence: "market-reports/_components/comparables-table.tsx:76",
        note:
          "Caught by the exclusion review, which is the reason that pass exists — " +
          "the first classification called this an internal join key. It is a " +
          "closed vocabulary arriving from an external feed, so the right fix is " +
          "a value-to-label map rather than an _ar column on imported rows.",
      },
    ],
  },

  // ── Editorial ────────────────────────────────────────────────────────────
  {
    table: "articles",
    columns: [
      { column: "title", strategy: "hand", evidence: "insights/[slug]/page.tsx:164" },
      { column: "excerpt", strategy: "hand", evidence: "insights/[slug]/page.tsx:168" },
      {
        column: "body_html",
        strategy: "machine",
        evidence: "insights/[slug]/page.tsx:231",
        note: "Tiptap HTML — goes through the slot walker in lib/i18n/mt/html.ts.",
      },
      { column: "seo", strategy: "hand", evidence: "insights/[slug]/page.tsx:55", inBag: true },
    ],
  },
  {
    table: "article_categories",
    columns: [
      { column: "label", strategy: "hand", evidence: "insights/category/[cat]/page.tsx:112" },
      { column: "description", strategy: "hand", evidence: "insights/category/[cat]/page.tsx:44" },
    ],
  },
  {
    table: "pages",
    columns: [
      { column: "title", strategy: "hand", evidence: "pages/[slug]/page.tsx:22" },
      {
        column: "blocks",
        strategy: "hand",
        evidence: "pages/[slug]/_block-renderer.tsx:36",
        inBag: true,
        note: "Already covered by the derived twins in lib/master-pages/twins.ts.",
      },
      { column: "seo", strategy: "hand", evidence: "pages/[slug]/page.tsx:22", inBag: true },
    ],
  },
  {
    table: "landing_pages",
    columns: [
      { column: "title", strategy: "hand", evidence: "lp/[slug]/page.tsx:58" },
      {
        column: "blocks",
        strategy: "hand",
        evidence: "lp/[slug]/page.tsx:80",
        inBag: true,
        note: "Covered by the derived twins.",
      },
      { column: "seo", strategy: "hand", evidence: "lp/[slug]/page.tsx:56", inBag: true },
    ],
  },

  // ── Navigation and chrome ────────────────────────────────────────────────
  {
    table: "megamenu_tabs",
    columns: [
      { column: "label", strategy: "hand", evidence: "components/brand/public-mega-nav.tsx:212" },
      { column: "panel_title", strategy: "hand", evidence: "components/brand/megamenu-panel.tsx:212" },
      { column: "right_column_title", strategy: "hand", evidence: "components/brand/megamenu-panel.tsx:270" },
    ],
  },
  {
    table: "megamenu_columns",
    columns: [{ column: "heading", strategy: "hand", evidence: "components/brand/megamenu-panel.tsx:88" }],
  },
  {
    table: "megamenu_items",
    columns: [
      { column: "label", strategy: "hand", evidence: "components/brand/megamenu-panel.tsx:101" },
      { column: "badge_label", strategy: "hand", evidence: "components/brand/megamenu-panel.tsx:58" },
    ],
  },
  {
    table: "megamenu_featured_tiles",
    columns: [
      { column: "headline", strategy: "hand", evidence: "components/brand/megamenu-tile.tsx:126" },
      { column: "badge_label", strategy: "hand", evidence: "components/brand/megamenu-tile.tsx:114" },
      { column: "cta_label", strategy: "hand", evidence: "components/brand/megamenu-tile.tsx:137" },
    ],
  },
  {
    table: "floating_ctas",
    columns: [
      { column: "label", strategy: "hand", evidence: "_components/floating-cta-rail.tsx:14" },
      { column: "message_template", strategy: "hand", evidence: "_components/floating-cta-rail.tsx:17" },
      { column: "subject_template", strategy: "hand", evidence: "_components/floating-cta-rail.tsx:17" },
    ],
  },
  {
    table: "site_settings",
    columns: [
      {
        column: "brand_tagline",
        strategy: "hand",
        evidence: "lib/queries/site-settings.ts:75",
        note:
          "Missed by the first classification pass and caught while wiring the " +
          "twin: it is in the anon grant list of 0096 and in the public select, " +
          "so it renders wherever the resolved settings do.",
      },
      {
        column: "brand_name",
        strategy: "hand",
        evidence: "components/brand/wordmark.tsx:102",
        note:
          "This table has COLUMN-LEVEL grants (0096/0097). A twin added without " +
          "a matching `grant select` fails the whole PostgREST select, and every " +
          "public page silently falls back to code defaults.",
      },
      { column: "contact_phone", strategy: "never", evidence: "services/sell/page.tsx:338" },
    ],
  },

  // ── People and forms ─────────────────────────────────────────────────────
  {
    table: "staff",
    columns: [
      { column: "display_name", strategy: "hand", evidence: "agents/[slug]/page.tsx:147" },
      { column: "title", strategy: "hand", evidence: "agents/[slug]/page.tsx:142" },
      { column: "bio", strategy: "machine", evidence: "agents/[slug]/page.tsx:151" },
      { column: "specialties", strategy: "hand", evidence: "agents/[slug]/page.tsx:241" },
      { column: "languages", strategy: "hand", evidence: "agents/[slug]/page.tsx:251" },
      { column: "brn", strategy: "never", evidence: "agents/[slug]/page.tsx:206" },
      { column: "public_phone", strategy: "never", evidence: "_components/agent-card.tsx" },
      { column: "public_email", strategy: "never", evidence: "_components/agent-card.tsx" },
      { column: "whatsapp", strategy: "never", evidence: "_components/agent-card.tsx" },
    ],
  },
  {
    table: "forms",
    columns: [
      {
        column: "copy",
        strategy: "hand",
        evidence: "_components/forms/form-renderer.tsx",
        inBag: true,
        note:
          "The one surface the choke point does not reach: mergeCopy iterates a " +
          "registry literal with no _ar keys, so Arabic here has to be explicit.",
      },
    ],
  },
  {
    table: "form_fields",
    columns: [
      { column: "label", strategy: "hand", evidence: "_components/forms/form-renderer.tsx" },
      { column: "placeholder", strategy: "hand", evidence: "_components/forms/form-renderer.tsx" },
      {
        column: "help",
        strategy: "hand",
        evidence: "_components/forms/form-renderer.tsx",
        note: "`help` is public copy; `note` on the same table is editor-only.",
      },
      { column: "unit", strategy: "hand", evidence: "_components/forms/form-renderer.tsx" },
      { column: "options", strategy: "hand", evidence: "_components/forms/form-renderer.tsx", inBag: true },
    ],
  },
  {
    table: "reviews",
    columns: [
      { column: "title", strategy: "never", evidence: "agents/[slug]/page.tsx:305" },
      {
        column: "body",
        strategy: "never",
        evidence: "agents/[slug]/page.tsx:310",
        note:
          "Visitor-authored. Presenting a machine translation of a customer's " +
          "words as their words is a misrepresentation, not a quality problem.",
      },
      { column: "author_name", strategy: "never", evidence: "agents/[slug]/page.tsx:314" },
    ],
  },
  {
    table: "newsletter_subscribers",
    columns: [
      {
        column: "email",
        strategy: "never",
        evidence: "newsletter/confirm/[token]/page.tsx",
        note: "The subscriber's own address, echoed back on confirmation.",
      },
    ],
  },

  // ── No public text ───────────────────────────────────────────────────────
  {
    table: "developer_profiles",
    columns: [],
    excluded:
      "Loaded but never rendered. getDeveloperBySlug maps bio/headquarters/current_focus onto DeveloperDetail, and its single consumer reads only name, description, id and logo_url. If the profile band is ever built, these become hand-translated public text.",
  },
  {
    table: "content_assets",
    columns: [],
    excluded:
      "No public read path and no anon select policy (0061). subject/body are advisor outreach copy an agent edits by hand and sends one-to-one. Arabic outreach would be a separate asset row, not an _ar twin.",
  },
  {
    table: "enquiries",
    columns: [],
    excluded:
      "Write-only from the public side; every public reference is an INSERT returning only the id. The one visitor-facing surface is the 1:1 auto-reply, which quotes the enquirer's own words back to them.",
  },
  {
    table: "form_submissions",
    columns: [],
    excluded:
      "Public traffic only writes it — deliberately no anon read policy (lib/forms/record.ts:24). The `data` bag is visitor-authored answers.",
  },
  {
    table: "messages",
    columns: [],
    excluded:
      "No public conversation route exists. Advisor replies reach one visitor as a 1:1 email, authored per message.",
  },
  {
    table: "viewings",
    columns: [],
    excluded: "Internal scheduling. The reminder cron notifies the assigned agent, not the visitor.",
  },
  {
    table: "valuation_requests",
    columns: [],
    excluded:
      "The public tool inserts and reads back only the id; the on-screen estimate comes from the action result. The PDF route is RLS-gated to authenticated staff.",
  },
  {
    table: "mortgage_inquiries",
    columns: [],
    excluded:
      "Dead table — nothing writes it. The save-scenario button still carries an unwired 'Sprint 9 wires this' comment.",
  },
  {
    table: "notifications",
    columns: [],
    excluded: "Staff-only bell. System-generated, read solely by the CMS shell.",
  },
  {
    table: "dsr_requests",
    columns: [],
    excluded: "Compliance audit trail. /data-deleted is static and reads no row.",
  },
  {
    table: "bulk_operations",
    columns: [],
    excluded: "Append-only operations log; remaining text columns are enum-like keys.",
  },
  {
    table: "audit_log",
    columns: [],
    excluded: "Append-only audit trail. action/target_kind are keys, not prose.",
  },
  {
    table: "accounts",
    columns: [],
    excluded: "Dead table — customer accounts were removed (ADR-0005) and nothing reads it.",
  },
  {
    table: "api_keys",
    columns: [],
    excluded: "Staff-only credentials; key_hash and key_prefix are secrets.",
  },
  {
    table: "app_settings",
    columns: [],
    excluded: "Infrastructure key/value store, read only by Postgres functions.",
  },
  {
    table: "concierge_messages",
    columns: [],
    excluded:
      "`content` is write-only — kept for token accounting and never selected back; the client posts history each turn.",
  },
  {
    table: "concierge_sessions",
    columns: [],
    excluded: "anon_token is a cookie token; `brief` is jsonb of filter keys rendered from the taxonomy.",
  },
  {
    table: "integrations",
    columns: [],
    excluded: "Staff-only ops state. last_error is upstream API output, not authored copy.",
  },
  {
    table: "licenses",
    columns: [],
    excluded: "Admin-only. The publicly shown ORN comes from site_settings, not here.",
  },
  {
    table: "otp_codes",
    columns: [],
    excluded: "Security plumbing — hashes, identifiers and request telemetry.",
  },
  {
    table: "property_embeddings",
    columns: [],
    excluded:
      "Vector store. Arabic would come from translating properties.* and re-embedding, not from a twin here.",
  },
  {
    table: "roles_custom",
    columns: [],
    excluded: "Staff permission model with no live reader; labels would be CMS-internal anyway.",
  },
  {
    table: "staff_invitations",
    columns: [],
    excluded:
      "Staff onboarding. /staff-invite sits outside the (public) group — it is the token-gated staff door.",
  },
  {
    table: "webhooks",
    columns: [],
    excluded: "Staff-only integration config; secret and target_url are credentials.",
  },
  {
    table: "conversations",
    columns: [],
    excluded:
      "No text columns at all — three uuid/timestamp columns joining an enquiry to its messages. Listed because the guard enumerates every table, not only the ones that happen to hold text today.",
  },
  {
    table: "property_media",
    columns: [],
    excluded:
      "Join table: property_id, media_id, a role enum and a sort order. The translatable string is media_assets.alt_text, registered there.",
  },
  {
    table: "development_media",
    columns: [],
    excluded:
      "Join table, same shape as property_media. The translatable string is media_assets.alt_text.",
  },
  {
    table: "backup_area_subpages_20260811",
    columns: [],
    excluded: "Dated snapshot table with zero references outside db/types.ts.",
  },
];

/**
 * Columns that need Arabic and do not have it yet — the remaining P7 work,
 * written down rather than remembered.
 *
 * `domains.test.ts` requires every entry to be a registered column that
 * genuinely lacks its twin, so the list cleans itself: add the column and the
 * stale entry fails the build. It cannot silently grow either, because a new
 * unregistered column fails a different assertion.
 */
/* Tracks TWIN COLUMNS, not editor coverage. A column leaves this list when its
 * `_ar` sibling exists in the schema — which is what the guard can check from
 * db/types.ts. Whether a CMS form exposes it is a separate question this list
 * cannot see, and `developers` is currently in exactly that state: columns
 * shipped in 0103, no Arabic inputs yet. Recorded in FOLLOWUPS. */
export const AWAITING_TWIN: string[] = [
  // Migration 0101 added twins for the three MT targets only; these three are
  // hand-authored and still owed one.
  "properties.address_line",
  "properties.view",
  "properties.orientation",
  "area_guides.intro_md",
  "developments.name",
  "developments.tagline",
  "developments.description",
  "developments.vision",
  "developments.bedrooms_text",
  "developments.amenities",
  "development_unit_types.label",
  "development_unit_types.blurb",
  "floor_plans.label",
  "floor_plans.description",
  "development_units.unit_type",
  "development_units.orientation",
  "development_units.lagoon_access",
  "amenities_taxonomy.label",
  "dld_comparables.property_type",
  "articles.title",
  "articles.excerpt",
  "articles.body_html",
  "article_categories.label",
  "article_categories.description",
  "pages.title",
  "landing_pages.title",
  "floating_ctas.label",
  "floating_ctas.message_template",
  "floating_ctas.subject_template",
  "staff.display_name",
  "staff.title",
  "staff.bio",
  "staff.specialties",
  "staff.languages",
  "form_fields.label",
  "form_fields.placeholder",
  "form_fields.help",
  "form_fields.unit",
];

export const domainFor = (table: string): Domain | undefined =>
  DOMAINS.find((d) => d.table === table);

/** Columns needing a translation, in the order a phase would work through them. */
export function translatableColumns(): { table: string; column: string; strategy: Strategy }[] {
  return DOMAINS.flatMap((d) =>
    d.columns
      .filter((c) => c.strategy !== "never")
      .map((c) => ({ table: d.table, column: c.column, strategy: c.strategy })),
  );
}

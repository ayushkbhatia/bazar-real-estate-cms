-- ═══════════════════════════════════════════════════════════════════════
-- 0085 · Foreign-key indexes, and one duplicate index removed
-- ═══════════════════════════════════════════════════════════════════════
--
-- Every foreign key in `public` is ON DELETE SET NULL or CASCADE, which means
-- deleting a parent row scans the child table once per FK. Thirteen of them
-- point at `media_assets`, and deleting a media asset is a real editor action
-- (app/(admin)/admin/media/_actions.ts). Deleting one asset currently costs
-- thirteen sequential scans.
--
-- Nothing here is urgent at today's sizes — the largest child table is
-- `valuation_requests` at a few hundred rows, which scans in well under a
-- millisecond. These are cheap insurance against growth and they make the
-- media-delete fan-out uniformly indexed.
--
-- EXPECT THE ADVISOR COUNT TO GET WORSE, NOT BETTER. Most of these will show
-- up as `unused_index` afterwards: at these row counts the planner still
-- prefers a sequential scan, and that is correct. They exist for the delete
-- path, not for SELECT. Do not "clean them up" later on that basis.
--
-- Plain CREATE INDEX, not CONCURRENTLY: migrations here are applied through
-- the Supabase MCP `apply_migration` tool, which runs the file in a single
-- transaction, and CONCURRENTLY cannot run inside a transaction block. No
-- existing migration in this repo uses it. On tables this size the SHARE lock
-- is held for about a millisecond.
--
-- Three foreign keys are deliberately NOT indexed — api_keys.created_by,
-- webhooks.created_by and roles_custom.created_by. All three tables are empty,
-- their features are dormant, and the parent is auth.users. An index there
-- would never be read.

set local search_path = public, auth, extensions;

-- ── children of media_assets ── the delete fan-out ─────────────────────
create index if not exists area_guides_hero_image_idx
  on public.area_guides (hero_image_id);
create index if not exists areas_hero_image_idx
  on public.areas (hero_image_id);
create index if not exists articles_hero_image_idx
  on public.articles (hero_image_id);
create index if not exists developer_profiles_hero_image_idx
  on public.developer_profiles (hero_image_id);
create index if not exists developers_logo_idx
  on public.developers (logo_id);
create index if not exists development_media_media_idx
  on public.development_media (media_id);
create index if not exists developments_brochure_idx
  on public.developments (brochure_id);
create index if not exists developments_hero_image_idx
  on public.developments (hero_image_id);
create index if not exists developments_masterplan_idx
  on public.developments (masterplan_id);
create index if not exists floor_plans_media_idx
  on public.floor_plans (media_id);
create index if not exists licenses_file_idx
  on public.licenses (file_id);
create index if not exists megamenu_featured_tiles_media_asset_idx
  on public.megamenu_featured_tiles (media_asset_id);
create index if not exists property_media_media_idx
  on public.property_media (media_id);

-- ── children of accounts ── the right-to-erasure path ──────────────────
-- accounts' primary key is user_id, and the DSR erasure flow walks these
-- tables. CASCADE and SET NULL both scan the child.
create index if not exists enquiries_account_idx
  on public.enquiries (account_id);
create index if not exists mortgage_inquiries_account_idx
  on public.mortgage_inquiries (account_id);
create index if not exists reviews_account_idx
  on public.reviews (account_id);
create index if not exists valuation_requests_account_idx
  on public.valuation_requests (account_id);
create index if not exists viewings_account_idx
  on public.viewings (account_id);

-- ── children of staff ──────────────────────────────────────────────────
create index if not exists concierge_sessions_handed_off_to_idx
  on public.concierge_sessions (handed_off_to);
create index if not exists content_assets_created_by_idx
  on public.content_assets (created_by);
create index if not exists developments_lead_advisor_idx
  on public.developments (lead_advisor_id);
create index if not exists mortgage_inquiries_assigned_advisor_idx
  on public.mortgage_inquiries (assigned_advisor_id);
create index if not exists properties_created_by_idx
  on public.properties (created_by);
create index if not exists reviews_moderated_by_idx
  on public.reviews (moderated_by);
create index if not exists site_settings_updated_by_idx
  on public.site_settings (updated_by);

-- ── children of areas / developments / enquiries / floor_plans ─────────
create index if not exists properties_building_idx
  on public.properties (building_id);
create index if not exists properties_sub_community_idx
  on public.properties (sub_community_id);
create index if not exists valuation_requests_area_idx
  on public.valuation_requests (area_id);
create index if not exists enquiries_development_idx
  on public.enquiries (development_id);
create index if not exists properties_development_idx
  on public.properties (development_id);
create index if not exists viewings_enquiry_idx
  on public.viewings (enquiry_id);
create index if not exists development_units_floor_plan_idx
  on public.development_units (floor_plan_id);

-- ── self-reference ─────────────────────────────────────────────────────
create index if not exists content_assets_next_asset_idx
  on public.content_assets (next_asset_id);

-- ── duplicate_index ────────────────────────────────────────────────────
-- property_embeddings carries two byte-identical ivfflat indexes on the same
-- column with the same opclass and lists=100, 1608 kB each — together more
-- than half the table's size, on a table holding no rows yet. Verified
-- identical via pg_get_indexdef; the surviving index has the same definition,
-- so no query plan can change.
--
--   property_embeddings_cosine_idx  — created in 0009, 0 scans
--   property_embeddings_ivfflat     — created in 0028, 1 scan
--
-- 0028 is the later, canonical definition and its index is the one that has
-- been used, so 0009's is the one to drop.
drop index if exists public.property_embeddings_cosine_idx;

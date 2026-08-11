-- ═══════════════════════════════════════════════════════════════════════
-- 0087 · RLS initplan for is_staff() / is_admin() — the hot one
-- ═══════════════════════════════════════════════════════════════════════
--
-- This is where the cost actually is. `is_staff()` is STABLE SECURITY DEFINER,
-- which means Postgres will not inline it. On its own that is fine — the
-- planner reduces a lone `is_staff()` qual to a one-time filter:
--
--   Filter: is_staff()   ->   One-Time Filter: is_staff()
--
-- But that is not the shape in production. Almost every table pairs a broad
-- public-read policy with a staff-everything policy, and RLS ORs permissive
-- policies into a single qual. Once the function is OR'd with a column
-- predicate the one-time optimisation is lost and it runs per row, each call
-- scanning `staff`:
--
--   -- (status='published' AND deleted_at IS NULL) OR is_staff()
--   Seq Scan on public.properties
--     Filter: (((status = 'published') AND (deleted_at IS NULL)) OR is_staff())
--
--   -- ... OR (select is_staff())
--   Seq Scan on public.properties
--     Filter: (((status = 'published') AND (deleted_at IS NULL)) OR (InitPlan 1).col1)
--     InitPlan 1 -> Result: is_staff()
--
-- Measured on this database: `staff` holds 16 rows and has served 788,913
-- sequential scans and 8,786,224 tuple reads — roughly 549,000 full passes of
-- a 16-row table. That is the number this migration exists to remove.
--
-- Same technique and same risk class as 0086: `is_staff()` and `is_admin()`
-- are both STABLE, take no arguments and reference no column, so the scalar
-- subquery is hoisted to a statement-level InitPlan rather than becoming a
-- correlated per-row SubPlan. Every policy keeps its own identity, roles and
-- command; nothing about the security surface changes.
--
-- 58 policies: 47 calling is_staff(), 11 calling is_admin(), no policy calling
-- both. Generated from pg_policies rather than hand-written, then reviewed
-- line by line.
--
-- `audit_log_staff_insert` also carries the `auth.uid()` wrap from 0086. That
-- is deliberate — the statement below applies both, so this migration is
-- correct whether or not 0086 has already run and cannot revert it.
--
-- NOT in scope, deliberately: the 47 `multiple_permissive_policies` warnings.
-- Consolidating those is a security change wearing a performance costume —
-- merging two independently reviewable grants into one boolean is a fresh
-- chance to widen access, and the failure mode is silent. Postgres already ORs
-- permissive policies into one qual, so the saving would be an OR branch.

set local search_path = public, auth, extensions;

alter policy accounts_staff_select on public.accounts
  using ((select is_staff()));

alter policy amenities_taxonomy_staff_select on public.amenities_taxonomy
  using ((select is_staff()));

alter policy amenities_taxonomy_staff_write on public.amenities_taxonomy
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy api_keys_admin_all on public.api_keys
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy app_settings_admin_write on public.app_settings
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy app_settings_staff_read on public.app_settings
  using ((select is_staff()));

alter policy area_guides_staff_select on public.area_guides
  using ((select is_staff()));

alter policy area_guides_staff_write on public.area_guides
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy areas_staff_write on public.areas
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy article_categories_staff_select on public.article_categories
  using ((select is_staff()));

alter policy article_categories_staff_write on public.article_categories
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy articles_staff_all on public.articles
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy audit_log_admin_read on public.audit_log
  using ((select is_admin()));

alter policy audit_log_staff_insert on public.audit_log
  with check (((select is_staff()) AND (actor_id = (select auth.uid())) AND (actor_kind = 'user'::audit_actor_kind)));

alter policy bulk_operations_staff_insert on public.bulk_operations
  with check ((select is_staff()));

alter policy bulk_operations_staff_read on public.bulk_operations
  using ((select is_staff()));

alter policy concierge_messages_staff_select on public.concierge_messages
  using ((select is_staff()));

alter policy concierge_sessions_staff_select on public.concierge_sessions
  using ((select is_staff()));

alter policy content_assets_staff_read on public.content_assets
  using ((select is_staff()));

alter policy conversations_staff_all on public.conversations
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy developer_profiles_staff_select on public.developer_profiles
  using ((select is_staff()));

alter policy developer_profiles_staff_write on public.developer_profiles
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy developers_staff_write on public.developers
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy development_media_staff_write on public.development_media
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy development_unit_types_staff_write on public.development_unit_types
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy development_units_staff_write on public.development_units
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy developments_staff_write on public.developments
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy dld_comparables_staff_write on public.dld_comparables
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy dsr_admin_select on public.dsr_requests
  using ((select is_admin()));

alter policy enquiries_staff_all on public.enquiries
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy floating_ctas_staff_write on public.floating_ctas
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy floor_plans_staff_write on public.floor_plans
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy integrations_admin_all on public.integrations
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy integrations_staff_read on public.integrations
  using ((select is_staff()));

alter policy licenses_admin_write on public.licenses
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy licenses_staff_select on public.licenses
  using ((select is_staff()));

alter policy media_assets_staff_write on public.media_assets
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy megamenu_columns_staff_all on public.megamenu_columns
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy megamenu_featured_tiles_staff_all on public.megamenu_featured_tiles
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy megamenu_items_staff_all on public.megamenu_items
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy megamenu_tabs_staff_all on public.megamenu_tabs
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy messages_staff_all on public.messages
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy mortgage_inquiries_staff_all on public.mortgage_inquiries
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy newsletter_staff_all on public.newsletter_subscribers
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy pages_staff_all on public.pages
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy properties_staff_select on public.properties
  using ((select is_staff()));

alter policy properties_staff_write on public.properties
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy property_media_staff_write on public.property_media
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy reviews_staff_all on public.reviews
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy roles_custom_admin_all on public.roles_custom
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy roles_custom_staff_select on public.roles_custom
  using ((select is_staff()));

alter policy site_settings_admin_write on public.site_settings
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy site_settings_staff_read on public.site_settings
  using ((select is_staff()));

alter policy staff_admin_all on public.staff
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy staff_invitations_admin_all on public.staff_invitations
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy valuation_requests_staff_all on public.valuation_requests
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy viewings_staff_all on public.viewings
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy webhooks_admin_all on public.webhooks
  using ((select is_admin()))
  with check ((select is_admin()));

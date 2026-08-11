-- ═══════════════════════════════════════════════════════════════════════
-- 0086 · RLS initplan — evaluate auth.uid() once per statement
-- ═══════════════════════════════════════════════════════════════════════
--
-- Twenty policies compare a column against a bare `auth.uid()`. Postgres
-- inlines that to a COALESCE over current_setting() and evaluates it once per
-- row. Wrapping it in a scalar subquery turns it into an InitPlan the planner
-- runs once per statement:
--
--   Filter: (account_id = (COALESCE(NULLIF(current_setting(...)))::uuid)
--   Filter: (account_id = (InitPlan 1).col1)
--
-- This is a pure performance rewrite. `auth.uid()` is STABLE and takes no
-- arguments, so its value cannot change within a statement — once and N times
-- agree. It references no column, so the subquery has no outer reference and
-- is hoisted rather than becoming a correlated per-row SubPlan. NULL handling
-- is unchanged: current_setting(..., true) is missing_ok, so anon still gets
-- NULL and still matches nothing. `col = (InitPlan).col1` stays indexable.
--
-- BE CLEAR ABOUT THE BENEFIT: this is advisor hygiene, not a measurable win
-- today. All twenty are `_own` policies from the customer-accounts feature
-- that ADR-0005 removed, and every one of the 16 rows in `accounts` now
-- belongs to a staff member — so `is_staff()` grants access before any of
-- these policies decides anything. Nothing currently exercises them. The
-- policies that are actually hot are the 47 calling `is_staff()` and the 11
-- calling `is_admin()`, which are deliberately left alone here and handled
-- separately.
--
-- ALTER POLICY, not DROP + CREATE: it is atomic, there is no moment where the
-- table is unguarded, and it structurally cannot change the role list, the
-- command or the PERMISSIVE flag — the three things a DROP/CREATE typo would
-- silently widen. The USING / WITH CHECK bodies below are otherwise
-- byte-for-byte the current definitions read from pg_policies.

set local search_path = public, auth, extensions;

-- ── accounts ───────────────────────────────────────────────────────────
alter policy accounts_select_own on public.accounts
  using ((select auth.uid()) = user_id);

alter policy accounts_insert_own on public.accounts
  with check ((select auth.uid()) = user_id);

alter policy accounts_update_own on public.accounts
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── audit_log ──────────────────────────────────────────────────────────
-- is_staff() is left alone here on purpose; it belongs to the helper-function
-- change, not this one.
alter policy audit_log_staff_insert on public.audit_log
  with check (
    is_staff()
    and (actor_id = (select auth.uid()))
    and (actor_kind = 'user'::audit_actor_kind)
  );

-- ── concierge ──────────────────────────────────────────────────────────
alter policy concierge_messages_select_own on public.concierge_messages
  using (exists (
    select 1 from concierge_sessions s
     where s.id = concierge_messages.session_id
       and s.user_id = (select auth.uid())
  ));

alter policy concierge_sessions_select_own on public.concierge_sessions
  using ((select auth.uid()) = user_id);

alter policy concierge_sessions_insert_own on public.concierge_sessions
  with check ((select auth.uid()) = user_id);

alter policy concierge_sessions_update_own on public.concierge_sessions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── enquiry thread ─────────────────────────────────────────────────────
alter policy conversations_own_select on public.conversations
  using (exists (
    select 1 from enquiries e
     where e.id = conversations.enquiry_id
       and e.account_id = (select auth.uid())
  ));

alter policy messages_own_select on public.messages
  using (exists (
    select 1
      from conversations c
      join enquiries e on e.id = c.enquiry_id
     where c.id = messages.conversation_id
       and e.account_id = (select auth.uid())
  ));

alter policy enquiries_own_select on public.enquiries
  using (account_id = (select auth.uid()));

-- ── lead tables keyed on accounts.user_id ──────────────────────────────
alter policy dsr_own_select on public.dsr_requests
  using (account_id = (select auth.uid()));

alter policy mortgage_inquiries_own_select on public.mortgage_inquiries
  using (account_id = (select auth.uid()));

alter policy valuation_requests_own_select on public.valuation_requests
  using (account_id = (select auth.uid()));

alter policy viewings_own_select on public.viewings
  using (account_id = (select auth.uid()));

alter policy newsletter_own_select on public.newsletter_subscribers
  using (account_id = (select auth.uid()));

alter policy newsletter_own_update on public.newsletter_subscribers
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

-- ── notifications ──────────────────────────────────────────────────────
alter policy notifications_select_own on public.notifications
  using ((select auth.uid()) = user_id);

alter policy notifications_update_own on public.notifications
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── licenses ───────────────────────────────────────────────────────────
alter policy licenses_own_select on public.licenses
  using (
    holder_kind = 'staff'::license_holder_kind
    and holder_id = (select auth.uid())
  );

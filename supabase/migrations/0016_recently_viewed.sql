-- 0016_recently_viewed.sql
-- Sprint 8 — recently-viewed history per account.
--
-- Page-view tracking on the /p/[slug] surface. Account sees their own
-- last N entries on /account/saved → Recently viewed tab.
-- Anonymous views aren't tracked here (we'd need a session-cookie pivot).

set local search_path = public, auth, extensions;

create table public.recently_viewed (
  user_id      uuid not null references public.accounts(user_id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  viewed_at    timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index recently_viewed_user_idx       on public.recently_viewed (user_id, viewed_at desc);
create index recently_viewed_property_idx   on public.recently_viewed (property_id);

alter table public.recently_viewed enable row level security;

drop policy if exists recently_viewed_own_select on public.recently_viewed;
create policy recently_viewed_own_select on public.recently_viewed
  for select using (auth.uid() = user_id);

drop policy if exists recently_viewed_own_upsert on public.recently_viewed;
create policy recently_viewed_own_upsert on public.recently_viewed
  for insert with check (auth.uid() = user_id);

drop policy if exists recently_viewed_own_update on public.recently_viewed;
create policy recently_viewed_own_update on public.recently_viewed
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists recently_viewed_own_delete on public.recently_viewed;
create policy recently_viewed_own_delete on public.recently_viewed
  for delete using (auth.uid() = user_id);

drop policy if exists recently_viewed_staff_select on public.recently_viewed;
create policy recently_viewed_staff_select on public.recently_viewed
  for select to authenticated using (public.is_staff());

-- 0025_roles_custom.sql
-- Sprint 8 — optional custom roles beyond the staff_role enum.
--
-- The 5 enum values (admin, editor, agent, marketing, support) cover the
-- common cases. For one-offs (e.g. "consultant" with limited write
-- access) we let admins define custom roles backed by a permissions
-- jsonb. is_staff()/is_admin() continue to read from staff.role; this
-- table is purely additive.

set local search_path = public, auth, extensions;

create table public.roles_custom (
  name         text primary key,         -- snake_case identifier
  display_name text not null,
  description  text,
  permissions  jsonb not null default '{}'::jsonb,
    -- Example: { "properties:read": true, "properties:write": false,
    --           "deals:read": true, "enquiries:assign": true }
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger roles_custom_set_updated_at before update on public.roles_custom
  for each row execute function public.set_updated_at();

alter table public.roles_custom enable row level security;

drop policy if exists roles_custom_admin_all on public.roles_custom;
create policy roles_custom_admin_all on public.roles_custom
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists roles_custom_staff_select on public.roles_custom;
create policy roles_custom_staff_select on public.roles_custom
  for select to authenticated using (public.is_staff());

-- 0022_api_keys.sql
-- Sprint 8 — outbound + inbound API keys for the integrations panel.
--
-- We store HASHED keys only (sha256(key)) — the plaintext is shown once
-- at creation in /admin/settings/api and then never again. Verifying an
-- inbound request hashes the bearer token and compares to key_hash.

set local search_path = public, auth, extensions;

create type public.api_key_role as enum (
  'read_only',
  'read_write',
  'webhook_dispatch',
  'syndication'    -- portals like Property Finder + Bayut
);

create type public.api_key_status as enum (
  'active',
  'revoked'
);

create table public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  key_prefix    text not null,           -- shown in UI, e.g. 'bzk_a1b2c3'
  key_hash      text not null unique,    -- sha256 of full key
  role          public.api_key_role not null,
  status        public.api_key_status not null default 'active',
  last_used_at  timestamptz,
  expires_at    timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

create index api_keys_status_idx     on public.api_keys (status);
create index api_keys_role_idx       on public.api_keys (role);
create index api_keys_last_used_idx  on public.api_keys (last_used_at desc nulls last);

create trigger api_keys_set_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;

-- Admin-only read + write. Hashed keys never leak to non-admin staff.
drop policy if exists api_keys_admin_all on public.api_keys;
create policy api_keys_admin_all on public.api_keys
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

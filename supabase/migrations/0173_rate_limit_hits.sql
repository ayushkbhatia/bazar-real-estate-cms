-- 0173 · A rate limiter that actually runs.
--
-- `lib/rate-limit.ts` has guarded every public form since Sprint 4 and has
-- never limited anything: it is backed by Upstash Redis, no UPSTASH_* variable
-- has ever been set in Vercel, and without them it answers "ok" to every
-- request. On 2 Nov 2026 a bot filed 96 leads through the home page form in a
-- day and nothing counted them.
--
-- This is the fallback it now uses when Upstash isn't configured: one row per
-- accepted request, counted over the caller's window. The key is a SHA-256 of
-- the bucket and the visitor's IP, made in the app, so no address is stored;
-- rows are only ever read within the longest window any caller uses (a day)
-- and are swept after two.
--
-- Only `rate_limit_hit()` touches the table. It runs as its owner and is
-- granted to service_role alone, so the anon key can neither read the table
-- nor spend someone else's budget.

create table if not exists public.rate_limit_hits (
  bucket text not null,
  key_hash text not null,
  hit_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_lookup
  on public.rate_limit_hits (bucket, key_hash, hit_at desc);
create index if not exists rate_limit_hits_age
  on public.rate_limit_hits (hit_at);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

-- Records one request against (bucket, key) and says whether it was allowed:
-- 0 when it was, otherwise the seconds until the oldest request in the window
-- ages out. A refused request is not recorded, so retrying does not push the
-- window further away.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval := make_interval(secs => p_window_seconds);
  v_count integer;
  v_oldest timestamptz;
begin
  -- Two requests from one visitor at the same instant must not both read
  -- "one left" and both get through.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key, 0));

  select count(*), min(hit_at)
    into v_count, v_oldest
    from public.rate_limit_hits
   where bucket = p_bucket
     and key_hash = p_key
     and hit_at > now() - v_window;

  if v_count >= p_limit then
    return greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
  end if;

  insert into public.rate_limit_hits (bucket, key_hash) values (p_bucket, p_key);

  -- Housekeeping on roughly one call in fifty, rather than a cron for it.
  if random() < 0.02 then
    delete from public.rate_limit_hits where hit_at < now() - interval '2 days';
  end if;

  return 0;
end;
$$;

revoke all on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 0109 · Floating CTAs — an admin copy on email, and a record of clicks
-- ═══════════════════════════════════════════════════════════════════════
--
-- Two gaps the rail shipped with:
--
--   1. The email button addresses the page's advisor and nobody else, so a
--      listing enquiry never reaches the office. `cc_destination` is a
--      standing CC applied to every mailto the button builds.
--
--      Worth being precise about what this can and cannot promise: a mailto:
--      link hands a draft to the visitor's own mail client. They can see the
--      CC and delete it, and some mobile clients mishandle multi-recipient
--      mailto. It is a courtesy copy, not an audit trail. `cta_clicks` below
--      is the part that actually records the intent.
--
--   2. Nothing at all was recorded when someone clicked. A wa.me link opens a
--      1:1 chat inside the visitor's own WhatsApp, on the advisor's phone —
--      there is no way to CC that conversation and no way for Bazar to see
--      it. Logging the click is the only recordkeeping available, so that is
--      what this table is.
--
-- `cta_clicks` is deliberately NOT an enquiry. An enquiry has a name and a
-- person behind it; a click has neither, and writing one row per idle tap into
-- `enquiries` would turn the inbox — and every response-time metric read off
-- it — into noise. Promotion to a real enquiry stays a human decision.

set local search_path = public, auth, extensions;

-- ───────────────────────────────────────────────────────────────
-- 1 · Standing CC on the email button
-- ───────────────────────────────────────────────────────────────
alter table public.floating_ctas
  add column if not exists cc_destination text;

comment on column public.floating_ctas.cc_destination is
  'Address added as ?cc= on every mailto this button builds. Visitor-removable — see 0109 header.';

-- ───────────────────────────────────────────────────────────────
-- 2 · The click log
-- ───────────────────────────────────────────────────────────────
-- No IP address, no user agent, no cookie id, nothing that identifies a
-- person. That is a deliberate boundary, not an oversight: it keeps the table
-- outside PDPL's personal-data definition, so it needs no consent gate, no DSR
-- export path and no retention clock. Everything here describes the *button*
-- and the *page*, which is what the office actually wants to count.
create table if not exists public.cta_clicks (
  id             uuid primary key default gen_random_uuid(),
  -- The button. `set null` rather than cascade: deleting a button from the
  -- CMS must not silently delete the history of it being used, so the row
  -- survives on `cta_key` and `kind`.
  cta_id         uuid references public.floating_ctas(id) on delete set null,
  cta_key        text not null,
  kind           text not null check (kind in ('whatsapp', 'call', 'email')),
  -- Where they were.
  path           text not null,
  page_title     text,
  locale         text,
  -- What the button resolved to, and why. `source` answers the question the
  -- office will actually ask — "did this reach the listing's agent, or the
  -- switchboard?" — without re-deriving it from the number.
  destination    text,
  source         text not null default 'cta'
    check (source in ('advisor', 'cta', 'fallback')),
  -- Who it routed to.
  advisor_id     uuid references public.staff(user_id) on delete set null,
  advisor_name   text,
  -- What they were looking at. Both nullable: most pages are neither.
  property_id    uuid references public.properties(id) on delete set null,
  development_id uuid references public.developments(id) on delete set null,
  -- The listing reference / project name as the message carried it. Kept as
  -- text as well as an id so a delisted property still reads back.
  context_ref    text,
  created_at     timestamptz not null default now()
);

-- The two reads the admin panel makes: newest-first overall, and per-button
-- counts over a recent window.
create index if not exists cta_clicks_created_idx
  on public.cta_clicks (created_at desc);
create index if not exists cta_clicks_key_created_idx
  on public.cta_clicks (cta_key, created_at desc);
create index if not exists cta_clicks_property_idx
  on public.cta_clicks (property_id, created_at desc)
  where property_id is not null;
create index if not exists cta_clicks_advisor_idx
  on public.cta_clicks (advisor_id, created_at desc)
  where advisor_id is not null;

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
-- Staff read. Nobody writes through RLS at all — not even anon.
--
-- Writes arrive on `POST /api/cta-click` and go in under the service role,
-- which bypasses RLS. That is the point: an anon INSERT policy would let
-- anyone POST arbitrary rows straight at PostgREST and forge the office's
-- attribution numbers. Routing through the endpoint means the payload is
-- validated and the row is stamped server-side.
alter table public.cta_clicks enable row level security;

drop policy if exists cta_clicks_staff_read on public.cta_clicks;
create policy cta_clicks_staff_read on public.cta_clicks
  for select to authenticated using (public.is_staff());

comment on table public.cta_clicks is
  'Append-only record of floating-CTA clicks. Not an enquiry: no name, no person, no PII. Written only by POST /api/cta-click under the service role.';

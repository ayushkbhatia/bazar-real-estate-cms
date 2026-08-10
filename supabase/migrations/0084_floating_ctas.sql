-- ═══════════════════════════════════════════════════════════════════════
-- 0084 · Floating CTAs — the contact rail, owned by the CMS
-- ═══════════════════════════════════════════════════════════════════════
--
-- The floating contact rail was three hardcoded buttons in
-- `app/(public)/_components/advisor-contact-rail.tsx`: label, colour, wa.me
-- message and mailto subject all baked into JSX, and the whole rail mounted
-- only on property / development / service detail pages.
--
-- Two things had to change and both belong in a table rather than in code:
--
--   • the client edits the button text, the number, the address and the draft
--     message that WhatsApp / Mail opens with — without a deploy;
--   • WhatsApp floats on *every* page, while Call and Email stay on the pages
--     that have an advisor to route to. That is a per-button decision, so it
--     is a per-row column (`scope`), not an `if` in the layout.
--
-- The "Call me back" popover is gone — deleted with this migration's PR, not
-- disabled here, because it wrote callback rows through the valuation-lead
-- endpoint and nothing else referenced it.

set local search_path = public, auth, extensions;

create table if not exists public.floating_ctas (
  id           uuid primary key default gen_random_uuid(),
  -- Stable handle for the seeded three. Code never branches on it (that is
  -- `kind`'s job) but tests, seeds and support conversations need a name
  -- that survives a relabel from "WhatsApp Bazar" to "Chat with us".
  key          text not null unique,
  -- What the button *does*. Drives the icon, the URL scheme and which of the
  -- two template columns is used. Fixed set: a fourth scheme is a code change.
  kind         text not null check (kind in ('whatsapp', 'call', 'email')),
  -- The button text: "WhatsApp Bazar", "Call", "Email".
  label        text not null,
  -- Phone number (whatsapp, call) or address (email). Null falls back to the
  -- NEXT_PUBLIC_WHATSAPP_* env numbers, so the rail keeps working on a fresh
  -- database before anyone opens the CMS.
  destination  text,
  -- The draft the chat composer / mail client opens with. Supports the tokens
  -- {advisor} {advisor_first} {context} {url} — see lib/schemas/floating-cta.ts.
  message_template text,
  -- Subject line. Only read for kind = 'email'.
  subject_template text,
  -- 'all_pages'    — floats everywhere, using `destination`.
  -- 'detail_pages' — only where a page names an advisor (property, off-plan
  --                  project, service), so the button can route to that person.
  scope        text not null default 'all_pages'
    check (scope in ('all_pages', 'detail_pages')),
  -- On a detail page, prefer the advisor's own number / address over
  -- `destination`. Off = every click lands on the firm-wide contact.
  use_advisor_contact boolean not null default true,
  -- Button fill as #rrggbb. Null keeps the brand default (ink pill for the
  -- primary action, surface pill for the rest). The foreground is derived
  -- from luminance, so any colour stays readable without a second field.
  color        text,
  enabled      boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint floating_ctas_key_slug
    check (key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint floating_ctas_label_not_blank
    check (length(btrim(label)) > 0),
  -- Six-digit hex only. Three-digit shorthand and named colours are rejected
  -- so the contrast maths downstream has exactly one shape to parse.
  constraint floating_ctas_color_hex
    check (color is null or color ~* '^#[0-9a-f]{6}$')
);

create index if not exists floating_ctas_enabled_idx
  on public.floating_ctas (enabled, sort_order);

create trigger floating_ctas_set_updated_at before update
  on public.floating_ctas
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Seed: the rail as it shipped, minus "Call me back"
-- ───────────────────────────────────────────────────────────────
-- `destination` is left null on purpose. The env numbers
-- (NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER) are still the source of truth until
-- the client types a number into the CMS; a seeded placeholder would look
-- like a real configured value in the editor and hide that.
insert into public.floating_ctas
  (key, kind, label, message_template, subject_template, scope,
   use_advisor_contact, color, sort_order)
values
  ('whatsapp', 'whatsapp', 'WhatsApp Bazar',
   'Hi {advisor}, I''m enquiring about {context} on bazar.ae',
   null, 'all_pages', true, '#25D366', 10),
  ('call', 'call', 'Call',
   null, null, 'detail_pages', true, null, 20),
  ('email', 'email', 'Email',
   'Hi {advisor_first},

I''d like to know more about {context}.

{url}',
   'Bazar enquiry · {context}', 'detail_pages', true, null, 30)
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
-- Unlike article_categories (which has to expose retired rows so old links
-- keep resolving) a disabled CTA has no public purpose at all, so `enabled`
-- is enforced here rather than in the query layer. Staff read every row
-- through the is_staff() policy, which the CMS editor needs.
alter table public.floating_ctas enable row level security;

drop policy if exists floating_ctas_public_read on public.floating_ctas;
create policy floating_ctas_public_read on public.floating_ctas
  for select using (enabled = true);

drop policy if exists floating_ctas_staff_write on public.floating_ctas;
create policy floating_ctas_staff_write on public.floating_ctas
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

comment on table public.floating_ctas is
  'The floating contact rail, editable from /admin/floating-ctas. One row per button; `scope` decides whether it floats site-wide or only on advisor-backed detail pages.';

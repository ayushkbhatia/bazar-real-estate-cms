-- 0077_staff_public_contact.sql
-- Publishable contact details for an advisor.
--
-- The property page's advisor card offers Call / WhatsApp / Email, but
-- `staff` carried no contact columns at all — the only source was the six
-- hardcoded entries in `lib/seeds/agents.ts`, so every listing showed a
-- seeded advisor's phone number regardless of who was actually assigned.
--
-- These three columns are the real source. They are deliberately named
-- `public_*` to keep them distinct from the auth login address on
-- `auth.users`: that one is a credential, these are business contact
-- details meant to be printed on a public page.
--
-- RLS: policy `staff_public_agents` (0036) exposes active agent rows to
-- `anon`. Postgres RLS is row-level, so these columns become anon-readable
-- for those rows. That is the intent — they exist to be published. Nothing
-- else on `staff` changes visibility, and non-agent / inactive rows stay
-- behind `staff_select_authenticated`.
alter table public.staff
  add column if not exists public_email text,
  add column if not exists public_phone text,
  add column if not exists whatsapp    text;

comment on column public.staff.public_email is
  'Publishable contact email shown on public advisor cards. Not the auth login address.';
comment on column public.staff.public_phone is
  'Publishable phone number, E.164 preferred (+9712…). Renders the Call action.';
comment on column public.staff.whatsapp is
  'Publishable WhatsApp number, E.164 preferred. Renders the WhatsApp action; falls back to public_phone when blank.';

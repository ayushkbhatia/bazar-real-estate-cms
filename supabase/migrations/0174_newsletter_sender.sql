-- 0174 · Who a newsletter comes from and where replies go, set in the CMS
-- (docs/NEWSLETTER.md, "Sender").
--
-- Until now every email the site sends — a password link, an enquiry
-- acknowledgement, the newsletter — carried the From and Reply-To of two
-- environment variables, RESEND_FROM_ADDRESS and RESEND_REPLY_TO. The client
-- asked (3 Nov 2026) for the newsletter to come from marketing and for replies
-- to reach marketing, not the developer's inbox the env still names. A
-- newsletter is marketing mail; a password link is not. So the newsletter gets
-- its own sender, edited at /admin/newsletter/settings, and everything else
-- keeps the env.
--
-- One row (`id` is always true). Blank columns fall back to the env, so a
-- fresh environment sends exactly as it did before this table existed.
--
-- The seeded From is on bazarrealestate.com, not .ae: .com is the domain
-- verified in Resend (every send so far went from hello@bazarrealestate.com),
-- and Resend refuses a From on a domain it has not verified. Once
-- bazarrealestate.ae is verified there, an editor changes the address on the
-- settings page; the page checks the domain against Resend before saving.
--
-- Additive; the deployed code reads none of it.

create table if not exists public.newsletter_settings (
  id           boolean primary key default true check (id),
  from_name    text not null default '',
  from_address text not null default '',
  reply_to     text not null default '',
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

comment on table public.newsletter_settings is
  'The newsletter''s own From and Reply-To (one row). Blank falls back to RESEND_FROM_ADDRESS / RESEND_REPLY_TO. Transactional email does not read it.';

insert into public.newsletter_settings (id, from_name, from_address, reply_to)
values (true, 'Marketing at Bazar Real Estate', 'marketing@bazarrealestate.com', 'marketing@bazarrealestate.ae')
on conflict (id) do nothing;

drop trigger if exists newsletter_settings_set_updated_at on public.newsletter_settings;
create trigger newsletter_settings_set_updated_at
  before update on public.newsletter_settings
  for each row execute function public.set_updated_at();

alter table public.newsletter_settings enable row level security;

drop policy if exists newsletter_settings_staff_read on public.newsletter_settings;
create policy newsletter_settings_staff_read on public.newsletter_settings
  for select to authenticated
  using ((select public.is_staff()));

-- The people who may send to the list decide whose name it goes out in.
drop policy if exists newsletter_settings_sender_write on public.newsletter_settings;
create policy newsletter_settings_sender_write on public.newsletter_settings
  for update to authenticated
  using ((select public.current_staff_role()) in ('admin', 'marketing'))
  with check ((select public.current_staff_role()) in ('admin', 'marketing'));

grant select, update on public.newsletter_settings to authenticated;
grant all on public.newsletter_settings to service_role;

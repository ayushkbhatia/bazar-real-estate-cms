-- 0177 · A sender name per newsletter (docs/NEWSLETTER.md, "Sender").
--
-- Every newsletter went out under the one name set at
-- /admin/newsletter/settings ("Marketing at Bazar Real Estate", 0174). The
-- client asked (23 Nov 2026) to choose the name per newsletter, so a launch
-- mailer can come from the project it markets ("Saadiyat Lagoons by Bazar")
-- rather than from marketing, for a better open and click rate.
--
-- Only the NAME changes. The address stays the one in newsletter_settings:
-- Resend sends only from verified domains, and the delivery webhook tells this
-- site's events from other sites' on the same Resend account by the From's
-- domain, so letting the address vary per newsletter would risk both.
--
-- `from_name` / `from_name_ar` on a campaign: blank (or null) = the settings
-- name. The Arabic edition's readers get `from_name_ar`, falling back to
-- `from_name`, then to the settings name. Saved templates keep the name too,
-- so a template made for a project starts its next newsletter under it.
--
-- Additive; the deployed code reads none of it.

alter table public.newsletter_campaigns
  add column if not exists from_name    text not null default '',
  add column if not exists from_name_ar text not null default '';

alter table public.newsletter_templates
  add column if not exists from_name    text not null default '',
  add column if not exists from_name_ar text not null default '';

-- The same rule the settings form enforces (senderSettingsSchema): a name in
-- a header must not carry a quote, an angle bracket or a line break, which
-- could break the From header or inject another one.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'newsletter_campaigns_from_name_check') then
    alter table public.newsletter_campaigns
      add constraint newsletter_campaigns_from_name_check
      check (length(from_name) <= 80 and length(from_name_ar) <= 80
             and from_name !~ '[<>"\r\n]' and from_name_ar !~ '[<>"\r\n]');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'newsletter_templates_from_name_check') then
    alter table public.newsletter_templates
      add constraint newsletter_templates_from_name_check
      check (length(from_name) <= 80 and length(from_name_ar) <= 80
             and from_name !~ '[<>"\r\n]' and from_name_ar !~ '[<>"\r\n]');
  end if;
end $$;

comment on column public.newsletter_campaigns.from_name is
  'Sender name for this newsletter; blank = newsletter_settings.from_name. The address is always the settings one.';
comment on column public.newsletter_campaigns.from_name_ar is
  'Sender name the Arabic edition''s readers see; blank = from_name, then the settings name.';
comment on column public.newsletter_templates.from_name is
  'Sender name a newsletter started from this template begins with; blank = the settings name.';
comment on column public.newsletter_templates.from_name_ar is
  'Arabic sender name a newsletter started from this template begins with.';

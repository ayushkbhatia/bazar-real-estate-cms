-- ═══════════════════════════════════════════════════════════════════════
-- 0100 · locale on the lead tables
-- ═══════════════════════════════════════════════════════════════════════
--
-- Which language a person was reading when they became a lead. Three tables,
-- one column each, and it ships before the Arabic site does — deliberately.
--
-- This is the one part of the i18n epic that is NOT retro-fittable. Every
-- other column can be backfilled later from the English source; this value
-- exists only at the moment of submission and is gone the instant the request
-- ends. Ship Arabic first and the earliest months of Arabic leads are
-- permanently unattributable: nobody can answer "is the Arabic site producing
-- enquiries?", which is the first question the client will ask about it.
--
-- The same argument covers the analytics side (a PostHog super-property and a
-- Sentry tag, both landed in the same phase for the same reason).
--
-- `reviews` gets one for a second reason: visitor-authored copy is never
-- machine-translated — presenting a translation of someone's words as their
-- words misrepresents them — so the public page has to render each review in
-- its original language, with its own `lang`/`dir`. This column is how it
-- knows which.
--
-- NO grant changes needed. `site_settings` is the only table in this schema
-- with column-level grants (0096/0097), where an ungranted column fails the
-- whole PostgREST select. These three use table-wide grants plus RLS, so a new
-- column is covered by the existing policies from 0007.

-- Every statement is schema-qualified, so no search_path is set here.

-- 'en' matches every row that already exists: the site has only ever been
-- English, so the default is a statement of fact rather than an assumption.
alter table public.enquiries
  add column if not exists locale text not null default 'en';

alter table public.newsletter_subscribers
  add column if not exists locale text not null default 'en';

alter table public.reviews
  add column if not exists locale text not null default 'en';

-- Constrain to the locales the application knows how to render. A new locale
-- needs a migration anyway (twin columns, message catalogue), so folding this
-- into that work is no extra friction — and it keeps a typo'd 'ar-AE' or 'AR'
-- out of a column that analytics will group by.
alter table public.enquiries
  drop constraint if exists enquiries_locale_known;
alter table public.enquiries
  add constraint enquiries_locale_known check (locale in ('en', 'ar'));

alter table public.newsletter_subscribers
  drop constraint if exists newsletter_subscribers_locale_known;
alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_locale_known check (locale in ('en', 'ar'));

alter table public.reviews
  drop constraint if exists reviews_locale_known;
alter table public.reviews
  add constraint reviews_locale_known check (locale in ('en', 'ar'));

comment on column public.enquiries.locale is
  'Language the visitor was reading when they submitted. Set at write time and
   never inferred — it cannot be reconstructed afterwards.';

comment on column public.newsletter_subscribers.locale is
  'Language the visitor subscribed in. Determines which language their
   transactional email is sent in.';

comment on column public.reviews.locale is
  'Language the review was written in. Reviews are never machine-translated, so
   the public page renders each one in its original language using this value
   for its lang/dir attributes.';

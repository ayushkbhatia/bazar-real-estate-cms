-- 0113 — the footer's content, in both languages.
--
-- The English is a transcription of what `public-footer.tsx` held before 0112
-- moved the content out of it, character for character. That is the point: the
-- English footer must be byte-identical after this migration, so the whole
-- change is reviewable as "Arabic appeared" rather than "the footer changed".
--
-- ── Where the Arabic comes from ──────────────────────────────────────────
--
-- Three sources, in descending order of authority:
--
--   1. The client's own catalogue. The legal line is lifted verbatim from
--      `messages/ar/footer.json`, which is the wording they signed off — the
--      licence number, the regulator names and the entity suffix (ذ.م.م.) are
--      not things to re-translate.
--   2. `lib/i18n/mt/proper-nouns.ts`, for every place name. جزيرة السعديات and
--      البطين are the curated forms; a fresh transliteration of each would give
--      the site two Arabic spellings for the same island, which is exactly the
--      failure that file exists to prevent. (Al Bateen's entry records an
--      unmasked back-translation of "the hidden things" — the literal sense of
--      the root — which is what a naive pass does to an Abu Dhabi address.)
--   3. `lib/master-pages/arabic/master.json` for strings the site already says
--      elsewhere: الخدمات, المطورون, مشاريع جديدة, شراء عقار, إدارة العقارات.
--      Reusing them is what keeps one English string to one Arabic string
--      across the megamenu, the master pages and now the footer.
--
-- Two deliberate departures from the store:
--
--   · "About" is seeded من نحن, not the store's حول. The megamenu tab carries
--     حول, which is fine for a one-word tab beside eight others; standing alone
--     in a Company column it reads as a dangling preposition. من نحن is the
--     conventional Arabic footer label.
--   · Digits stay Western (2005, 2026, 202400997397), matching the client's own
--     Arabic legal line rather than converting to Arabic-Indic mid-sentence.
--
-- Re-runnable: every insert is guarded, so applying this twice does not double
-- the footer. It seeds only when the table is empty — once an editor has
-- touched /admin/footer this file must never overwrite them.

-- ── Settings ─────────────────────────────────────────────────────────────
insert into public.footer_settings
  (blurb, blurb_ar, contact_heading, contact_heading_ar, legal_line, legal_line_ar)
select
  'Bazar Real Estate is a leading UAE real estate agency, serving the property market with expertise since 2005.',
  'بازار للعقارات وكالة عقارية رائدة في دولة الإمارات، تخدم السوق العقاري بخبرة منذ عام 2005.',
  'Contact',
  'اتصل بنا',
  '© 2026 Bazar Real Estate L.L.C. All rights reserved. · ADM: 202400997397 · Regulated by ADREC & DLD',
  '© 2026 بازار للعقارات ذ.م.م. جميع الحقوق محفوظة · بلدية أبوظبي: 202400997397 · تحت إشراف مركز أبوظبي العقاري ودائرة الأراضي والأملاك'
where not exists (select 1 from public.footer_settings);

-- ── Socials ──────────────────────────────────────────────────────────────
insert into public.footer_socials (position, label, href)
select * from (values
  (0, 'Facebook',  'https://www.facebook.com/bazarrealestateae'),
  (1, 'Instagram', 'https://www.instagram.com/bazarrealestate'),
  (2, 'TikTok',    'https://www.tiktok.com/@bazarrealestate'),
  (3, 'YouTube',   'https://www.youtube.com/@bazarrealestateae'),
  (4, 'LinkedIn',  'https://www.linkedin.com/company/bazarrealestate')
) as s(position, label, href)
where not exists (select 1 from public.footer_socials);

-- ── Contact entries ──────────────────────────────────────────────────────
--
-- The phone row has no `body_ar` and that is correct rather than unfinished:
-- the body is two international numbers, and `localiseRow` leaves a blank twin
-- showing the English in place. `globals.css` isolates `.mono`, so the leading
-- `+` cannot jump to the wrong end of an RTL line.
insert into public.footer_contact_items (position, kind, label, label_ar, body, body_ar)
select * from (values
  (0, 'phone'::public.footer_contact_kind, 'Phone / WhatsApp', 'الهاتف / واتساب',
     E'+971 2 632 2223\n+971 50 691 1103', null),
  (1, 'email'::public.footer_contact_kind, 'Email', 'البريد الإلكتروني',
     'info@bazarrealestate.ae', null),
  (2, 'address'::public.footer_contact_kind, 'Office location', 'موقع المكتب',
     E'Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates',
     E'مبنى الشيخة سلامة، مكتب 4\nشارع الشيخ زايد الأول، البطين\nأبوظبي، الإمارات العربية المتحدة')
) as c(position, kind, label, label_ar, body, body_ar)
where not exists (select 1 from public.footer_contact_items);

-- ── Columns and their links ──────────────────────────────────────────────
do $$
declare
  v_col uuid;
begin
  if exists (select 1 from public.footer_columns) then
    return;
  end if;

  -- Company
  insert into public.footer_columns (kind, heading, heading_ar, position)
  values ('links', 'Company', 'الشركة', 0)
  returning id into v_col;
  insert into public.footer_links (column_id, position, label, label_ar, href) values
    (v_col, 0, 'About',           'من نحن',           '/about'),
    (v_col, 1, 'Careers',         'الوظائف',          '/careers'),
    (v_col, 2, 'News & Insights', 'الأخبار والرؤى',   '/insights'),
    (v_col, 3, 'Developers',      'المطورون',         '/developers'),
    (v_col, 4, 'Communities',     'المجتمعات',        '/communities'),
    (v_col, 5, 'New Projects',    'مشاريع جديدة',     '/off-plan');

  -- Services
  insert into public.footer_columns (kind, heading, heading_ar, position)
  values ('links', 'Services', 'الخدمات', 1)
  returning id into v_col;
  insert into public.footer_links (column_id, position, label, label_ar, href) values
    (v_col, 0, 'Buy a Property',      'شراء عقار',           '/buy'),
    (v_col, 1, 'Sell Your Property',  'بيع عقارك',           '/services/sell'),
    (v_col, 2, 'Rent a Property',     'استئجار عقار',        '/rent'),
    (v_col, 3, 'List Your Property',  'أدرج عقارك',          '/services/sell'),
    (v_col, 4, 'Property Management', 'إدارة العقارات',      '/services/manage'),
    (v_col, 5, 'Mortgage Support',    'دعم التمويل العقاري', '/tools/mortgage');

  -- Popular areas. Three of these point at the index rather than a guide,
  -- because those communities have no /communities/<slug> page seeded yet —
  -- carried over from the component's own comment rather than silently fixed.
  insert into public.footer_columns (kind, heading, heading_ar, position)
  values ('links', 'Popular areas', 'المناطق الأكثر طلباً', 2)
  returning id into v_col;
  insert into public.footer_links (column_id, position, label, label_ar, href) values
    (v_col, 0, 'Hudayriyat Island', 'جزيرة الحديريات', '/communities'),
    (v_col, 1, 'Al Reem Island',    'جزيرة الريم',     '/communities/al-reem-island'),
    (v_col, 2, 'Yas Island',        'جزيرة ياس',       '/communities/yas-island'),
    (v_col, 3, 'Saadiyat Island',   'جزيرة السعديات',  '/communities/saadiyat-island'),
    (v_col, 4, 'Al Raha Beach',     'شاطئ الراحة',     '/communities/al-raha'),
    (v_col, 5, 'Masdar City',       'مدينة مصدر',      '/communities/masdar-city'),
    (v_col, 6, 'Al Ghadeer',        'الغدير',          '/communities'),
    (v_col, 7, 'Zayed City',        'مدينة زايد',      '/communities');

  -- The bottom bar. No heading — it renders as a row beside the legal line.
  -- The Arabic is the client's own, from messages/ar/footer.json.
  insert into public.footer_columns (kind, heading, heading_ar, position)
  values ('legal', null, null, 0)
  returning id into v_col;
  insert into public.footer_links (column_id, position, label, label_ar, href) values
    (v_col, 0, 'Privacy Policy', 'سياسة الخصوصية',           '/legal/privacy'),
    (v_col, 1, 'Terms of Use',   'شروط الاستخدام',           '/legal/terms'),
    (v_col, 2, 'Cookies',        'ملفات تعريف الارتباط',     '/legal/cookies'),
    (v_col, 3, 'Sitemap',        'خريطة الموقع',             '/sitemap.xml');
end $$;

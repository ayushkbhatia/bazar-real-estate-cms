-- 0125 — Arabic for the amenity taxonomy.
--
-- `amenities_taxonomy.label_ar` has existed since 0104 and every row in it is
-- null. That is not an oversight in the migration; it is where the column ran
-- out of road. The twenty-one amenities seeded in code carry Arabic
-- (`DEFAULT_AMENITIES` in lib/schemas/amenity-taxonomy.ts), but the eighty-seven
-- the client actually uses arrived by a later migration, the only Arabic input
-- on /admin/settings/fields was on the *add* form, and nothing in the CMS could
-- edit an existing row. So the column was reachable for entries nobody had and
-- unreachable for the ones everybody uses.
--
-- The app-side half of that ships alongside this: an editable Arabic box on
-- every row, and a property-editor "add" that writes into this table instead of
-- leaving free text on one listing. This migration is the content half — the
-- machine first draft ADR-0008 describes, for the client to correct in the CMS
-- rather than to author from an empty table.
--
-- ── Why this is a migration and not a CMS session ────────────────────────
-- Because it is 104 rows of one field. Everything the client will actually
-- decide — a word they prefer, a term their audience uses — is a CMS edit
-- against this baseline, and the baseline is what makes that a review rather
-- than a data-entry job.
--
-- ── Where the wording comes from ─────────────────────────────────────────
-- The site-wide Arabic store (lib/master-pages/arabic/master.json) already had
-- an entry for 86 of the 87 active labels, so the read path renders Arabic even
-- without this. It is used here as a draft, not copied: about a dozen of those
-- entries are wrong in a way only a reader would catch — "Basement" came back
-- as a transliteration ("باصنت"), "Central Air Conditioning" as heating and
-- ventilation, "Park Views" / "City Views" as "points of view" rather than an
-- outlook, "Promenade" as a broken noun phrase. Those are corrected here, which
-- is also why the stored twin wins over the store on read.
--
-- Idempotent, and it never overwrites a person: a row whose `label_ar` already
-- holds something is left exactly as it is.

set local search_path = public, auth, extensions;

-- One statement, deliberately. A temporary table would have been easier to
-- read, but nothing here guarantees the whole file runs inside one
-- transaction, and `on commit drop` between two statements is a table that
-- vanishes before the update that needs it.
with src (code, label, ar) as (values
  -- ── Active: views and outlook ──────────────────────────────────────────
  ('abu_dhabi_skyline_views'::text, 'Abu Dhabi Skyline Views'::text, 'إطلالة على أفق أبوظبي'::text),
  ('canal_viewss',            'Canal Views',             'إطلالة على القناة المائية'),
  ('city_views',              'City Views',              'إطلالة على المدينة'),
  ('garden_views',            'Garden Views',            'إطلالة على الحديقة'),
  ('park_views',              'Park Views',              'إطلالة على الحديقة العامة'),
  ('sea_vieww',               'Sea View',                'إطلالة على البحر'),
  ('waterfront_views',        'Waterfront Views',        'إطلالة على الواجهة المائية'),

  -- ── Active: inside the home ────────────────────────────────────────────
  ('balconyy',                 'Balcony',                  'شرفة'),
  ('basement',                 'Basement',                 'قبو'),
  ('builtin_appliances',       'Built-In Appliances',      'أجهزة مدمجة'),
  ('builtin_wardrobes',        'Built-In Wardrobes',       'خزائن مدمجة'),
  ('central_air_conditioning', 'Central Air Conditioning', 'تكييف مركزي'),
  ('chef_kitchen',             'Chef’s Kitchen',           'مطبخ الشيف'),
  ('drivers_roomm',            'Driver’s Room',            'غرفة سائق'),
  ('ensuite_bathrooms',        'En-Suite Bathrooms',       'حمامات داخلية ملحقة'),
  ('family_lounge',            'Family Lounge',            'صالة عائلية'),
  ('fully_fitted_kitchen',     'Fully Fitted Kitchen',     'مطبخ مجهّز بالكامل'),
  ('gaming_room',              'Gaming Room',              'غرفة ألعاب'),
  ('guest_bathroom',           'Guest Bathroom',           'حمام ضيوف'),
  ('guest_bedroom',            'Guest Bedroom',            'غرفة نوم للضيوف'),
  ('home_office',              'Home Office',              'مكتب منزلي'),
  ('kitchen_appliances',       'Kitchen Appliances',       'أجهزة مطبخ'),
  ('laundry_room',             'Laundry Room',             'غرفة غسيل'),
  ('maid_room',                'Maid’s Room',              'غرفة خادمة'),
  ('majlis',                   'Majlis',                   'مجلس'),
  ('pantry',                   'Pantry',                   'غرفة مؤن'),
  ('powder_room',              'Powder Room',              'حمام صغير للضيوف'),
  ('private_elevator',         'Private Elevator',         'مصعد خاص'),
  ('private_garage',           'Private Garage',           'مرآب خاص'),
  ('private_garden',           'Private Garden',           'حديقة خاصة'),
  ('private_parking',          'Private Parking',          'موقف خاص'),
  ('private_swimming_pool',    'Private Swimming Pool',    'مسبح خاص'),
  ('private_terrace',          'Private Terrace',          'تراس خاص'),
  ('rooftop',                  'Rooftop',                  'سطح'),
  ('smart_home_features',      'Smart Home Features',      'مزايا المنزل الذكي'),
  ('storage_room',             'Storage Room',             'غرفة تخزين'),
  ('study_room',               'Study Room',               'غرفة دراسة'),
  ('utility_room',             'Utility Room',             'غرفة خدمات'),
  ('walkin_closet',            'Walk-In Closet',           'غرفة ملابس'),

  -- ── Active: the building ───────────────────────────────────────────────
  ('clinic',           'Clinic',            'عيادة'),
  ('clubhouse',        'Clubhouse',         'النادي الاجتماعي'),
  ('concierge',        'Concierge',         'خدمة الكونسيرج'),
  ('covered_parkingg', 'Covered Parking',   'مواقف مغطاة'),
  ('coworking_spaces', 'Co-Working Spaces', 'مساحات عمل مشتركة'),
  ('lobby',            'Lobby',             'بهو الاستقبال'),
  ('parking',          'Parking',           'موقف سيارات'),
  ('storage',          'Storage',           'غرفة تخزين'),

  -- ── Active: the community ──────────────────────────────────────────────
  ('beach_club',      'Beach Club',      'نادي شاطئ'),
  ('community_centre', 'Community Centre', 'مركز مجتمعي'),
  ('dining_retail',   'Dining & Retail', 'مطاعم ومتاجر'),
  ('kids_club',       'Kids'' club',     'نادي للأطفال'),
  ('kids_clubb',      'Kids’ Club',      'نادي للأطفال'),
  ('kids_play_area',  'Kids’ Play Area', 'منطقة لعب للأطفال'),
  ('marinaa',         'Marina',          'مرسى'),
  ('mosque',          'Mosque',          'مسجد'),
  ('pet_facilities',  'Pet Facilities',  'مرافق للحيوانات الأليفة'),
  ('pet_friendly',    'Pet friendly',    'يسمح بالحيوانات الأليفة'),
  ('picnic_areass',   'Picnic Areas',    'مناطق نزهة'),
  ('playgroundd',     'Playground',      'ملعب أطفال'),

  -- ── Active: outdoors ───────────────────────────────────────────────────
  ('bbq_terraces',                'BBQ Terraces',                'تراسات شواء'),
  ('boardwalk',                   'Boardwalk',                   'ممشى خشبي'),
  ('central_park',                'Central Park',                'الحديقة المركزية'),
  ('cycling_trails',              'Cycling Trails',              'مسارات دراجات'),
  ('dog_park',                    'Dog Park',                    'حديقة للكلاب'),
  ('family_pool',                 'Family Pool',                 'مسبح عائلي'),
  ('green_spaces',                'Green Spaces',                'مساحات خضراء'),
  ('infinity_pool',               'Infinity Pool',               'مسبح لا متناهي'),
  ('jogging_trails',              'Jogging Trails',              'مسارات جري'),
  ('kids_pool',                   'Kids’ Pool',                  'مسبح للأطفال'),
  ('multi_purpose_sports_courts', 'Multi-Purpose Sports Courts', 'ملاعب رياضية متعددة الاستخدامات'),
  ('outdoor_cinema',              'Outdoor Cinema',              'سينما في الهواء الطلق'),
  ('padel_courts',                'Padel Courts',                'ملاعب بادل'),
  ('parks',                       'Parks',                       'حدائق'),
  ('pool',                        'Pool',                        'مسبح'),
  ('promenade',                   'Promenade',                   'ممشى'),
  ('splash_pad',                  'Splash Pad',                  'منطقة ألعاب مائية'),
  ('sports_courts',               'Sports Courts',               'ملاعب رياضية'),
  ('swimming_pool',               'Swimming Pool',               'مسبح'),
  ('waterfront_promenade',        'Waterfront Promenade',        'ممشى الواجهة المائية'),

  -- ── Active: wellness and security ──────────────────────────────────────
  ('fitness_studio',       'Fitness Studio',          'استوديو لياقة'),
  ('gated_community',      'Gated Community',         'مجمّع مسوَّر'),
  ('gym',                  'Gym',                     'صالة رياضية'),
  ('jacuzzi',              'Jacuzzi',                 'جاكوزي'),
  ('sauna',                'Sauna',                   'ساونا'),
  ('security',             '24/7 Security',           'أمن على مدار الساعة'),
  ('spa',                  'Spa',                     'سبا'),
  ('yoga_wellness_studio', 'Yoga & Wellness Studio',  'استوديو يوغا وعافية'),

  -- ── Inactive rows ──────────────────────────────────────────────────────
  -- They stay so a historical code on an existing listing still resolves, and
  -- an admin can switch any of them back on. Translating them costs one line
  -- each and means reactivation is not a silent regression to English.
  ('balcony',         'Balcony',         'شرفة'),
  ('beach_access',    'Beach access',    'منفذ إلى الشاطئ'),
  ('canal_views',     'Canal Views',     'إطلالة على القناة المائية'),
  ('covered_parking', 'Covered parking', 'مواقف مغطاة'),
  ('drivers_room',    'Driver''s room',  'غرفة سائق'),
  ('garden',          'Garden',          'حديقة'),
  ('maids_room',      'Maid''s room',    'غرفة خادمة'),
  ('marina',          'Marina',          'مرسى'),
  ('park_view',       'Park view',       'إطلالة على الحديقة'),
  ('picnic_areas',    'Picnic Areas',    'مناطق نزهة'),
  ('playground',      'Playground',      'ملعب أطفال'),
  ('private_pool',    'Private pool',    'مسبح خاص'),
  ('sea_view',        'Sea view',        'إطلالة على البحر'),
  ('security_24h',    '24h security',    'أمن على مدار الساعة'),
  ('skyline_view',    'Skyline view',    'إطلالة على أفق المدينة'),
  ('smart_home',      'Smart home',      'منزل ذكي'),
  ('walk_in_closet',  'Walk-in closet',  'غرفة ملابس')
),
-- Match on the code OR the label. Production and a database seeded from
-- `DEFAULT_AMENITIES` disagree about codes for the same words ('sea_vieww' vs
-- 'sea_view'), so one migration has to answer to both. A label can match more
-- than one source row — 'Marina' is here twice, under `marinaa` and `marina` —
-- so the pick is made explicit rather than left to whichever row the planner
-- reached first: an exact code match wins, then the lower code alphabetically.
-- Every duplicated label in the list carries the same Arabic, so this settles
-- a tie that has no wrong answer; it is here so the migration is repeatable.
resolved as (
  select t.code as target,
         (array_agg(s.ar order by (t.code = s.code) desc, s.code))[1] as ar
    from public.amenities_taxonomy t
    join src s
      on t.code = s.code
      or lower(btrim(t.label)) = lower(btrim(s.label))
   where t.label_ar is null or btrim(t.label_ar) = ''
   group by t.code
)
update public.amenities_taxonomy t
   set label_ar = r.ar
  from resolved r
 where t.code = r.target;

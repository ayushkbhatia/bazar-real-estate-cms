-- 0114 — the three home-page bands that had no Arabic to render.
--
-- Three separate reports, one shape. The partner ecosystem band, the developer
-- band and the FAQ accordion all rendered English on /ar, and none of them had
-- a CMS field an editor could have typed the Arabic into:
--
--   · partners / developers  declared `fields: []` in the registry. That was
--     true of the LOGOS, which come from the catalogue, and wrong about the
--     four words around them — eyebrow, headline, standfirst and button — which
--     were literals in the components.
--   · faqs                    shipped with `items: []` stored, so the section
--     fell through to a hardcoded array inside `home-faqs.tsx`. The CMS showed
--     an editor no questions while the page rendered five.
--
-- The code change gives all three real fields with the current English as the
-- registry default. This migration fills the LIVE document, English and Arabic
-- together, so the client opens /admin/pages/master/home and sees both — the
-- point being that they can judge and rewrite the Arabic, not that it is final.
--
-- The Arabic is a machine first draft under ADR-0008, drawn from
-- `lib/master-pages/arabic/master.json` so the same English gives the same
-- Arabic here as it does everywhere else on the site.
--
-- English is unchanged by this file: every string below is the literal the
-- component already rendered, character for character. That keeps the whole
-- change reviewable as "Arabic appeared".
--
-- Re-runnable, and it never overwrites an editor: each band is filled only
-- where the stored value is still absent, and the FAQ list only while it is
-- still empty.

set local search_path = public, auth, extensions;


-- master/home · partners
with rebuilt as (
  select p.id,
         jsonb_agg(
           case
             when b->>'key' = 'partners'
                  and coalesce(b->'values', '{}'::jsonb) = '{}'::jsonb
             then jsonb_set(b, '{values}', $seed${
  "eyebrow": "Our Partner Ecosystem",
  "heading": "The banks and regulators behind every deal.",
  "body": "Direct relationships with the UAE's leading financial institutions and real-estate authorities.",
  "cta_label": "All partners",
  "eyebrow_ar": "منظومة شركائنا",
  "heading_ar": "البنوك والجهات التنظيمية التي تقف خلف كل صفقة.",
  "body_ar": "علاقات مباشرة مع أبرز المؤسسات المالية والجهات العقارية في الإمارات.",
  "cta_label_ar": "جميع الشركاء"
}$seed$::jsonb)
             else b
           end
           order by ord
         ) as blocks
  from public.pages p,
       lateral jsonb_array_elements(p.blocks) with ordinality as t(b, ord)
  where p.slug = 'master/home'
  group by p.id
)
update public.pages p
   set blocks = r.blocks
  from rebuilt r
 where p.id = r.id;


-- master/home · developers
with rebuilt as (
  select p.id,
         jsonb_agg(
           case
             when b->>'key' = 'developers'
                  and coalesce(b->'values', '{}'::jsonb) = '{}'::jsonb
             then jsonb_set(b, '{values}', $seed${
  "eyebrow": "Our Developers",
  "heading": "The developers shaping the UAE.",
  "body": "Direct relationships with the region's leading developers give our clients early access to landmark communities, new launches, and off-plan releases.",
  "cta_label": "All developers",
  "eyebrow_ar": "مطوّرونا",
  "heading_ar": "المطوّرون الذين يرسمون ملامح الإمارات.",
  "body_ar": "علاقاتنا المباشرة مع أبرز مطوّري المنطقة تمنح عملاءنا أولوية الوصول إلى المجتمعات المميزة والإطلاقات الجديدة والمشاريع على الخارطة.",
  "cta_label_ar": "جميع المطورين"
}$seed$::jsonb)
             else b
           end
           order by ord
         ) as blocks
  from public.pages p,
       lateral jsonb_array_elements(p.blocks) with ordinality as t(b, ord)
  where p.slug = 'master/home'
  group by p.id
)
update public.pages p
   set blocks = r.blocks
  from rebuilt r
 where p.id = r.id;


-- master/about · partner_ecosystem
with rebuilt as (
  select p.id,
         jsonb_agg(
           case
             when b->>'key' = 'partner_ecosystem'
                  and coalesce(b->'values', '{}'::jsonb) = '{}'::jsonb
             then jsonb_set(b, '{values}', $seed${
  "eyebrow": "Our Partner Ecosystem",
  "heading": "The banks and regulators behind every deal.",
  "body": "Direct relationships with the UAE's leading financial institutions and real-estate authorities.",
  "cta_label": "All partners",
  "eyebrow_ar": "منظومة شركائنا",
  "heading_ar": "البنوك والجهات التنظيمية التي تقف خلف كل صفقة.",
  "body_ar": "علاقات مباشرة مع أبرز المؤسسات المالية والجهات العقارية في الإمارات.",
  "cta_label_ar": "جميع الشركاء"
}$seed$::jsonb)
             else b
           end
           order by ord
         ) as blocks
  from public.pages p,
       lateral jsonb_array_elements(p.blocks) with ordinality as t(b, ord)
  where p.slug = 'master/about'
  group by p.id
)
update public.pages p
   set blocks = r.blocks
  from rebuilt r
 where p.id = r.id;


-- master/home · faqs — the five questions, only while the list is still empty
with rebuilt as (
  select p.id,
         jsonb_agg(
           case
             when b->>'key' = 'faqs'
                  and coalesce(jsonb_array_length(b->'values'->'items'), 0) = 0
             then jsonb_set(
                    b,
                    '{values,items}',
                    $seed$[
  {
    "q": "What is the benefit of buying off-plan?",
    "a": "Off-plan properties often offer flexible payment plans, lower entry prices, and potential capital growth before handover.",
    "q_ar": "ما فائدة الشراء على الخارطة؟",
    "a_ar": "غالباً ما توفّر العقارات على الخارطة خطط سداد مرنة وأسعار دخول أقل وإمكانية نمو رأس المال قبل التسليم."
  },
  {
    "q": "What should I check before buying a property?",
    "a": "Check the location, developer, price, payment plan, ownership type, service charges, and expected rental demand.",
    "q_ar": "ما الذي ينبغي التحقق منه قبل شراء عقار؟",
    "a_ar": "تحقّق من الموقع والمطوّر والسعر وخطة السداد ونوع الملكية ورسوم الخدمات والطلب الإيجاري المتوقع."
  },
  {
    "q": "What is mortgage pre-approval?",
    "a": "Mortgage pre-approval shows how much a bank may be willing to lend before you choose a property.",
    "q_ar": "ما هي الموافقة المبدئية على التمويل العقاري؟",
    "a_ar": "توضّح الموافقة المبدئية المبلغ الذي قد يوافق البنك على إقراضه قبل أن تختار العقار."
  },
  {
    "q": "What is a payment plan?",
    "a": "A payment plan is the schedule of instalments paid to the developer or seller over a set period.",
    "q_ar": "ما هي خطة السداد؟",
    "a_ar": "خطة السداد هي جدول الأقساط التي تُدفع للمطوّر أو البائع على مدى فترة محددة."
  },
  {
    "q": "What are service charges?",
    "a": "Service charges are fees paid for building or community maintenance, facilities, and shared areas.",
    "q_ar": "ما هي رسوم الخدمات؟",
    "a_ar": "رسوم الخدمات هي مبالغ تُدفع مقابل صيانة المبنى أو المجتمع والمرافق والمساحات المشتركة."
  }
]$seed$::jsonb
                  )
             else b
           end
           order by ord
         ) as blocks
  from public.pages p,
       lateral jsonb_array_elements(p.blocks) with ordinality as t(b, ord)
  where p.slug = 'master/home'
  group by p.id
)
update public.pages p
   set blocks = r.blocks
  from rebuilt r
 where p.id = r.id;

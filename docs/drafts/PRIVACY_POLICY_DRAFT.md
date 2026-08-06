# Bazar Real Estate — Privacy Policy (client final, English + Arabic)

**Status:** SUPERSEDES the in-house draft that lived at this path. This is
the client-supplied text, delivered as a bilingual PDF (English + Arabic)
and shipped to `app/(public)/legal/privacy/page.tsx`. Treat this file as the
source of truth for that page: if the page and this file drift, the page is
wrong.

**Last updated (as published):** 6 August 2026 — the PDF carried no date, so
this is the ship date and needs client confirmation.

**Arabic:** shipped at `/ar/legal/privacy` from
`app/(public)/ar/legal/privacy/page.tsx`. Reconstructed from the PDF by
glyph position (right-to-left per line), because the embedded font maps
lam-alef ligatures to their two letters in visual order — a plain text
extract turns الإمارات into اإلمارات and ٤٥ into ٥٤. Headings were read back
against a 400dpi render of each page, and the rendered page diffed against
the reconstruction (97.96% character-identical; every difference is the
site's own chrome or a heading glyph the PDF drew on a second baseline).

**Open with the client:**

- §5 retention arrived as `[12 MONTHS]` — a bracketed fill-in-the-blank.
  Published as "12 months"; confirm before anyone relies on it.
- §3/§4 name **Salesforce** as the CRM. Enquiries live in Supabase/Postgres
  in this product; there is no Salesforce integration.
- The policy is silent on surfaces that exist: the AI concierge (Anthropic),
  the newsletter (Mailchimp/Resend), the valuation and mortgage tools, and
  the hosting/analytics vendors (Vercel, PostHog, Sentry, Meilisearch,
  Mapbox). The superseded draft disclosed these; the client's text does not.
- Entity is **Bazar Real Estate L.L.C.**, regulated by **ADREC**. The rest
  of the site still says "Bazar Real Estate Brokerage LLC · ORN 28041 · DMT".
- The Arabic §2 heading reads "البيانات الشخصية التي بجمعها" where the
  English says "What Personal Data We Collect" — apparently a typo for
  "نجمعها". Published verbatim.

The text below is verbatim, brackets and all. The rendered page normalises
punctuation only.

---

## 1. Introduction

Bazar Real Estate L.L.C. is a real estate brokerage licensed and regulated
in the Emirate of Abu Dhabi, United Arab Emirates, headquartered in Al
Bateen, Abu Dhabi, and regulated by the Abu Dhabi Real Estate Centre (ADREC)
and, where applicable, the Dubai Land Department (DLD). This Privacy Policy
explains how we collect, use, store, disclose, and protect personal data
when you visit our website(s), submit an inquiry, contact us through
WhatsApp or phone, or otherwise interact with our services.

This Policy is issued in accordance with UAE Federal Decree-Law No. 45 of
2021 on the Protection of Personal Data (the "PDPL") and its implementing
regulations.

## 2. What Personal Data We Collect

We collect personal data through the following channels:

- **Website contact and inquiry forms**: full name, phone number, email
  address, and details of the property or service you are interested in
- **WhatsApp integration**: your name, phone number, and the content of
  messages exchanged with our team.
- **Call integration**: your phone number, call metadata (date, time,
  duration), and, where legally permitted and disclosed to you, call
  recordings for quality and training purposes
- **Third-party advertising and listing platforms**: when you engage with
  our adverts or listings on Meta (Facebook/Instagram), Google, LinkedIn,
  Property Finder, Bayut, Dubizzle, or similar platforms, and submit an
  inquiry through them, your name, contact details, and inquiry details are
  passed to us and stored in our CRM.
- **Cookies and similar tracking technologies** deployed via our website and
  advertising pixels (see Section 6).
- Any documents you voluntarily provide during a transaction (e.g. Emirates
  ID, passport, income documentation), whether submitted via the website,
  email, or in person.

## 3. How We Use Your Data

We process personal data for the following purposes, each with a
corresponding legal basis under the PDPL:

- To respond to your inquiry and connect you with the relevant property
  consultant — basis: performance of a contract / pre-contractual steps
  taken at your request.
- To pass your inquiry to the property consultant responsible for the
  relevant listing, location, or service area — basis: legitimate interest
  in fulfilling your request efficiently.
- To maintain records of client and lead interactions in our CRM system
  (Salesforce) — basis: legitimate interest and, in relevant cases, legal
  obligation (e.g. ADREC/DLD record-keeping requirements).
- To send you marketing communications about properties or services that may
  interest you — basis: your consent, which you may withdraw at any time
  (see Section 8).
- To comply with applicable UAE laws and regulatory requirements, including
  those of ADREC and DLD.

## 4. Who We Share Your Data With

Access to your personal data within Bazar is restricted to authorized
personnel — namely, the property consultant(s) assigned to your inquiry and
relevant supervisory or administrative staff — on a need-to-know basis.

We share personal data with the following categories of third parties:

- Salesforce (our Customer Relationship Management platform), which stores
  and processes inquiry and client data on our behalf under a data
  processing agreement.
- Advertising and listing platforms (Meta, Google, LinkedIn, Property
  Finder, Bayut, Dubizzle) to the extent necessary to run campaigns and
  receive inquiries generated through them — governed also by those
  platforms' own privacy policies
- Developers or landlords, where necessary to progress a specific
  transaction, you have inquired about, and only with your knowledge as part
  of that transaction
- Regulatory authorities (including ADREC and DLD), law enforcement, or
  courts, where required by law.

We do not sell, rent, or lease your personal data to any third party.

## 5. Data Retention

We retain personal data collected through inquiries for a period of
[12 MONTHS] from the date of your last interaction with us, or for the
duration of an active transaction plus any period required by ADREC/DLD
record-keeping obligations, whichever is longer.

## 6. Cookies and Tracking Technologies

Our website uses cookies and similar technologies, including advertising
pixels from Meta, Google, and LinkedIn, to operate the site, analyze
traffic, and measure the performance of our advertising campaigns.

## 7. Data Security

We implement appropriate technical and organizational measures designed to
protect personal data against unauthorized access, loss, misuse, or
alteration, including restricted internal access, secure storage within our
CRM, and confidentiality obligations on staff who handle client data. No
method of transmission or storage over the internet is entirely secure, and
we cannot guarantee absolute security of information transmitted to us
online.

## 8. Your Rights

Subject to the PDPL, you have the right to:

- Request access to the personal data we hold about you.
- Request correction of inaccurate or incomplete data.
- Request deletion of your data, subject to our legal and regulatory
  retention obligations.
- Withdraw consent to marketing communications at any time, without
  affecting the lawfulness of processing carried out before withdrawal.
- Object to certain processing carried out on the basis of legitimate
  interest.

To exercise any of these rights, please contact us using the details in
Section 10.

## 9. International Transfers

If you interact with us from outside the UAE, or if we run marketing
campaigns directed at audiences in other countries, your personal data may
be transferred to and processed in the UAE.

## 10. Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy
or your personal data, please contact:

- Email: [info@bazarrealestate.ae](mailto:info@bazarrealestate.ae)
- Address: Sheikha Salama Building, Office 4, Zayed The First Street, Al
  Bateen, Abu Dhabi, United Arab Emirates

## 11. Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in
our practices or legal requirements. The "Last updated" date at the top of
this Policy indicates when it was last revised. Material changes will be
notified via our website.

---

## النص العربي (كما نُشر على /ar/legal/privacy)


### ١. مقدمة


شركة بازار العقارية ذ.م.م. هي شركة وساطة عقارية تم تأسيسها وترخيصها في إمارة أبوظبي، الإمارات العربية المتحدة، ويقع مقرها الرئيسي في البطين، أبوظبي، وتخضع لتنظيم مركز أبوظبي العقاري، ودائرة الأراضي والأملاك في دبي، حينما ينطبق ذلك. توضح سياسة الخصوصية هذه كيفية قيامنا بجمع البيانات الشخصية واستخدامها وتخزينها والإفصاح عنها وحمايتها عند زيارتكم لموقعنا الإلكتروني، أو مواقعنا الإلكترونية، أو تقديم استفسار، أو التواصل معنا عبر تطبيق واتساب أو الهاتف، أو التفاعل بأي صورة أخرى مع خدماتنا.


صدرت هذه السياسة وفقًا للمرسوم بقانون اتحادي لدولة الإمارات العربية المتحدة رقم ٤٥ لسنة ٢٠٢١ بشأن حماية البيانات الشخصية («قانون حماية البيانات الشخصية») ولائحته التنفيذية.


### ٢. البيانات الشخصية التي بجمعها


نجمع البيانات الشخصية من خلال القنوات التالية:

- نماذج التواصل والاستفسار عبر الموقع الإلكتروني: الاسم بالكامل، ورقم الهاتف، وعنوان البريد الإلكتروني، وتفاصيل العقار أو الخدمة التي تهتمون بها.
- التكامل مع تطبيق واتساب: اسمكم، ورقم هاتفكم، ومحتوى الرسائل المتبادلة مع فريقنا.
- التكامل مع المكالمات: رقم هاتفكم، والبيانات الوصفية للمكالمة، بما في ذلك التاريخ والوقت والمدة، وكذلك تسجيلات المكالمات لأغراض الجودة والتدريب، متى كان ذلك مسموحًا به قانونًا وتم الإفصاح عنه لكم.
- منصات الإعلانات والإدراج التابعة للغير: عند تفاعلكم مع إعلاناتنا أو قوائمنا المنشورة على منصات ميتا (فيسبوك/إنستغرام)، أو جوجل، أو لينكدإن، أو بروبرتي فايندر، أو بيوت، أو دوبيزل، أو غيرها من المنصات المماثلة، وتقديم استفسار من خلالها، يتم تزويدنا باسمكم، وبيانات الاتصال بكم وتفاصيل استفساركم، وتُخزن هذه البيانات في نظام إدارة علاقات العملاء الخاص بنا.
- ملفات تعريف الارتباط (الكوكيز) وتقنيات التتبع المماثلة المستخدمة من خلال موقعنا الإلكتروني ووحدات البكسل الإعلانية (يرجى الاطلاع على البند رقم ٦).
- أي مستندات تقدمونها طوعًا أثناء إجراء أي معاملة، مثل بطاقة الهوية الإماراتية أو جواز السفر أو المستندات المثبتة للدخل، سواء تم تقديمها عبر الموقع الإلكتروني أو البريد الإلكتروني أو شخصيًا.

### ٣. كيفية استخدامنا لبياناتكم:


نعالج البيانات الشخصية للأغراض التالية، ولكل غرض منها أساس قانوني مقابل بموجب قانون حماية البيانات الشخصية:

- للرد على استفساركم وربطكم بالمستشار العقاري المختص — الأساس القانوني: تنفيذ عقد/ اتخاذ خطوات سابقة على التعاقد بناءً على طلبكم.
- لإحالة استفساركم إلى المستشار العقاري المسؤول عن القائمة العقارية أو الموقع أو نطاق الخدمة ذي الصلة — الأساس القانوني: المصلحة المشروعة في تلبية طلبكم بكفاءة.
- للاحتفاظ بسجلات تفاعلات العملاء والعملاء المحتملين في نظام إدارة علاقات العملاء الخاص بنا (سيلزفورس) — الأساس القانوني: المصلحة المشروعة، وفي الحالات ذات الصلة، الالتزام القانوني، مثل متطلبات حفظ السجلات الخاصة بمركز أبوظبي العقاري/ دائرة الأراضي والأملاك في دبي.
- لإرسال مراسلات تسويقية إليكم بشأن العقارات أو الخدمات التي قد تهمكم — الأساس القانوني: موافقتكم، التي يجوز لكم سحبها في أي وقت (يرجى الاطلاع على البند رقم ٨).
- للامتثال للقوانين السارية والمتطلبات التنظيمية المعمول بها في دولة الإمارات العربية المتحدة، بما في ذلك متطلبات مركز أبوظبي العقاري ودائرة الأراضي والأملاك في دبي.

### ٤. الجهات التي نشارك بياناتكم معها:


يقتصر الوصول إلى بياناتكم الشخصية داخل شركة بازار على الموظفين المصرح لهم، وهم المستشار العقاري أو المستشارون العقاريون المكلفون بمتابعة استفساركم، وموظفو الإشراف أو الإداريون المعنيون، وذلك على أساس الحاجة إلى الاطلاع.


نشارك البيانات الشخصية مع الفئات التالية من الأطراف الثالثة:

- سيلزفورس (منصة إدارة علاقات العملاء الخاصة بنا)، التي تقوم بتخزين بيانات الاستفسارات والعملاء ومعالجتها نيابةً عنا بموجب اتفاقية لمعالجة البيانات.
- منصات الإعلانات والإدراج العقاري، وهي ميتا وجوجل ولينكدإن وبروبرتي فايندر وبيوت ودوبيزل، بالقدر اللازم لإدارة الحملات وتلقي الاستفسارات الواردة من خلالها، كما تخضع هذه العمليات لسياسات الخصوصية الخاصة بتلك المنصات.
- المطورون أو الملاك، متى كان ذلك ضروريًا للمضي قدمًا في معاملة محددة سبق لكم الاستفسار عنها، وبعلمكم فقط باعتبار ذلك جزءًا من تلك المعاملة.
- الجهات التنظيمية، بما في ذلك مركز أبوظبي العقاري ودائرة الأراضي والأملاك في دبي، أو جهات إنفاذ القانون، أو المحاكم، متى كان ذلك مطلوبًا بموجب القانون.

إننا لا نبيع بياناتكم الشخصية لأي طرف ثالث، ولا نؤجرها أو نمنح حق الانتفاع بها لأي طرف ثالث.


### ٥. الاحتفاظ بالبيانات


نحتفظ بالبيانات الشخصية التي يتم جمعها من خلال الاستفسارات لمدة ١٢ شهرًا اعتبارًا من تاريخ آخر تفاعل لكم معنا، أو طوال مدة أي معاملة قائمة، بالإضافة إلى أي مدة تقتضيها التزامات حفظ السجلات المفروضة من مركز أبوظبي العقاري/دائرة الأراضي والأملاك في دبي، أيهما أطول.


### ٦. ملفات تعريف الارتباط وتقنيات التتبع:


يستخدم موقعنا الإلكتروني ملفات تعريف الارتباط وتقنيات مماثلة، بما في ذلك وحدات البكسل الإعلانية التابعة لميتا وجوجل ولينكدإن، لتشغيل الموقع وتحليل حركة الزيارات وقياس أداء حملاتنا الإعلانية.


### ٧. أمن البيانات


إننا نطبق تدابير تقنية وتنظيمية مناسبة مصممة لحماية البيانات الشخصية من الوصول غير المصرح به أو الفقدان أو إساءة الاستخدام أو التغيير، بما في ذلك تقييد الوصول الداخلي، والتخزين الآمن داخل نظام إدارة علاقات العملاء الخاص بنا، وفرض التزامات السرية على الموظفين الذين يتعاملون مع بيانات العملاء. ولا توجد وسيلة لنقل البيانات أو تخزينها عبر الإنترنت آمنة تمامًا، ولا يمكننا ضمان الأمن المطلق للمعلومات التي يتم إرسالها إلينا عبر الإنترنت.


### ٨. حقوقكم


مع مراعاة أحكام قانون حماية البيانات الشخصية، يحق لكم ما يلي:

- طلب الاطلاع على البيانات الشخصية التي نحتفظ بها عنكم.
- طلب تصحيح البيانات غير الدقيقة أو غير المكتملة.
- طلب حذف بياناتكم، مع مراعاة التزاماتنا القانونية والتنظيمية المتعلقة بالاحتفاظ بالبيانات.
- سحب موافقتكم على تلقي المراسلات التسويقية في أي وقت، دون أن يؤثر ذلك في مشروعية المعالجة التي تمت قبل سحب الموافقة.
- الاعتراض على بعض عمليات المعالجة التي تتم استنادًا إلى المصلحة المشروعة.

لممارسة أي من هذه الحقوق، يرجى التواصل معنا باستخدام البيانات الواردة في البند رقم ١٠.


### ٩. عمليات النقل الدولية:


في حال تفاعلكم معنا من خارج دولة الإمارات العربية المتحدة، أو إذا قمنا بإدارة حملات تسويقية موجهة إلى جمهور في دول أخرى، فقد يتم نقل بياناتكم الشخصية إلى دولة الإمارات العربية المتحدة ومعالجتها فيها.


### ١٠. تواصل معنا


إذا كانت لديكم أي أسئلة أو مخاوف أو طلبات تتعلق بسياسة الخصوصية هذه أو ببياناتكم الشخصية، يرجى التواصل معنا عبر:

- البريد الإلكتروني: info@bazarrealestate.ae
- العنوان: مبنى الشيخة سلامة، مكتب رقم ٤، شارع زايد الأول، البطين، أبوظبي، الإمارات العربية المتحدة.

### ١١. التغييرات على هذه السياسة


يجوز لنا تحديث سياسة الخصوصية هذه من وقت إلى آخر بما يعكس التغييرات التي تطرأ على ممارساتنا أو المتطلبات القانونية. ويبين تاريخ «آخر تحديث» الوارد في أعلى هذه السياسة تاريخ آخر مراجعة لها. وسيتم الإخطار بأي تغييرات جوهرية من خلال موقعنا الإلكتروني.


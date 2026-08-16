/**
 * The canonical Arabic for every place, developer and project name on the site.
 *
 * ## Why these are hand-curated and not translated
 *
 * Two reasons, and the second is the load-bearing one.
 *
 * A name is not prose. Most Abu Dhabi toponyms are *Arabic in origin* and were
 * transliterated into English to begin with — "Saadiyat" is السعديات, "Al Reem"
 * is الريم. Asking a model to translate them is asking it to re-derive an
 * original it cannot see, and it will produce a plausible, different answer
 * every time.
 *
 * And `validate()` rejects any Latin run of four or more characters as
 * `latin-leak`. So on a corpus where area and developer names appear in a large
 * fraction of all strings, an unmasked name leaves exactly two outcomes: the
 * model preserves the Latin and the field is rejected and stays English, or it
 * invents a transliteration that passes and disagrees with the last one. That
 * makes this list the difference between a usable pass rate and a wall of
 * rejections — not a consistency nicety.
 *
 * `mask(text, terms)` protects them as sentinels and `unmask(…, overrides)`
 * substitutes the Arabic below. A name with `ar: null` still travels as a
 * sentinel, so it cannot trip `latin-leak` either: the English survives
 * verbatim, which is normal on UAE property sites and never wrong.
 *
 * ## What `confidence` means, and what still needs a human
 *
 *  - `official`    — the entity's own Arabic, or an Abu Dhabi authority's.
 *  - `established` — no single owner, but one settled form is in real use.
 *  - `proposed`    — no Arabic found in use. Needs sign-off before it ships.
 *  - `keep-latin`  — an international brand whose Arabic copy keeps the Latin
 *                    name. `ar: null`. A correct and expected answer, not a gap.
 *
 * **This list is a proposal for the client to approve, not a decision.** Every
 * entry carries where it came from, and `note` flags the ones where sources
 * genuinely disagree. The one to look at first is `Al Maryah Island`: the
 * island's own site writes جزيرة الماريه, most portals write جزيرة المارية,
 * and both are live. The entity's own usage wins here by rule, but it is a
 * judgement someone should make on purpose.
 */

export type NounConfidence = "official" | "established" | "proposed" | "keep-latin";

export type NounEntry = {
  /** The English name, exactly as it appears in the database. */
  en: string;
  /** The Arabic to substitute, or null to keep the Latin name. */
  ar: string | null;
  kind: "area" | "developer" | "development" | "brand";
  confidence: NounConfidence;
  /** A URL, or why the answer is null. */
  source: string;
  /** Variants seen, ambiguity, anything a reviewer needs. */
  note?: string;
};

export const PROPER_NOUNS: NounEntry[] = [
  /*
   * The brand, sourced from the message catalogue rather than written again
   * here — `messages.test.ts` already guards that value, and one spelling of
   * the client's own name is the minimum this file owes.
   */
  {
    en: "Bazar",
    ar: "بازار",
    kind: "brand",
    confidence: "official",
    source: "messages/ar/common.json — the client's own catalogue",
    note: "Appears in about_bazar and why_band copy on nearly every page.",
  },
  {
    en: "ADGM",
    ar: "سوق أبوظبي العالمي",
    kind: "area",
    confidence: "official",
    source: "https://ar.wikipedia.org/wiki/سوق_أبوظبي_العالمي ; corroborated by Abu Dhabi SME Hub official Arabic page https://www.adsmehub.ae/ar/partner-details/abu-dhabi-global-market",
    note: "This is the free zone / financial centre on Al Maryah Island, not a residential community — check whether it belongs in the area taxonomy at all. Arabic property and business copy very often keeps the Latin acronym 'ADGM' alongside or instead of the full name (سوق أبوظبي العالمي (ADGM)); consider rendering the full Arabic name with the Latin acronym in parentheses. Note the acronym itself is never",
  },
  {
    en: "Al Bateen",
    ar: "البطين",
    kind: "area",
    confidence: "official",
    source: "Arabic toponym - restoring original; the client's own address in lib/master-pages/sections/contact-qr.ts is written البطين",
    note: "Not an `areas` row, so it was missed by the first sourcing pass. It is in the firm's own office address and in the /home stats, where an unmasked \"Al Bateen\" back-translated as \"the hidden things\" — the literal sense of the Arabic root.",
  },
  {
    en: "Abu Dhabi",
    ar: "أبوظبي",
    kind: "area",
    confidence: "official",
    source: "Arabic toponym - restoring original; Abu Dhabi Government portal (abudhabi.gov.ae/ar) and UAE federal portal (u.ae/ar-ae) both render the emirate as أبوظبي",
    note: "Two orthographies are both in real use: أبوظبي (closed, one word) is the Abu Dhabi Government's own house style and what the local Official Gazette uses; أبو ظبي (with a space) is common in federal documents, Arabic Wikipedia article titles, and pan-Arab media. Recommend أبوظبي for an Abu Dhabi property site to match the local authority, and applying the same choice consistently wherever the emira",
  },
  {
    en: "Al Ghadeer",
    ar: "الغدير",
    kind: "area",
    confidence: "official",
    source: "Aldar Properties Arabic newsroom: https://www.aldar.com/ar/news-and-media/aldar-unveils-al-ghadeer-gardens-bringing-modern-family-living-to-the-key-growth-corridor-between-abu-dhabi-and-dubai ; also Dubizzle Arabic area ",
    note: "Arabic toponym (الغدير = a pool/brook). The master developer Aldar uses الغدير in its own Arabic releases. Its newer sub-community 'Al Ghadeer Gardens' appears in Arabic as both الغدير غاردنز (Aldar's own transliterated form) and حدائق الغدير (agent sites) — if that sub-community is ever added as its own area, follow Aldar and use الغدير غاردنز.",
  },
  {
    en: "Al Jurf",
    ar: "الجرف",
    kind: "area",
    confidence: "official",
    source: "Imkan Properties Arabic site https://arabic.aljurfvillas.com/ ; Al Ittihad newspaper coverage https://www.aletihad.ae/article/66663/2018/ ; Argaam Arabic",
    note: "Arabic toponym, in the Ghantoot (غنتوت) corridor between Abu Dhabi and Dubai. Developer Imkan (إمكان العقارية) writes it الجرف. Its sub-districts have their own Arabic names — حدائق الجرف (Al Jurf Gardens), جوار القصر, مرسى الجرف — so do not let a listing tagged with a sub-district collapse to الجرف if the sub-district is what is meant.",
  },
  {
    en: "Al Maryah Island",
    ar: "جزيرة الماريه",
    kind: "area",
    confidence: "official",
    source: "Official destination site https://almaryahisland.ae/ar/ and https://almaryahisland.ae/ar/about/ — uses جزيرة الماريه throughout header, nav and body",
    note: "REVIEWER DECISION NEEDED on the final letter. The island's own official Arabic site consistently writes جزيرة الماريه (ending in ه); the widely used alternative is جزيرة المارية (ending in ة), which is what Arabic Wikipedia's main article, OpenSooq and most portals use. Both forms are live — Arabic Wikipedia in fact carries pages under each. Rule 6 (prefer the entity's own usage) points to جزيرة ا",
  },
  {
    en: "Al Raha",
    ar: "الراحة",
    kind: "area",
    confidence: "established",
    source: "Arabic toponym - restoring original; https://ar.wikipedia.org/wiki/الراحة_(أبو_ظبي) (article confirmed live, exact title \"الراحة (أبو ظبي)\"); Aldar-adjacent Arabic listings e.g. https://psinv.net/ar/projects/abu-dhabi/al",
    note: "CONFIRMED. الراحة is the genuine Arabic original; \"Al Raha\" is its transliteration. The proposal's claim about two sub-communities also checks out — the ar.wikipedia article describes the area as consisting of شاطئ الراحة (Al Raha Beach) and حدائق الراحة (Al Raha Gardens). Reviewer caution: Arabic sources almost never say bare الراحة in running copy; they say شاطئ الراحة or حدائق الراحة. Bare الرا",
  },
  {
    en: "Al Raha Beach",
    ar: "شاطئ الراحة",
    kind: "area",
    confidence: "official",
    source: "Aldar Properties Arabic community page https://www.aldar.com/ar/explore-aldar/businesses/development/residential/al-raha-beach ; Bayut Arabic area guide https://www.bayut.com/area-guides/al-raha-beach/",
    note: "Developer Aldar's own Arabic name. Its eleven sub-precincts each have Arabic names already in use — الزينة، خور الراحة، البندر، السيف، الدانة، الرميلة، الزاهية، الليسيلي، الشليلة، الرزين، الثريا — worth sourcing separately if they exist as areas in the DB. Do not confuse with فندق شاطئ الراحة (Al Raha Beach Hotel), a different entity.",
  },
  {
    en: "Al Raha Gardens",
    ar: "حدائق الراحة",
    kind: "area",
    confidence: "official",
    source: "Aldar Properties Arabic materials and Al Bayan press coverage https://www.albayan.ae/economy/2008-02-06-1.614677 ; Aldar community portal https://www.my-community.com/aldar/alrahagardens/ar/live/al-raha ; Bayut Arabic ar",
    note: "Translated-in-Arabic form (حدائق = gardens), not a transliteration, and it is the form Aldar itself and the Arabic press use — so this is sourced, not invented. Its sub-communities also carry Arabic names (e.g. لحوية / Lehweih, قطوف / Qattouf). Note the contrast with Al Ghadeer Gardens, where Aldar chose the transliteration الغدير غاردنز instead — do not normalise the two to one pattern.",
  },
  {
    en: "Al Reem Island",
    ar: "جزيرة الريم",
    kind: "area",
    confidence: "official",
    source: "Arabic toponym - restoring original; universal across Arabic property portals (Bayut, Dubizzle Abu Dhabi Arabic, OpenSooq, Metropolitan, PSI) and Abu Dhabi municipal usage",
    note: "Completely settled — I found no competing Arabic spelling. الريم (the gazelle/oryx) is the original Arabic name that 'Reem' transliterates. Keep the definite article: جزيرة الريم, never جزيرة ريم. Sub-developments have their own Arabic names (مدينة شمس، مارينا سكوير، نجمة أبوظبي) if those are separate areas in the DB.",
  },
  {
    en: "Corniche",
    ar: "الكورنيش",
    kind: "area",
    confidence: "established",
    source: "Abu Dhabi DMT Arabic page confirmed live at https://www.dmt.gov.ae/ar-AE/adm/Abu-Dhabi-Corniche-Beach (uses \"شاطئ كورنيش أبوظبي\"); Al Ittihad / DMT municipal releases use \"كورنيش أبوظبي\" and \"شاطئ الكورنيش\"",
    note: "FORM CONFIRMED, SOURCE FIELD WRONG. الكورنيش is genuinely the form in use, so ship it. But the proposal labels it \"Arabic toponym - restoring original\" and that is factually incorrect: corniche is a French loanword naturalised into Arabic as كورنيش, not an Arabic original that was transliterated into English. If that source string is stored or shown anywhere, fix it to \"established Arabic renderin",
  },
  {
    en: "Fahid Island",
    ar: "جزيرة فاهد",
    kind: "area",
    confidence: "official",
    source: "Aldar's own Arabic project page https://www.aldar.com/properties/ar/Fahid-Island and Arabic launch release https://www.aldar.com/ar/news-and-media/aldar-unveils-fahid-island",
    note: "Aldar's current Arabic branding is جزيرة فاهد, with no definite article — that is what its Arabic marketing site and launch release use, and Al Arabiya/Argaam followed it. Two competing variants exist and should NOT be used: (1) جزيرة الفاهد, which Aldar itself used in its earlier 2024 land-acquisition release (https://www.aldar.com/ar/news-and-media/al-fahid-island-acquisition) and which still ap",
  },
  {
    en: "Hidd Al Saadiyat",
    ar: "حد السعديات",
    kind: "area",
    confidence: "established",
    source: "Arabic toponym - restoring original; https://leaddevelopment.ae/projects/hidd-al-saadiyat/ , https://www.tanamiproperties.ae/Projects/حد-السعديات , https://psinv.net/ar/projects/abu-dhabi/saadiyat-island/hidd-al-saadiyat",
    note: "CONFIRMED. حد السعديات appears consistently across independent Arabic property sources including pages for the actual developer (شركة السعديات للتنمية والاستثمار / SDIC). Both cited URLs check out. Note السعديات carries ال but حد does not — that is correct idafa and must not be \"normalised\" to الحد السعديات for visual consistency with sibling area names.",
  },
  {
    en: "Hudayriyat Island",
    ar: "جزيرة الحديريات",
    kind: "area",
    confidence: "official",
    source: "Arabic toponym - restoring original; Abu Dhabi Government Media Office Arabic topic page https://www.mediaoffice.abudhabi/ar/topic/al-hudayriyat-island/",
    note: "Government Arabic keeps the definite article (الحديريات) even though the current English branding by Modon drops the \"Al\" (\"Hudayriyat Island\", hudayriyatisland.ae). Older English usage \"Al Hudayriyat Island\" still appears on the Media Office's English pages. Per rule 7 the Arabic article stays regardless of what the English brand does.",
  },
  {
    en: "Jubail Island",
    ar: "جزيرة الجبيل",
    kind: "area",
    confidence: "official",
    source: "Arabic toponym - restoring original; Abu Dhabi Government Media Office Arabic topic page https://www.mediaoffice.abudhabi/ar/topic/al-jubail-island/",
    note: "Same article asymmetry as Hudayriyat: the developer's English brand is \"Jubail Island\" with no \"Al\", but Arabic is جزيرة الجبيل with the article, and the Media Office's own URL slug is al-jubail-island. Do not strip the ال to mirror the English. Adjacent names on the site will likely include محمية الجبيل للمانغروف / حديقة الجبيل للمانغروف (Jubail Mangrove Park) — same الجبيل.",
  },
  {
    en: "KIZAD",
    ar: "كيزاد",
    kind: "area",
    confidence: "established",
    source: "https://www.kezadgroup.com/ar (entity's own Arabic site; uses \"مجموعة كيزاد\" and \"مناطق خليفة الاقتصادية أبوظبي – مجموعة كيزاد\", and \"مدينة خليفة الصناعية\" for the industrial city); https://www.adports.ae/ar/2011/03/08/.",
    note: "PROPOSAL NOT CONFIRMED AS CURRENT — I changed the answer. The proposed string منطقة خليفة الصناعية (كيزاد) is real and is attested on the cited kezadgroup press-release URL, so it was not invented. Two problems with shipping it. (1) Stale brand: KIZAD was rebranded KEZAD (Khalifa Economic Zones Abu Dhabi) in 2021/22 and the entity's own Arabic site now writes مجموعة كيزاد / مناطق خليفة الاقتصادية ",
  },
  {
    en: "Khalifa City",
    ar: "مدينة خليفة",
    kind: "area",
    confidence: "established",
    source: "Arabic toponym - restoring original; https://ar.wikipedia.org/wiki/مدينة_خليفة_(أبوظبي) ; https://psinv.net/ar/articles/area-guide/abu-dhabi/khalifa-city",
    note: "CONFIRMED, WITH A DATA-MODEL WARNING. مدينة خليفة is correct. The warning is bigger than the translation: Abu Dhabi renamed the sub-districts, and the Arabic names diverge from the English ones. Khalifa City A → مدينة خليفة; Khalifa City B → مدينة شخبوط (Shakhbout City); New Khalifa City → مدينة زايد (Zayed City). So if the areas table also holds \"Khalifa City A\" or \"Khalifa City B\" rows, they mus",
  },
  {
    en: "Mamsha Al Saadiyat",
    ar: "ممشى السعديات",
    kind: "area",
    confidence: "official",
    source: "Aldar's Arabic community page https://www.aldar.com/ar/explore-aldar/businesses/development/residential/saadiyat-island/mamsha-al-saadiyat and Arabic landing page https://www.aldar.com/ar/mamsha-landing",
    note: "The English name is itself a transliteration of the Arabic — ممشى means \"promenade/walkway\" — so this is a restoration, not a translation, and Aldar publishes it in Arabic on its own site. Article pattern: ممشى bare, السعديات with ال. Related Aldar sub-brands on the same site keep Latin/mixed forms in Arabic copy: \"ممشى جاردنز\" (Mamsha Gardens, also written حدائق ممشى السعديات) and \"ممشى بيتش\" (Ma",
  },
  {
    en: "Masdar City",
    ar: "مدينة مصدر",
    kind: "area",
    confidence: "official",
    source: "Masdar City's own Arabic site https://masdarcity.ae/ar/about-masdar; also UAE Ministry of Economy & Tourism (https://www.moet.gov.ae) and Mubadala Arabic (https://www.mubadala.com/ar/what-we-do/masdar-city)",
    note: "مصدر is the Arabic original (\"source\"), used bare with no definite article; the English is the transliteration. Confirmed on the entity's own Arabic site and on UAE federal government pages, so this is as official as it gets. Do not write المدينة or add ال to مصدر.",
  },
  {
    en: "Mussafah",
    ar: "مصفح",
    kind: "area",
    confidence: "official",
    source: "Arabic toponym - restoring original. Confirmed at https://www.adports.ae/ports-terminals/commercial-ports/musaffah-port/ (Abu Dhabi Ports Arabic: ميناء مصفح), https://ar.wikipedia.org/wiki/مصفح, and Bayut Arabic area gui",
    note: "Arabic in origin; the English is a transliteration. Written without the definite article by the municipality, Abu Dhabi Ports and Bayut — do not render as المصفح. Sub-districts appear in Arabic as مصفح الصناعية (Mussafah Industrial) and numbered sectors e.g. مصفح م-7; use Western digits for those.",
  },
  {
    en: "Nurai Island",
    ar: "جزيرة نوراي",
    kind: "area",
    confidence: "established",
    source: "https://www.bayut.com/area-guides/ar/جزيرة-نوراي (Arabic area-guide URL confirmed via the language toggle on the English guide); https://arabic.cnn.com/travel/article/2020/10/26/nurai-island-abu-dhabi-bonjour-sunset (CNN",
    note: "CONFIRMED. جزيرة نوراي is the established Arabic form across Arabic press and property sources. The cited Bayut Arabic URL is real — I verified it from the language toggle on the English guide. One correction to the reasoning rather than the answer: نوراي is not a straightforward pre-existing Arabic toponym — the CNN Arabic piece describes the name as derived from النور (light), i.e. a coined reso",
  },
  {
    en: "Saadiyat Island",
    ar: "جزيرة السعديات",
    kind: "area",
    confidence: "official",
    source: "Arabic toponym - restoring original. https://visitabudhabi.ae/ar/where-to-go/islands (Abu Dhabi DCT Arabic), https://ar.wikipedia.org/wiki/جزيرة_السعديات, https://www.jumeirah.com/ar/stay/abu-dhabi/jumeirah-at-saadiyat-i",
    note: "Definite article on السعديات is correct and universal for the island itself. Note the contrast with Aldar's project names below, which drop it (سعديات ريزيرف) or keep it (السعديات لاغونز) inconsistently — follow each entity's own usage rather than normalising.",
  },
  {
    en: "Saadiyat Lagoons",
    ar: "السعديات لاغونز",
    kind: "area",
    confidence: "official",
    source: "Aldar Properties Arabic press release https://www.aldar.com/ar/news-and-media/aldar-launches-saadiyat-lagoons (23 occurrences, no competing spelling on the page); mirrored by Zawya Arabic and Argaam Arabic",
    note: "Developer's own Arabic. Aldar transliterates 'Lagoons' as لاغونز (with غ), not لاجونز — the لاجونز spelling appears on third-party brokerage sites (opr.ae, tanamiproperties.ae) but not on Aldar's own site. Keeps the definite article on السعديات, unlike Saadiyat Reserve.",
  },
  {
    en: "Saadiyat Reserve",
    ar: "سعديات ريزيرف",
    kind: "area",
    confidence: "official",
    source: "Aldar Properties Arabic project page https://www.aldar.com/ar/explore-aldar/businesses/development/residential/saadiyat-island/saadiyat-reserve — page <title> is 'سعديات ريزيرف: مجتمعات سكنية فاخرة في جزيرة سعديات | الدا",
    note: "Aldar's own page is internally inconsistent: سعديات ريزيرف appears 12 times including the page title and all body prose, while سعديات رزيرف (no ي after ر) appears 6 times in carousel/nav labels. Picked the title-tag and prose form. Aldar drops the definite article here (سعديات, not السعديات) — that is their usage, kept per rule 7.",
  },
  {
    en: "Yas Acres",
    ar: "ياس ايكرز",
    kind: "area",
    confidence: "official",
    source: "Aldar Properties Arabic project page https://www.aldar.com/ar/explore-aldar/businesses/development/residential/yas-island/yas-acres (23 occurrences, single consistent spelling)",
    note: "Developer's own Arabic, spelled with plain alif (ايكرز), not hamza. Third-party sites use ياس إيكرز and ياس أيكرز; Aldar's own site uses neither. Sub-phases follow the same pattern in Arabic marketing (e.g. ياس ايكرز ذا أوركيدز, ياس ايكرز نورث باي) but those were only verified on broker sites, not on aldar.com.",
  },
  {
    en: "Yas Island",
    ar: "جزيرة ياس",
    kind: "area",
    confidence: "official",
    source: "Arabic toponym - restoring original. https://visitabudhabi.ae/ar/where-to-go/islands/yas-lsland (Abu Dhabi DCT Arabic), https://ar.wikipedia.org/wiki/جزيرة_ياس, Aldar Arabic site",
    note: "Arabic in origin (ياس, the Bani Yas tribal name); the English is a transliteration. No definite article on ياس. Do not confuse with جزيرة صير بني ياس (Sir Bani Yas Island), a separate island in Al Dhafra.",
  },
  {
    en: "Zayed City",
    ar: "مدينة زايد",
    kind: "area",
    confidence: "official",
    source: "https://ar.wikipedia.org/wiki/مدينة_زايد_(الإمارات); Bloom Holding Arabic area guide https://bloomholding.com/ar/articles/zayed-city-abu-dhabi-area-guide (uses مدينة زايد أبوظبي)",
    note: "Arabic in origin. IMPORTANT DISAMBIGUATION: مدينة زايد alone is ambiguous in the UAE — it also names (a) Madinat Zayed in the Al Dhafra region, a separate town ~150km west, and (b) the Madinat Zayed district/shopping centre in central Abu Dhabi. If the site lists any of those, disambiguate this one as مدينة زايد أبوظبي, which is what Bloom (a developer active there) writes. Formerly branded منطقة ",
  },
  {
    en: "Aldar Properties",
    ar: "الدار العقارية",
    kind: "developer",
    confidence: "official",
    source: "https://www.aldar.com/ar — company's own Arabic site; page title reads \"شركة الدار العقارية\"",
    note: "Arabic-origin name (الدار = \"the abode\"), so this restores the original rather than translating. The company's own Arabic site title carries the legal prefix \"شركة\" (شركة الدار العقارية ش.م.ع); the brand form used in running copy and on Arabic press/LinkedIn is الدار العقارية, which is what is given here. Drop to just \"الدار\" only where the English also drops \"Properties\".",
  },
  {
    en: "Arada Developments",
    ar: "أرادَ للتطوير العقاري",
    kind: "developer",
    confidence: "official",
    source: "https://www.arada.com/ar — company's own Arabic site title and running copy",
    note: "The company deliberately writes a fatha on the dāl (أرادَ) as part of its wordmark; ar.wikipedia and most press write it undiacriticised as أراد. If your typography or search indexing is unhappy with the diacritic, أراد للتطوير العقاري is a safe equivalent. Sharjah-based developer, so the name is Arabic in origin (أرادَ = \"willed/intended\").",
  },
  {
    en: "Baraka Real Estate Development",
    ar: "بركة للتطوير العقاري",
    kind: "developer",
    confidence: "official",
    source: "https://www.barakadevelopment.ae/ar/ — company's own Arabic site title",
    note: "Arabic-origin name (بركة = \"blessing\"). Note the company's own Arabic brand phrase is \"للتطوير العقاري\" (Development) rather than a literal rendering of \"Real Estate Development\" — do not expand it. PropertyFinder's Arabic listing misspells it بركه (with hāʾ); the company itself uses بركة with tāʾ marbūṭa.",
  },
  {
    en: "Binghatti Developers",
    ar: "بن غاطي للتطوير العقاري",
    kind: "developer",
    confidence: "established",
    source: "https://ar.wikipedia.org/wiki/بن_غاطي_للتطوير_العقاري ; Al Bayan «بن غاطي للتطوير» https://www.albayan.ae/amp/economy/business/real-estate/1809 ; Al Watan «بن غاطي العقارية» https://alwatan.ae/posts/1587947 ; Emarat Al Y",
    note: "CONFIRMED. I fetched binghatti.com directly: English only, no Arabic locale and no language switcher, so there is no first-party Arabic form to defer to. The transliteration بن غاطي (two words, not بنغاطي) is unanimous across every Arabic source I checked. Only the descriptor varies by outlet and by legal entity: «بن غاطي للتطوير» (Al Bayan), «بن غاطي العقارية» (Al Watan), «بن غاطي القابضة» = Bing",
  },
  {
    en: "Bloom Holding",
    ar: "بلووم القابضة",
    kind: "developer",
    confidence: "official",
    source: "https://bloomholding.com/ar/contact-us — company's own Arabic site; renders as \"شركة بلووم القابضة\"",
    note: "Transliteration of an English brand, but the company maintains its own Arabic name, so use it. Note the double wāw (بلووم) — that is the company's spelling and ar.wikipedia follows it; several portals (dxboffplan, tanamiproperties) use single-wāw بلوم, which is the variant to avoid. The real-estate arm appears in Arabic press as بلووم العقارية.",
  },
  {
    en: "Burtville Developments",
    ar: "برتڤيل للتطوير العقاري",
    kind: "developer",
    confidence: "official",
    source: "https://www.burtville.com/ar/about-us and the company's Arabic press releases, e.g. https://www.burtville.com/ar/news/burtville-developments-launches-the-ville-11-in-masdar-city/",
    note: "The company's own site is internally inconsistent: body copy and all Arabic press-release headlines use برتڤيل (with ڤ, three-dot fāʾ, for the /v/), while the site's <title> template uses the plainer برتفيل. Rule 6 says prefer the entity's own usage in its own prose, hence برتڤيل. If your font stack or Arabic search config handles ڤ badly, برتفيل للتطوير العقاري is the documented fallback. Third-p",
  },
  {
    en: "DAMAC Properties",
    ar: "داماك العقارية",
    kind: "developer",
    confidence: "official",
    source: "https://www.damacproperties.com/ar/ and https://www.damacproperties.com/ar/about-damac/ — company's own Arabic site (fetch returns 403 to bots; confirmed via indexed page titles, e.g. \"لماذا داماك العقارية\")",
    note: "Note the Arabic brand is العقارية (feminine, agreeing with an implied شركة), not للتطوير العقاري. Bare داماك is used in headlines and for the wider group (مجموعة داماك). Confidence is \"official\" on the strength of first-party page titles; direct page fetch was blocked, so a human reviewer opening damacproperties.com/ar in a browser is a cheap final check.",
  },
  {
    en: "Deyaar Development",
    ar: "ديار للتطوير",
    kind: "developer",
    confidence: "official",
    source: "https://www.deyaar.ae/ar/ — company's own Arabic site; also its Facebook handle \"Deyaar Development ديار للتطوير\"",
    note: "Arabic-origin name (ديار = \"dwellings/homes\"). The full legal form on the Arabic site and on DFM filings is ديار للتطوير ش.م.ع; ديار للتطوير is the brand form and matches the English \"Deyaar Development\" one-for-one — note it is not ديار العقارية, which some portals use. No definite article: it is ديار, not الديار.",
  },
  {
    en: "Dubai Properties",
    ar: "دبي للعقارات",
    kind: "developer",
    confidence: "official",
    source: "https://www.dp.ae/ar — the developer's own Arabic homepage; also ar.wikipedia.org/wiki/دبي_للعقارات and https://www.dubaiholding.com/en/our-business/our-companies/dubai-holding-real-estate",
    note: "Company's own Arabic site uses دبي للعقارات in the masthead and nav — a real translation, not a transliteration, so no ال on دبي. Corporate context: the brand now sits under Dubai Holding Real Estate (دبي القابضة للعقارات); if the site ever needs the parent, that is a different string. No variants found.",
  },
  {
    en: "Eagle Hills",
    ar: "إيجل هيلز",
    kind: "developer",
    confidence: "official",
    source: "https://eaglehillsjordan.com/ar/about-us/ — Eagle Hills' own Arabic-language site for its Jordan arm; corroborated by ar.wikipedia.org/wiki/إيجل_هيلز and the Eagle Hills UAE Arabic Facebook page (https://ar-ar.facebook.c",
    note: "Transliteration, not translation — no Arabic meaning is intended. Group flagship eaglehills.com has no Arabic locale, so the Jordan entity's Arabic site is the best first-party evidence; it writes إيجل هيلز. Variant إيغل هيلز (with غ) appears on some third-party portals — do not use it, the company writes ج.",
  },
  {
    en: "Emaar Properties",
    ar: "إعمار العقارية",
    kind: "developer",
    confidence: "official",
    source: "https://www.emaar.com/ar — the company's own Arabic site; legal name confirmed on DFM: https://www.dfm.ae/the-exchange/market-information/company/EMAAR/profile (إعمار العقارية ش.م.ع)",
    note: "Full legal/listed name is إعمار العقارية ش.م.ع; use the short form إعمار العقارية for display, or bare إعمار where the shorthand fits. Do not confuse with the separately listed subsidiary إعمار للتطوير ش.م.ع (Emaar Development, DFM: EMAARDEV) — different company.",
  },
  {
    en: "ICT Real Estate Development",
    ar: "آي سي تي للتطوير العقاري",
    kind: "developer",
    confidence: "established",
    source: "https://www.aletihad.ae/news/الإمارات/4473782/ — Al Ittihad (Abu Dhabi), verbatim: «تتولّى شركة آي سي تي للتطوير العقاري تصميم وإنشاء المشروع» ; also Al Khaleej https://www.alkhaleej.ae/2024-03-26/خالد-بن-محمد-يطلق-مشروع",
    note: "CONFIRMED, and the proposed confidence is TOO LOW — upgrade \"proposed\" to \"established\". The submitted note claims only third-party property portals use this form. That is wrong. The March 2024 Yas Canal launch (1,146 villas, AED 3.5bn, approved by the Crown Prince) was carried in Arabic by WAM and reproduced by Al Ittihad and Al Khaleej, all naming the developer as «شركة آي سي تي للتطوير العقاري»",
  },
  {
    en: "IFA Hotels & Resorts",
    ar: "شركة إيفا للفنادق والمنتجعات",
    kind: "developer",
    confidence: "official",
    source: "Registered Arabic legal name on the Kuwait listing: https://www.emis.com/php/company-profile/KW/ (Ifa Hotels & Resorts Co K.P.S.C — شركة إيفا للفنادق والمنتجعات ش.م.ك مقفلة); Arabic financial press uses the same, e.g. ht",
    note: "Kuwait-listed (Boursa Kuwait, ticker IFAHR); subsidiary of International Financial Advisors. The company's own site ifahotelsresorts.com is English-only, so this comes from the registered Arabic legal name and consistent Kuwaiti financial-press usage rather than company marketing. Drop شركة for a compact display form: إيفا للفنادق والمنتجعات. Note إيفا is a phonetic rendering of the initialism IFA",
  },
  {
    en: "IMKAN Properties",
    ar: "إمكان العقارية",
    kind: "developer",
    confidence: "official",
    source: "https://www.imkan.ae/ar/news — the developer's own Arabic newsroom, which uses إمكان العقارية across its release headlines",
    note: "Arabic-origin brand name (إمكان, \"possibility/enablement\") that was Latinised as IMKAN, so this restores the original word. The company's own Arabic pages use three forms: bare إمكان, شركة إمكان in running text, and إمكان العقارية as the standard formal designation in headlines — I picked the last as the display name. No ال on إمكان, matching the company's own writing.",
  },
  {
    en: "MODON Properties",
    ar: "مُدن العقارية",
    kind: "developer",
    confidence: "official",
    source: "https://www.modon.com/ar — the company's own Arabic site (footer: \"© مُدن 2026\", body: \"مُدن العقارية\", \"تعمل مُدن على إنشاء مجتمعات سكنية\")",
    note: "Arabic-origin name (مُدن = \"cities\"), so this is the original, not a translation. The company's own site writes مُدن with the damma as a brand/disambiguation mark; Emirati press (WAM, Al Bayan, Zawya Arabic press releases) writes it undiacritized as مدن العقارية, and bare \"مدن\" in headlines. If diacritics would break search/matching in the CMS, مدن العقارية is a safe equivalent. Parent company is ",
  },
  {
    en: "Meraas",
    ar: "مِراس",
    kind: "developer",
    confidence: "official",
    source: "https://meraas.com/ar — the developer's own Arabic site, which brands itself مِراس with the kasra; press and the parent use the plain form, e.g. https://arabic.cnn.com/business/article/2020/06/09/meraas-part-dubai-holdin",
    note: "IMPORTANT variant decision: Meraas' own site writes the name with an explicit kasra — مِراس — as a brand styling, and per the \"use what the entity uses\" rule I chose that. The undiacriticised مراس is what CNN Arabic, Wikipedia and the wider press use. If the site's search/slug layer does not normalise Arabic diacritics, use مراس for indexing and keep مِراس only for display, otherwise the name will",
  },
  {
    en: "Miral",
    ar: "ميرال",
    kind: "developer",
    confidence: "official",
    source: "Miral's own Arabic investment brochure at https://miral.ae/wp-content/uploads/2021/02/Miral-Investment-Brochure-Arabic.pdf (شركة ميرال); Abu Dhabi government and Masdar Arabic press use the same, e.g. https://masdar.ae/a",
    note: "Abu Dhabi (Yas Island / Saadiyat) developer and operator; legal entity Miral Asset Management LLC. Company's own Arabic material writes شركة ميرال in running text; ميرال alone is the display name. No ال. Its subsidiary Miral Experiences is a separate entity — do not merge them.",
  },
  {
    en: "NIC Developers",
    ar: "الشركة الوطنية للاستثمار",
    kind: "developer",
    confidence: "official",
    source: "https://www.nicuae.ae/عن-الشركة/ — the company's own Arabic \"About\" page, which heads itself \"الشركة الوطنية للإستثمار (ش.م.خ)\"",
    note: "Two things a reviewer should check. (1) Orthography: the company's own page spells it للإستثمار with a hamza on the alif, which is non-standard; I have given the standard spelling للاستثمار, which is also what property portals use. Use the site's spelling instead if you want a literal match to their branding. (2) Identity: \"NIC Developers\" is not a name the company uses — its own English name is N",
  },
  {
    en: "Nakheel",
    ar: "نخيل",
    kind: "developer",
    confidence: "official",
    source: "Arabic toponym - restoring original (نخيل = palm trees). Corroborated by WAM https://www.wam.ae/ar/article/hszrfc62 and Al Ittihad https://www.aletihad.ae/news/الاقتصادي/4309883, both writing «نخيل»",
    note: "Nakheel's own site (nakheel.com) is English-only — there is no /ar version — so the confirmation is UAE state media plus Arabic Wikipedia (نخيل العقارية). The English given is the bare brand \"Nakheel\", so the bare نخيل matches; the full legal form is شركة نخيل ش.م.خ, and portals commonly extend it to نخيل العقارية. Dubai developer, not Abu Dhabi. Nakheel was folded under Dubai Holding in 2024 but ",
  },
  {
    en: "National Holding",
    ar: "الوطنية القابضة",
    kind: "developer",
    confidence: "established",
    source: "https://www.albayan.ae/economy/2009-05-27-1.437988 — «الوطنية القابضة» described as «الشركة القابضة الخاصة التي تتخذ من أبوظبي مقراً لها», subsidiaries الإمارات الدولية للاستثمار، بلووم، إكسيد الصناعية، رايز للتجارة العا",
    note: "CONFIRMED, with two caveats a reviewer should see. (1) Identity check passes: I fetched the Al Bayan article and the subsidiary list (EIIC, Bloom, Exeed, Rise, Petromal) is the Abu Dhabi group, and I independently corroborated the Bloom link — bloomholding.com's own Arabic pages describe بلووم القابضة as part of مجموعة الوطنية القابضة. So this is the right company, not a same-named one. (2) I coul",
  },
  {
    en: "Nine Yards",
    ar: "ناين ياردز",
    kind: "developer",
    confidence: "established",
    source: "First-party: nineyards.ae/ar/press-release/… indexed with Arabic title «ناين ياردز بلس القابضة وجاكوب آند كو تعلنان…» ; third-party: https://www.eyeofriyadh.com/ar/news/details/newly-established-abu-dhabi-based-real-esta",
    note: "CONFIRMED as the transliteration, but the first-party citation is weaker than the proposal implies. I tried to fetch the nineyards.ae Arabic press release directly and got a TLS failure: the certificate served for nineyards.ae covers martynwhite.ae only. So the site is currently misconfigured, parked, or the domain has moved — the /ar/ pages exist in the search index but I could not load one to re",
  },
  {
    en: "Nshama",
    ar: "نشاما",
    kind: "developer",
    confidence: "official",
    source: "https://nshama.ae/ar/ — the developer's own Arabic site, which uses نشاما in the header, navigation and footer",
    note: "Note the spelling: the company writes نشاما, not نشامى (the ordinary Arabic word for gallant/noble men, which several third-party sites and a few blogs use). Follow the company. Dubai developer (Town Square Dubai), not Abu Dhabi.",
  },
  {
    en: "Ohana Development",
    ar: "أوهانا للتطوير العقاري",
    kind: "developer",
    confidence: "established",
    source: "https://www.zawya.com/ar/البيانات-الصحفية/بيانات-الشركات/manchester-city-yas-residences-by-ohana-41-f4d9qby0 and https://www.zawya.com/ar/البيانات-الصحفية/بيانات-الشركات/2025-g1fnzmhv — both under Zawya's company-issued ",
    note: "CONFIRMED. The strongest evidence is Zawya's بيانات الشركات section, which carries the company's own Arabic releases verbatim: «أوهانا للتطوير العقاري تطلق مشروع Manchester City Yas Residences by Ohana بقيمة 4.1 مليار دولار في أبوظبي» and «أوهانا للتطوير العقاري تُتوّج بثلاث جوائز في حفل جوائز العقارات العربية 2025». Company-issued, so this beats a portal rendering. Variant «أوهانا للتطوير» (short",
  },
  {
    en: "Q Properties",
    ar: "كيو للعقارات",
    kind: "developer",
    confidence: "established",
    source: "https://wam.ae/ar/details/1395303030910 — WAM (UAE state news agency): «\"كيو للعقارات\" تطلق مشروع \"ريم هلز\" السكني في أبوظبي بتكلفة 8 مليارات درهم» ; corroborated by Al Watan carrying Q Holding's own executive-appointmen",
    note: "CONFIRMED. WAM's headline uses «كيو للعقارات» exactly as proposed, and Al Watan reproduces Q Holding's own release using the same form for the subsidiary, so this is parent-company usage rather than a journalist's coinage. Two variants a reviewer will encounter and should NOT switch to: «كيو العقارية» is very widespread on Arabic property portals (abudhabioffplan, tanamiproperties, ghre.ae) but is",
  },
  {
    en: "RAK Properties",
    ar: "رأس الخيمة العقارية",
    kind: "developer",
    confidence: "official",
    source: "https://www.rakproperties.ae/?lang=ar (company's own Arabic site, titled \"رأس الخيمة العقارية - RAK Properties\"); ADX listing as رأس الخيمة العقارية ش م ع via https://www.mubasher.info/markets/ADX/stocks/RAKPROP",
    note: "Arabic toponym in origin — \"RAK\" is رأس الخيمة, so this restores the original rather than translating. Full legal form on the exchange is \"شركة رأس الخيمة العقارية ش.م.ع\"; for site display use رأس الخيمة العقارية without the ش.م.ع. Note the definite article is on الخيمة only — do not write \"الرأس\". PJSC founded 2005, backed by the RAK government (Mina Al Arab, Gateway Residences, Julphar Towers).",
  },
  {
    en: "Radiant Real Estate",
    ar: null,
    kind: "developer",
    confidence: "keep-latin",
    source: "No Arabic-language presence found. Own site https://radiantrealestate.ae/ is English-only with no language switcher; no Arabic press release or Arabic social handle located.",
    note: "Abu Dhabi developer founded 2022 (Radiant Square, Radiant Marina Towers, Radiant Elite, Radiant Garden on Al Reem Island). The company itself publishes nothing in Arabic. Third-party portals transliterate it three different ways with no consensus: راديانت العقارية (abudhabioffplan.ae, toprealtyuae), ريدينت العقارية (Bayut new-projects), رادينت العقارية (tanamiproperties). Because the sources disag",
  },
  {
    en: "Reportage Properties",
    ar: "ريبورتاج العقارية",
    kind: "developer",
    confidence: "official",
    source: "Company's own Arabic site https://reportageuae.com/ar/about-us and /ar/projects (page titles read \"...| ريبورتاج العقارية\"); Arabic press release carried on Zawya: https://www.zawya.com/ar/الأعمال/عقارات/2-ohot17vt (\"ريب",
    note: "Abu Dhabi-based (Tamouh Tower, Marina Square). Two live variants to be aware of: the group has been rebranding toward \"Reportage Group\" and reportageuae.com now 301s to reportagegroup.com, where Arabic press uses مجموعة ريبورتاج; and the registered developer entity appears in Abu Dhabi filings as \"ريبورتاج للتطوير والاستثمار\". For a developer-name field on a property site, ريبورتاج العقارية is the",
  },
  {
    en: "SAAS Properties",
    ar: "ساس العقارية",
    kind: "developer",
    confidence: "official",
    source: "Company's own Instagram account name, which is bilingual: \"SAAS Properties | ساس العقارية\" — https://www.instagram.com/saasproperties/ ; same form used across Arabic trade coverage (erembusiness.com, abudhabioffplan.ae/a",
    note: "Family-run Abu Dhabi developer (SAAS Tower, SAAS Hills, SAAS Heights on Al Reem, St. Regis Residences with Marriott). The company's own Arabic form is ساس العقارية; some portals expand it to \"شركة ساس العقارية\" (with شركة) — that is the same name with the generic word \"company\" prefixed, not a different name, so drop شركة for a name field. \"ساس\" is a phonetic rendering of the Latin acronym, not an",
  },
  {
    en: "Samana Developers",
    ar: "سامانا للتطوير العقاري",
    kind: "developer",
    confidence: "official",
    source: "Company's own Arabic pages: https://www.samanadevelopers.com/about?lang=ar and /properties?lang=ar — \"سامانا للتطوير العقاري هي علامة تجارية فاخرة في مجال العقارات...\", and every project name on that site is prefixed سام",
    note: "Spelling conflict worth flagging: the company writes itself سامانا (with alif after the meem), but the Arabic real-estate press and portals overwhelmingly write سمانا — Property Finder, dxboffplan, Imtilak, Al Masdar Al Aqari (\"«سمانا» تُدشن مشروعها السكني «سكايروس»\"). Rule 6 says follow the entity, so سامانا; if you also index for search, سمانا is worth carrying as an alias. Dubai-based (Business",
  },
  {
    en: "Sobha Realty",
    ar: "شوبا العقارية",
    kind: "developer",
    confidence: "official",
    source: "Company's own Arabic site https://www.sobharealty.com/ar/ (homepage, about, contact and sustainability pages all branded شوبا العقارية)",
    note: "Consistent across the company's Arabic site and Arabic trade press (Al Masdar Al Aqari coverage of Sobha City Abu Dhabi uses شوبا). Do not use صبها / صوبها — those appear only in low-quality auto-translated listings. A Facebook page using \"شركة شوبا للعقارات\" exists but is not the official corporate brand form.",
  },
  {
    en: "Taraf",
    ar: "ترف",
    kind: "developer",
    confidence: "official",
    source: "Company's own Arabic site https://www.tarafholding.com/ar/news (uses ترف throughout, ترف القابضة for the corporate entity) and parent Yas Holding's Arabic site https://www.yasholding.ae/ar/ — \"أسسنا ترف للتطوير العقاري ل",
    note: "Arabic-origin name — ترف means \"luxury/opulence\", so this restores the original rather than transliterating. Two longer forms are both official depending on context: ترف القابضة (Taraf Holding, the corporate entity) and ترف للتطوير العقاري (Yas Holding's description of the arm). Since the given English is bare \"Taraf\", use bare ترف. Al Ittihad's launch coverage vowelled it «تَرَف» to force the rea",
  },
  {
    en: "Tiger Properties",
    ar: "تايجر العقارية",
    kind: "developer",
    confidence: "established",
    source: "https://www.emaratalyoum.com/business/local/2019-07-06-1.1230381 (Emarat Al Youm, carrying the company's own press release: \"تايجر العقارية تبدأ تسليم وحدات مشروع برج سمايا\"); https://alwatan.ae/posts/1457192 (verified b",
    note: "CONFIRMED. Al Watan fetch verified the exact string; Emarat Al Youm carries the same form in company-issued PR, which is the closest thing to the entity's own Arabic usage. Not 'official': tigergroup.ae has no Arabic site at all (/ar and /ar/ both return 404), so no first-party Arabic page exists to cite. Variants in circulation: 'مجموعة تايجر' / 'مجموعة تايجر العقارية' when the group rather than ",
  },
  {
    en: "Al Naseem",
    ar: "النسيم",
    kind: "development",
    confidence: "official",
    source: "Abu Dhabi Real Estate Centre (ADREC) project registry — GET https://adrec.gov.ae/api/feature/Profession/ProjectListing?name=Naseem returns Name \"Al Naseem\", NameAr \"النسيم\", developer \"HUDAYRIYAT DEVELOPMENT - L.L.C - O.",
    note: "CONFIRMED, and stronger than the proposal claimed — this is not just portal usage, it is the name the Abu Dhabi regulator has on the project register, from the Modon subsidiary that developed it. Definite article ال is present in the authority's own record, so keep it. Modon's own Arabic site (modon.com/ar/real-estate) still shows this card's description in English, so ADREC is the better citation",
  },
  {
    en: "Bashayer Residences",
    ar: "بشاير ريسيدنسز",
    kind: "development",
    confidence: "official",
    source: "ADREC project registry — https://adrec.gov.ae/api/feature/Profession/ProjectListing?name=Bashayer and https://adrec.gov.ae/api/feature/Profession/ProjectDetail?id=639 return NameAr \"بشاير ريسيدنسز 1& 2\" and \"بشاير ريسيدن",
    note: "PROPOSAL IS WRONG on the suffix. The proposed بشاير ريزيدنسز (with ز) is not the form the authority or the developer registered. ADREC's registry, whose developer of record is Modon's own SPV حديريات للتطوير, spells it ريسيدنسز (with س) on both registered phases 1&2 and 3&4. Real inconsistency exists even inside ADREC: phase 5&6 is registered as 'بشاير ريزيدنس 5& 6' and the phase-1&2 DescriptionAr",
  },
  {
    en: "Bayviews Saadiyat",
    ar: null,
    kind: "development",
    confidence: "keep-latin",
    source: "No Arabic name found — no verifiable project of this name exists. Searches in EN and AR returned only RAK Properties' unrelated 'Bayviews' at Mina Al Arab, Ras Al Khaimah (https://www.rakproperties.ae/our-properties/bayv",
    note: "FLAG FOR REVIEW BEFORE PUBLISHING ANYTHING: this record is demo/seed data, not a real development. It is seeded in supabase/migrations/0034_catalogue_seed_expansion.sql with the tagline 'Bazar exclusive · public release pending' and no real-world counterpart. There is no Arabic name to source because there is no project. If the client confirms it is a genuine off-market instruction, the portal-con",
  },
  {
    en: "Bulgari Residences",
    ar: null,
    kind: "development",
    confidence: "keep-latin",
    source: "No Bulgari-owned Arabic naming found (bulgari.com Arabic locale not reachable/served); Arabic press is split between بولغري and بولغاري — e.g. CNN Arabic uses \"بولغاري\" (https://arabic.cnn.com/style/article/2024/02/12/du",
    note: "International luxury brand with no self-published Arabic form — standard UAE practice is to keep it Latin inside Arabic copy. Two competing transliterations exist (بولغري / بولغاري) and the brand itself arbitrates neither, so picking one would be our invention. Separately: like Bayviews, the 'Bulgari Residences' on Saadiyat in this DB is seed data (migration 0034, 'Pre-launch · Bazar access only')",
  },
  {
    en: "Hudayriyat Golf Estate",
    ar: "الحديريات جولف إستيت",
    kind: "development",
    confidence: "official",
    source: "Modon's own Arabic press release, headline and CEO quote: \"مشروع الحديريات جولف إستيت الذي تطوّره مجموعة مدن القابضة\" (https://www.zawya.com/ar/البيانات-الصحفية/بيانات-الشركات/13-uiyle3my); English original: https://www.",
    note: "Modon uses BOTH forms in the same release: الحديريات جولف إستيت (singular, in the headline and in Ibrahim Al Maqbali's quote) and الحديريات جولف إستيتس (plural, in the body — see the second release, https://www.zawya.com/ar/.../13-oi1vqtnr, which titles it \"الحديريات جولف استيتس\", also spelled with bare ا rather than إ). I matched the singular because the English field given is singular 'Estate'; ",
  },
  {
    en: "Mandarin Oriental Residences",
    ar: "ماندارين أورينتال ريزيدنسز",
    kind: "development",
    confidence: "official",
    source: "Aldar's own Arabic project page — https://www.aldar.com/properties/ar/mandarinoriental (28 occurrences of \"ماندارين أورينتال ريزيدنسز\", e.g. \"العقارات المعروضة للبيع تحت اسم ماندارين أورينتال ريزيدنسز، المنطقة الثقافية ف",
    note: "CONFIRMED, and upgraded from 'established' to 'official' — I verified this against the developer's own Arabic sales page, not third-party coverage. This is a case where rule 3 does NOT apply: Mandarin Oriental is a Latin hotel brand, but Aldar renders it in Arabic script in its own first-party Arabic copy, so keeping it Latin would contradict the entity. One variant worth recording: Aldar's 2023 p",
  },
  {
    en: "Naseem AlJurf",
    ar: "نسيم الجرف",
    kind: "development",
    confidence: "official",
    source: "Arabic toponym - restoring original; IMKAN's own Arabic project page (http://imkan.ae/projects/aljurf/naseem-aljurf) and IMKAN's Arabic press release \"«إمكان» تطلق مشروع نسيم الجرف في أبوظبي\" (https://www.zawya.com/ar/ال",
    note: "Wholly Arabic name — نسيم (breeze) + الجرف (the Ghantoot-area coastal locality). Developer is IMKAN / إمكان العقارية; the parent masterplan is الجرف (https://www.imkan.ae/projects/aljurf). Note the article pattern: no ال on نسيم, ال retained on الجرف — that is what IMKAN writes. The English spelling given ('AlJurf', closed up) is IMKAN's own styling and has no bearing on the Arabic.",
  },
  {
    en: "Radiant Terrace",
    ar: "راديانت تيراس",
    kind: "development",
    confidence: "proposed",
    source: "No official or independent attestation found. Not in the ADREC registry (name=Radiant and name=راديانت both return 0 results). Developer has no Arabic site. Sibling-project transliteration راديانت verified live on Proper",
    note: "PROPOSAL'S CONFIDENCE IS HONEST, but I could not corroborate its specific evidence and one check came back negative. Searching Property Finder Arabic for 'راديانت تيراس' returns the string only as the echoed query inside the page's own JSON state (searchQuery.q) — there is no listing, building page, or editorial text using it. So this exact compound is unattested anywhere I could reach. What IS at",
  },
  {
    en: "Reem Hills Phase 4",
    ar: "ريم هيلز - المرحلة الرابعة",
    kind: "development",
    confidence: "proposed",
    source: "Base name in wide Arabic property use (https://ghre.ae/ar/Project/reem-hills, https://psinv.net/ar/projects/abu-dhabi/al-reem-island/reem-hills/reem-hills---phase-2a/types which uses \"ريم هيلز - المرحلة الثانية أ\"). CONF",
    note: "DO NOT SHIP AS-IS WITHOUT A DECISION. Three problems the proposal did not surface. (1) The developer contradicts it: Q Holding rebranded to Modon Holding, and Modon's own Arabic site titles this project تلال الريم — a translation, not a transliteration. Under 'prefer the entity's own usage', تلال الريم has the better claim; ريم هيلز has market usage on its side. This is a genuine editorial choice,",
  },
  {
    en: "Six Senses Residences",
    ar: null,
    kind: "development",
    confidence: "keep-latin",
    source: "No Arabic-language marketing exists for the Six Senses brand — sixsenses.com ships no /ar locale, and Red Sea Global's own Arabic portfolio page leaves the brand in Latin inside Arabic copy: https://www.redseaglobal.com/",
    note: "Correct answer is keep-latin per the brand rule. Arabic press does transliterate it, but inconsistently and with no owner-endorsed form: سيكس سينسز, سيكس سنسز (SPA, https://www.spa.gov.sa/N2629715), and سيكس سينسيز (Red Sea Global / PIF Arabic newsroom) all appear — three spellings, none authoritative. Also flag for the client: the name is ambiguous. The only UAE Six Senses Residences I can verify",
  },
  {
    en: "Sobha City Abu Dhabi",
    ar: "شوبا سيتي أبوظبي",
    kind: "development",
    confidence: "official",
    source: "Developer's own Arabic site: https://www.sobharealty.com/ar/ — company is شوبا العقارية, the community is listed as شوبا سيتي (sub-communities ريفر كوف ريزيدنسز, ذا أوركارد, ذا تيراسز). Confirmed by Al Ittihad: https://w",
    note: "The registered brand is شوبا سيتي; أبوظبي is a location disambiguator (Sobha also has a Sobha City in Dubai and in Gurugram), which is why the English carries it — Arabic press writes «شوبا سيتي» ... في أبوظبي. If your data model already renders the emirate separately, use the bare شوبا سيتي. Important variant warning: broker sites render the developer as صبحا or سوبها (e.g. royallp.com writes مدي",
  },
  {
    en: "Solaya by Aldar",
    ar: null,
    kind: "development",
    confidence: "keep-latin",
    source: "Developer's own project site is English-only, no Arabic name: https://solaya.meraas.com/ (Meraas by Dubai Holding Real Estate). Aldar sources checked and came back empty: https://www.aldar.com/ar , https://www.aldar.com/",
    note: "TWO issues for the reviewer. (1) ATTRIBUTION LOOKS WRONG: Solaya is not an Aldar project. It is a Meraas + Brookfield Properties development at La Mer, Jumeirah, DUBAI (Foster + Partners / 1508 London, 3-5 bed apartments and penthouses from ~AED 14.2M) — https://solaya.meraas.com/ and https://www.propertyfinder.ae/en/new-projects/meraas-holding/solaya-in-la-mer . For an Abu Dhabi site this is both",
  },
  {
    en: "The Artery Residences",
    ar: "ذا أرتري رزيدنسز",
    kind: "development",
    confidence: "official",
    source: "Developer's own Arabic page: https://www.imkan.ae/ar/projects/makers-district/the-artery (IMKAN Properties / إمكان العقارية)",
    note: "IMKAN's Arabic site uses ذا أرتري رزيدنسز; the district is ميكرز ديستركت on جزيرة الريم. Variants seen in Arabic trade press: ذا آرتري (with madda) and ذا آرتيري — both are the same project, but IMKAN's own spelling ذا أرتري wins. Note the definite article: the brand keeps the transliterated English 'The' as ذا rather than taking Arabic ال — this is IMKAN's own convention and matches Aldar's ذا كا",
  },
  {
    en: "The Canopies at Yas Point",
    ar: "ذا كانوبيز في ياس بوينت",
    kind: "development",
    confidence: "official",
    source: "Aldar's own Arabic press release: https://www.aldar.com/ar/news-and-media/aldar-launches-the-canopies-at-yas-point-bringing-nature-inspired-living-to-yas-island-s-northern-shore — headline: الدار تطلق \"ذا كانوبيز\" في \"يا",
    note: "Both halves are Aldar's own Arabic, from the July 2026 launch release. Aldar writes each as a quoted proper name — \"ذا كانوبيز\" في \"ياس بوينت\" — so if your template already adds typographic quotes, pass the bare names ذا كانوبيز and ياس بوينت and let the connector في join them. The master destination ياس بوينت is separately confirmed by Al Bayan, Sky News Arabia and WAM-syndicated coverage of the ",
  },
  {
    en: "Yas Park Place",
    ar: "ياس بارك بليس",
    kind: "development",
    confidence: "official",
    source: "Aldar's own Arabic press release: https://www.aldar.com/ar/news-and-media/aldar-launches-first-phase-yas-park-place — طرح المرحلة الأولى من مشروع \"ياس بارك بليس\" في جزيرة ياس. Also Al Khaleej (https://www.alkhaleej.ae/20",
    note: "Fully consistent across Aldar and every Arabic outlet — no variants found. 'Yas' is the Arabic toponym ياس restored; 'Park Place' is transliterated, not translated (do not write ساحة الحديقة). If you need the phase label for the current release, Aldar writes المرحلة الأولى من \"ياس بارك بليس\".",
  },];

/** Every English name, longest first — the term list `mask()` wants. */
export function nounTerms(nouns: readonly NounEntry[] = PROPER_NOUNS): string[] {
  return nouns.map((n) => n.en).sort((a, b) => b.length - a.length);
}

/**
 * English to Arabic, lowercased on the key because `mask` matches
 * case-insensitively and the text may not be capitalised the way the database
 * is. Entries with no Arabic are kept with a null value rather than dropped, so
 * a caller can tell "no approved Arabic" apart from "not a known name".
 */
export function nounMap(
  nouns: readonly NounEntry[] = PROPER_NOUNS,
): Map<string, string | null> {
  return new Map(nouns.map((n) => [n.en.toLowerCase(), n.ar]));
}

/**
 * Sentinel index to hand-authored Arabic, derived from what `mask` actually
 * matched.
 *
 * The indices come from `MaskResult` rather than from the caller, which is the
 * point: `unmask`'s `overrides` is keyed by sentinel number, and a caller doing
 * that arithmetic itself would be one off-by-one away from substituting an
 * Arabic place name into a price.
 *
 * Only `proper-noun` spans are considered, so a term that happened to be
 * swallowed by the `price` or `permit` pattern is left alone — those patterns
 * won the tie-break for a reason.
 */
export function overridesFor(
  result: { tokens: string[]; kinds: string[] },
  nouns: Map<string, string | null> = nounMap(),
): Record<number, string> {
  const out: Record<number, string> = {};
  result.kinds.forEach((kind, i) => {
    if (kind !== "proper-noun") return;
    const ar = nouns.get((result.tokens[i] ?? "").trim().toLowerCase());
    if (ar) out[i] = ar;
  });
  return out;
}

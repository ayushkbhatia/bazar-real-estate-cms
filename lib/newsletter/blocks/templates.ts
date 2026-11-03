/**
 * The built-in block templates a new newsletter can start from: whole emails,
 * already laid out, in English and Arabic. Code, like the rich-text starters
 * (lib/newsletter/starters.ts) — what fills them is live: the project launch
 * reads a project's own name, photos, features and facts, and every template's
 * footer reads the site footer's socials, contact details and licence line
 * (/admin/footer). Templates an editor saves are rows in
 * `newsletter_templates` (0175), listed beside these.
 */

import { newBlock, emptyDesign } from "./document";
import { BAZAR } from "./palette";
import type { Block, Design, ImageValue, RecordsValue } from "./types";

export type SiteFooter = {
  socials: { network: string; url: string }[];
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  address_ar: string;
  legal: string;
  legal_ar: string;
};

export type LaunchProject = {
  id: string;
  slug: string;
  name: string;
  name_ar: string;
  area: string;
  area_ar: string;
  developer: string;
  developer_ar: string;
  tagline: string;
  tagline_ar: string;
  bedrooms: string;
  bedrooms_ar: string;
  handover: string;
  handover_ar: string;
  hero: ImageValue | null;
  features: { title: string; title_ar: string; copy: string; copy_ar: string; image: ImageValue | null }[];
  amenities: string[];
  amenities_ar: string[];
};

export type TemplateDraft = {
  subject: string;
  preheader: string;
  subject_ar: string;
  preheader_ar: string;
  design: Design;
};

export const BUILT_IN_TEMPLATES = [
  {
    id: "launch",
    label: "Project launch",
    hint: "A launch mailer from one project: hero photo, features, unit types, amenities, at a glance, closing ask.",
    needsProject: true,
  },
  {
    id: "listings",
    label: "Featured listings",
    hint: "Logo, an introduction, live cards for your newest listings, a closing ask.",
    needsProject: false,
  },
  {
    id: "market",
    label: "Market update",
    hint: "A colour header, figures, an advisor's view, a story with a photo, a call to talk.",
    needsProject: false,
  },
  {
    id: "event",
    label: "Event invitation",
    hint: "A photo header, the details, an RSVP button, who to ask.",
    needsProject: false,
  },
  {
    id: "announcement",
    label: "Announcement",
    hint: "Logo, a heading, a few paragraphs and one button. Plain and quick.",
    needsProject: false,
  },
  {
    id: "blocks-blank",
    label: "Build your own",
    hint: "Just the logo and the footer — add blocks one by one from the library.",
    needsProject: false,
  },
] as const;

export type BuiltInTemplate = (typeof BUILT_IN_TEMPLATES)[number]["id"];

export function isBuiltInTemplate(v: unknown): v is BuiltInTemplate {
  return BUILT_IN_TEMPLATES.some((t) => t.id === v);
}

const b = newBlock;

/** The two blocks every template ends with, from the site footer. */
function footerBlocks(site: SiteFooter, background = ""): Block[] {
  const blocks: Block[] = [];
  if (site.socials.length) {
    blocks.push(b("social", { items: site.socials.slice(0, 8), tone: background ? "light" : "dark", background, padding: "s" }));
  }
  blocks.push(
    b("contact", {
      company: "Bazar Real Estate",
      company_ar: "بازار العقارية",
      address: site.address || "Abu Dhabi, United Arab Emirates",
      address_ar: site.address_ar || "أبوظبي، الإمارات العربية المتحدة",
      phone: site.phone,
      whatsapp: site.whatsapp,
      email: site.email,
      legal: site.legal,
      legal_ar: site.legal_ar,
      links: [
        { label: "About us", label_ar: "من نحن", url: "/about" },
        { label: "Our advisors", label_ar: "مستشارونا", url: "/agents" },
        { label: "bazarrealestate.ae", label_ar: "bazarrealestate.ae", url: "/" },
      ],
      background,
      textColor: background ? "#FFFFFF" : "",
      padding: "s",
    }),
  );
  return blocks;
}

function design(blocks: Block[]): Design {
  return { ...emptyDesign(), blocks };
}

function records(kind: RecordsValue["kind"], ids: string[], layout: RecordsValue["layout"]): RecordsValue | null {
  return ids.length ? { kind, ids, labels: ids.map(() => ""), layout } : null;
}

/** The launch mailer, from a project's own record. */
export function launchTemplate(p: LaunchProject, site: SiteFooter): TemplateDraft {
  const url = `/developments/${p.slug}`;
  const photos = p.features.map((f) => f.image).filter((i): i is ImageValue => Boolean(i));
  const [band1, band2, band3, band4] = [photos[0] ?? p.hero, photos[1] ?? null, photos[2] ?? null, photos[3] ?? null];
  const feats = p.features.slice(0, 3);
  const amenities = p.amenities.length ? p.amenities : p.features.slice(3).map((f) => f.title);
  const amenitiesAr = p.amenities.length ? p.amenities_ar : p.features.slice(3).map((f) => f.title_ar);
  const where = [p.area, "Abu Dhabi"].filter(Boolean).join(", ");
  const whereAr = [p.area_ar, "أبوظبي"].filter(Boolean).join("، ");

  const blocks: Block[] = [
    b("hero", {
      image: p.hero,
      logo: "white",
      eyebrow: "",
      heading: "New launch",
      heading_ar: "إطلاق جديد",
      subheading: p.name,
      subheading_ar: p.name_ar,
      text: p.tagline || where,
      text_ar: p.tagline_ar || whereAr,
      note: "Presented by Bazar Real Estate",
      note_ar: "تقدمه بازار العقارية",
      height: "l",
      overlayOpacity: 35,
    }),
    b("section", {
      heading: "An iconic address. An exceptional lifestyle.",
      heading_ar: "عنوان استثنائي. أسلوب حياة فريد.",
      text: `${p.name}${p.developer ? ` by ${p.developer}` : ""} — ${where}. Register now for floor plans, prices and first access before the public launch.`,
      text_ar: `${p.name_ar || p.name}${p.developer_ar || p.developer ? ` من ${p.developer_ar || p.developer}` : ""} — ${whereAr}. سجّل الآن للحصول على المخططات والأسعار والأولوية قبل الإطلاق العام.`,
      buttonLabel: "Register for exclusive access",
      buttonLabel_ar: "سجّل للحصول على وصول حصري",
      buttonUrl: url,
      buttonColor: BAZAR.taupeDeep,
    }),
  ];
  if (band1) blocks.push(b("image", { image: band1, alt: p.name, alt_ar: p.name_ar, fullBleed: true }));
  if (feats.length >= 2) {
    blocks.push(
      b("features", {
        heading: "A new standard of living",
        heading_ar: "معيار جديد للحياة",
        items: feats.map((f) => ({ icon: null, title: f.title, title_ar: f.title_ar, text: firstSentence(f.copy), text_ar: firstSentence(f.copy_ar) })),
        background: BAZAR.cream,
      }),
    );
  }
  if (band2) blocks.push(b("image", { image: band2, alt: p.name, alt_ar: p.name_ar, fullBleed: true }));
  if (p.bedrooms) {
    blocks.push(
      b("chips", {
        heading: "A residence for every way of living",
        heading_ar: "مسكن يناسب كل أسلوب حياة",
        intro: "Choose from a collection of residences.",
        intro_ar: "اختر من مجموعة من المساكن.",
        items: [{ label: `${p.bedrooms} bedroom homes`, label_ar: p.bedrooms_ar ? `${p.bedrooms_ar} غرف نوم` : "" }],
      }),
    );
  }
  if (band3) blocks.push(b("image", { image: band3, alt: p.name, alt_ar: p.name_ar, fullBleed: true }));
  if (amenities.length) {
    blocks.push(
      b("list", {
        heading: "A lifestyle designed around you",
        heading_ar: "أسلوب حياة مصمم حولك",
        intro: "Residents-only amenities for every part of your day.",
        intro_ar: "مرافق حصرية للسكان لكل جزء من يومك.",
        items: amenities.slice(0, 10).map((t, i) => ({ text: t, text_ar: amenitiesAr[i] ?? "" })),
      }),
    );
  }
  if (band4) blocks.push(b("image", { image: band4, alt: p.name, alt_ar: p.name_ar, fullBleed: true }));
  const glance = [
    ["Developer", "المطوّر", p.developer, p.developer_ar],
    ["Location", "الموقع", where, whereAr],
    ["Unit types", "أنواع الوحدات", p.bedrooms ? `${p.bedrooms} bedrooms` : "", p.bedrooms_ar ? `${p.bedrooms_ar} غرف نوم` : ""],
    ["Handover", "التسليم", p.handover, p.handover_ar],
  ].filter(([, , v]) => v);
  blocks.push(
    b("key_values", {
      heading: "At a glance",
      heading_ar: "نظرة سريعة",
      items: glance.map(([label, label_ar, value, value_ar]) => ({ label, label_ar, value, value_ar })),
      background: BAZAR.cream,
    }),
  );
  if (p.hero && p.hero !== band1) blocks.push(b("image", { image: p.hero, alt: p.name, alt_ar: p.name_ar, fullBleed: true }));
  blocks.push(
    b("cta_band", {
      heading: `Your opportunity to own at ${p.name}`,
      heading_ar: `فرصتك للتملك في ${p.name_ar || p.name}`,
      text: "Availability is limited. Be among the first to receive floor plans, prices and launch availability from Bazar's advisors.",
      text_ar: "الوحدات محدودة. كن من أوائل من يحصلون على المخططات والأسعار وتوفر الوحدات من مستشاري بازار.",
      primaryLabel: "Register for priority access",
      primaryLabel_ar: "سجّل للحصول على الأولوية",
      primaryUrl: url,
      secondaryLabel: "Book a private consultation",
      secondaryLabel_ar: "احجز استشارة خاصة",
      secondaryUrl: "/contact",
      background: BAZAR.taupeDeep,
      primaryColor: BAZAR.cream,
      primaryTextColor: BAZAR.ink,
      secondaryColor: BAZAR.ink,
    }),
    ...footerBlocks(site, BAZAR.taupeDeep),
  );
  return {
    subject: `New launch: ${p.name}, ${p.area || "Abu Dhabi"}`,
    preheader: "Floor plans, prices and first access — register before the public launch.",
    subject_ar: `إطلاق جديد: ${p.name_ar || p.name}، ${p.area_ar || "أبوظبي"}`,
    preheader_ar: "المخططات والأسعار والأولوية — سجّل قبل الإطلاق العام.",
    design: design(blocks),
  };
}

function firstSentence(s: string): string {
  const t = s.trim();
  const m = /^(.{10,110}?[.!؟?])\s/.exec(`${t} `);
  return (m ? m[1] : t.slice(0, 110)).trim();
}

export type TemplatePicks = { property: string[]; development: string[]; article: string[] };

/** Every built-in but the launch, which needs a project (`launchTemplate`). */
export function staticTemplate(id: Exclude<BuiltInTemplate, "launch">, site: SiteFooter, picks: TemplatePicks): TemplateDraft {
  switch (id) {
    case "listings":
      return {
        subject: "Just listed with Bazar",
        preheader: "The newest homes our advisors are showing this month.",
        subject_ar: "أحدث العقارات لدى بازار",
        preheader_ar: "أحدث المنازل التي يعرضها مستشارونا هذا الشهر.",
        design: design([
          b("logo", { padding: "m" }),
          b("section", {
            eyebrow: "Just listed",
            eyebrow_ar: "أُدرج حديثاً",
            heading: "Homes worth a closer look",
            heading_ar: "منازل تستحق نظرة أقرب",
            text: "[Write a line or two introducing these listings.]",
            text_ar: "",
            buttonLabel: "",
            background: BAZAR.cream,
          }),
          b("records", { records: records("property", picks.property, "grid"), padding: "m" }),
          b("cta_band", {
            heading: "Looking for something specific?",
            heading_ar: "تبحث عن شيء محدد؟",
            text: "Tell us what you need and an advisor will send you a shortlist.",
            text_ar: "أخبرنا بما تحتاجه وسيرسل لك أحد مستشارينا قائمة مختارة.",
            primaryLabel: "Talk to an advisor",
            primaryLabel_ar: "تحدث إلى مستشار",
            primaryUrl: "/contact",
            secondaryLabel: "",
          }),
          ...footerBlocks(site),
        ]),
      };
    case "market":
      return {
        subject: "Abu Dhabi property: the month in numbers",
        preheader: "Prices, yields and what our advisors are seeing on the ground.",
        subject_ar: "عقارات أبوظبي: الشهر بالأرقام",
        preheader_ar: "الأسعار والعوائد وما يلاحظه مستشارونا في السوق.",
        design: design([
          b("hero", {
            image: null,
            overlayOpacity: 0,
            height: "s",
            eyebrow: "Market update",
            eyebrow_ar: "تحديث السوق",
            heading: "The month in numbers",
            heading_ar: "الشهر بالأرقام",
            subheading: "",
            text: "",
          }),
          b("text", { text: "[Write a line or two introducing this update.]", align: "center", size: "l", padding: "m" }),
          b("stats", {
            items: [
              { value: "", label: "Average price per sq ft", label_ar: "متوسط سعر القدم المربع" },
              { value: "", label: "Gross rental yield", label_ar: "العائد الإيجاري الإجمالي" },
              { value: "", label: "Transactions this month", label_ar: "صفقات هذا الشهر" },
            ],
            background: BAZAR.cream,
          }),
          b("quote", {
            quote: "[Write what your advisors are seeing on the ground.]",
            author: "Bazar advisory team",
            author_ar: "فريق بازار الاستشاري",
          }),
          b("image_text", { heading: "Where to look next", heading_ar: "أين تبحث بعد ذلك", text: "", buttonLabel: "Read more", buttonLabel_ar: "اقرأ المزيد", buttonUrl: "/insights" }),
          b("records", { heading: "From Insights", heading_ar: "من رؤى", records: records("article", picks.article, "list") }),
          b("cta_band", {
            heading: "What does this mean for you?",
            heading_ar: "ماذا يعني هذا بالنسبة لك؟",
            text: "Book a call and an advisor will walk you through it.",
            text_ar: "احجز مكالمة وسيشرح لك أحد مستشارينا التفاصيل.",
            primaryLabel: "Book a call",
            primaryLabel_ar: "احجز مكالمة",
            primaryUrl: "/contact",
            secondaryLabel: "",
          }),
          ...footerBlocks(site),
        ]),
      };
    case "event":
      return {
        subject: "You're invited",
        preheader: "Join Bazar's advisors for an evening preview.",
        subject_ar: "أنت مدعو",
        preheader_ar: "انضم إلى مستشاري بازار في أمسية تعريفية.",
        design: design([
          b("hero", {
            image: null,
            heading: "You're invited",
            heading_ar: "أنت مدعو",
            subheading: "[Write the event's name]",
            text: "",
            height: "m",
            overlayOpacity: 40,
          }),
          b("text", { text: "[Write two or three lines about the evening and who should come.]", align: "center", padding: "l" }),
          b("key_values", {
            heading: "The details",
            heading_ar: "التفاصيل",
            items: [
              { label: "Date", label_ar: "التاريخ", value: "" },
              { label: "Time", label_ar: "الوقت", value: "" },
              { label: "Venue", label_ar: "المكان", value: "" },
            ],
          }),
          b("button", { label: "Reserve your place", label_ar: "احجز مكانك", url: "/contact", padding: "m" }),
          b("person", { padding: "l", background: BAZAR.cream, text: "" }),
          ...footerBlocks(site),
        ]),
      };
    case "announcement":
      return {
        subject: "",
        preheader: "",
        subject_ar: "",
        preheader_ar: "",
        design: design([
          b("logo", { padding: "l" }),
          b("heading", { heading: "[Write your headline]", size: "l", padding: "s" }),
          b("text", { text: "[Write the announcement.]", padding: "m" }),
          b("button", { label: "Find out more", label_ar: "اعرف المزيد", url: "/", padding: "m" }),
          b("divider", { padding: "m" }),
          ...footerBlocks(site),
        ]),
      };
    case "blocks-blank":
      return { subject: "", preheader: "", subject_ar: "", preheader_ar: "", design: design([b("logo", { padding: "m" }), ...footerBlocks(site)]) };
  }
}

/**
 * The "Project showcase" template: a launch mailer in the modern layout the
 * client pointed to (Nov 2026) — a photo hero signed by Bazar and the
 * developer, an introduction on a pale band, the residences as glass tiles
 * over the starting price and payment terms on a colour fade, a photograph,
 * the amenities as line icons grouped outdoor / indoor / services on a second
 * fade, a strip of four photos, and a closing ask on the darkest band.
 *
 * Everything is read from the project's own record: its unit types become
 * the tiles, its starting price the figure, its payment plan the terms, its
 * amenity or feature titles the icons (matched by name — amenity-icons.ts),
 * its feature photos the bands and the strip, and its developer's logo the
 * hero's second corner. What a project doesn't have is left out rather than
 * left as a placeholder, and every word has its Arabic.
 *
 * The colours are Bazar's own — navy fading to teal, deep taupe to navy, a
 * midnight foot — set per block, so an editor can repaint any band.
 */

import { developmentRegisterUrl } from "@/lib/queries/development-utils";
import { chainStops } from "@/lib/newsletter/fill";
import { AMENITY_GROUP_LABELS, amenityGroup, matchAmenity, type AmenityGroup } from "./amenity-icons";
import { emptyDesign, newBlock as b } from "./document";
import { BAZAR } from "./palette";
import { footerBlocks, type LaunchProject, type SiteFooter, type TemplateDraft } from "./templates";
import type { Block, ImageValue, Props } from "./types";

const WHITE = "#FFFFFF";
/** Small print on the dark foot: light enough to read on midnight. */
const FOOT_MUTED = "#A9B8C4";

/** "AED 3.3 Million" / "3.3 مليون درهم": the price block's currency, figure and unit in each language. */
export function priceParts(aed: number): Props {
  const currency = { currency: "AED", currency_ar: "درهم" };
  if (aed >= 1_000_000) {
    const m = String(Math.round((aed / 1_000_000) * 100) / 100);
    return { ...currency, value: m, value_ar: m, unit: "Million", unit_ar: "مليون" };
  }
  const v = Math.round(aed).toLocaleString("en-US");
  return { ...currency, value: v, value_ar: v, unit: "", unit_ar: "" };
}

const BED = /^\s*(\d+)\s*(?:-|\s)?\s*(?:bed(?:room)?s?|br|bhk)\b\s*/i;

/**
 * A unit type as a tile: the bedroom count over the rest of its name —
 * "1 Bedroom Apartment" → 1 / Bedroom, "4 Bedroom Duplex" → 4 / Bedroom
 * Duplex, "Studio" → Studio. "Apartment" is dropped: every tile is one.
 */
export function unitTile(u: LaunchProject["unitTypes"][number]): Props {
  const clean = (s: string) => s.replace(/\bapartments?\b/gi, "").replace(/\s{2,}/g, " ").trim();
  const cleanAr = (s: string) => s.replace(/شقق|شقة/g, "").replace(/\d+/g, "").replace(/\s{2,}/g, " ").trim();
  const m = BED.exec(u.label);
  if (m) {
    const rest = clean(u.label.slice(m[0].length));
    return {
      value: m[1],
      value_ar: m[1],
      label: rest ? `Bedroom ${rest}` : "Bedroom",
      label_ar: u.label_ar ? cleanAr(u.label_ar) : "",
    };
  }
  return { value: "", value_ar: "", label: clean(u.label), label_ar: u.label_ar ? cleanAr(u.label_ar) : "" };
}

/** Tiles from the project's unit types, or — with none — from its bedroom range ("1 - 4"). */
function residenceTiles(p: LaunchProject): Props[] {
  if (p.unitTypes.length) return p.unitTypes.slice(0, 12).map(unitTile);
  const range = /(\d+)\s*(?:-|–|to)\s*(\d+)/.exec(p.bedrooms);
  if (!range) return [];
  const [lo, hi] = [Number(range[1]), Number(range[2])];
  if (!(hi >= lo) || hi - lo > 5) return [];
  return Array.from({ length: hi - lo + 1 }, (_, i) => ({ value: String(lo + i), value_ar: String(lo + i), label: "Bedroom", label_ar: lo + i === 1 ? "غرفة نوم" : "غرف نوم" }));
}

/** The plan's split as "55/45": from its name, or summed — handover against everything before it. */
export function planSplit(plan: LaunchProject["paymentPlan"]): string {
  if (!plan) return "";
  const named = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(plan.name);
  if (named) return `${named[1]}/${named[2]}`;
  const ms = plan.milestones.filter((m) => Number.isFinite(m.percent) && m.percent > 0);
  const handover = ms.filter((m) => /handover|completion/i.test(m.label)).reduce((n, m) => n + m.percent, 0);
  const before = ms.reduce((n, m) => n + m.percent, 0) - handover;
  return handover > 0 && before > 0 ? `${Math.round(before)}/${Math.round(handover)}` : "";
}

/** The down payment's share, from the plan's first milestone when it is one. */
export function downPayment(plan: LaunchProject["paymentPlan"]): string {
  const first = plan?.milestones[0];
  return first && /down|booking|deposit|reservation/i.test(first.label) && first.percent > 0 ? `${first.percent}%` : "";
}

/** The project's amenities (or, with none listed, its feature titles), each matched to an icon and grouped. */
export function amenityGroups(p: LaunchProject): { group: AmenityGroup; items: Props[] }[] {
  const titles = p.amenities.length
    ? p.amenities.map((t, i) => [t, p.amenities_ar[i] ?? ""] as const)
    : p.features.map((f) => [f.title, f.title_ar] as const);
  const groups = new Map<AmenityGroup, Props[]>();
  for (const [title, titleAr] of titles) {
    if (!title.trim()) continue;
    const icon = matchAmenity(title);
    const group = amenityGroup(title, icon);
    const list = groups.get(group) ?? [];
    if (list.length < 12) list.push({ icon: icon.id, image: null, label: title.trim(), label_ar: titleAr.trim() });
    groups.set(group, list);
  }
  return (["outdoor", "indoor", "services"] as const).filter((g) => groups.get(g)?.length).map((g) => ({ group: g, items: groups.get(g)! }));
}

/** Icons in a row: all of them up to six; past six, rows as even as they go (7 → 4 + 3). */
function iconColumns(n: number): string {
  const cols = n <= 6 ? Math.max(3, n) : Math.ceil(n / Math.ceil(n / 6));
  return String(Math.min(6, Math.max(3, cols)));
}

/** The first two sentences, for the introduction: a description is often a page long. */
function lede(s: string, max = 280): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const sentences = t.match(/[^.!?؟]+[.!?؟]+/g) ?? [t];
  let out = "";
  for (const sentence of sentences.slice(0, 2)) {
    if (out && (out + sentence).length > max) break;
    out += sentence;
  }
  return (out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out || t.slice(0, max)).trim();
}

/** Tiles in a row: up to four on one row; five or six as three and the rest; more in fours. */
function tileColumns(n: number): string {
  return String(n <= 4 ? Math.max(2, n) : n <= 6 ? 3 : 4);
}

/** A fade from one colour to the next down a run of blocks, painted onto them in place. */
function fade(blocks: Block[], from: string, to: string): Block[] {
  const stops = chainStops(from, to, blocks.length);
  blocks.forEach((block, i) => {
    block.props.background = stops[i]![0];
    block.props.backgroundTo = stops[i]![1];
  });
  return blocks;
}

export function showcaseTemplate(p: LaunchProject, site: SiteFooter): TemplateDraft {
  const url = developmentRegisterUrl(p);
  const nameAr = p.name_ar || p.name;
  const area = p.area || "Abu Dhabi";
  const areaAr = p.area_ar || "أبوظبي";
  const where = p.area ? `${p.area}, Abu Dhabi` : "Abu Dhabi";
  const whereAr = p.area_ar ? `${p.area_ar}، أبوظبي` : "أبوظبي";
  const photos = p.features.map((f) => f.image).filter((i): i is ImageValue => Boolean(i));
  const bandOne = photos[0] ?? p.hero;
  const bandTwo = photos[1] ?? null;
  const strip = photos.slice(2, 6);

  const blocks: Block[] = [
    b("hero", {
      image: p.hero,
      shape: "wide",
      textPosition: "bottom",
      overlayOpacity: 35,
      logo: "white",
      logoWidth: 84,
      logoPosition: "corners",
      partnerLogo: p.developerLogo,
      partnerLogoWidth: 72,
      heading: p.name,
      heading_ar: nameAr,
      subheading: p.developer ? `New launch by ${p.developer}` : "New launch",
      subheading_ar: p.developer_ar || p.developer ? `إطلاق جديد من ${p.developer_ar || p.developer}` : "إطلاق جديد",
      subheadingStyle: "caps",
      tag: where,
      tag_ar: whereAr,
      text: "",
      note: "",
    }),
  ];

  const intro = lede(p.description) || p.tagline;
  const introAr = lede(p.description_ar) || p.tagline_ar;
  if (intro) {
    blocks.push(b("text", { text: intro, text_ar: introAr, align: "center", size: "m", background: BAZAR.cream, padding: "m" }));
  }
  if (bandOne) blocks.push(b("image", { image: bandOne, alt: p.name, alt_ar: nameAr, fullBleed: true, shape: "wide" }));

  // The residences: tiles, the starting price and the payment terms, one band fading navy → teal.
  const residences: Block[] = [];
  const tiles = residenceTiles(p);
  if (tiles.length) {
    residences.push(
      b("tiles", {
        heading: "Residences",
        heading_ar: "المساكن",
        size: "l",
        items: tiles,
        columns: tileColumns(tiles.length),
        tileColor: WHITE,
        textColor: WHITE,
        tileFill: WHITE,
        tileOpacity: 14,
        padding: "m",
      }),
    );
  }
  if (p.startingPrice && p.startingPrice > 0) {
    residences.push(
      b("price", {
        label: "Starting price",
        label_ar: "ابتداءً من",
        ...priceParts(p.startingPrice),
        size: "l",
        textColor: WHITE,
        valueColor: WHITE,
        padding: tiles.length ? "s" : "m",
      }),
    );
  }
  const terms = [
    [downPayment(p.paymentPlan), "Down payment", "الدفعة الأولى"],
    [planSplit(p.paymentPlan), "Payment plan", "خطة الدفع"],
    [p.handover, "Handover", "التسليم", p.handover_ar],
  ].filter(([v]) => v);
  if (terms.length) {
    residences.push(
      b("stats", {
        size: "l",
        dividers: true,
        items: terms.map(([value, label, label_ar, value_ar]) => ({ value, value_ar: value_ar || value, label, label_ar })),
        textColor: WHITE,
        valueColor: WHITE,
        padding: "m",
      }),
    );
  }
  blocks.push(...fade(residences, BAZAR.navy, BAZAR.teal));
  if (bandTwo) blocks.push(b("image", { image: bandTwo, alt: p.name, alt_ar: nameAr, fullBleed: true, shape: "wide" }));

  // The amenities: a heading over one icon grid per group, one band fading deep taupe → navy.
  const groups = amenityGroups(p);
  const amenities = groups.map(({ group, items }, i) =>
    b("amenities", {
      heading: i === 0 ? "Designed for modern living" : "",
      heading_ar: i === 0 ? "مصمم لأسلوب حياة عصري" : "",
      size: "m",
      intro: i === 0 ? `${p.name} offers a collection of indoor and outdoor amenities, crafted for every lifestyle.` : "",
      intro_ar: i === 0 ? `يقدّم ${nameAr} مجموعة من المرافق الداخلية والخارجية المصممة لكل أسلوب حياة.` : "",
      group: AMENITY_GROUP_LABELS[group].label,
      group_ar: AMENITY_GROUP_LABELS[group].label_ar,
      items,
      columns: iconColumns(items.length),
      iconSize: 34,
      iconColor: WHITE,
      textColor: WHITE,
      padding: groups.length > 1 ? (i === 0 ? "m" : "s") : "m",
    }),
  );
  if (amenities.length > 1) amenities[amenities.length - 1]!.props.padding = "m";
  blocks.push(...fade(amenities, BAZAR.taupeDeep, BAZAR.navy));
  if (strip.length >= 2) {
    blocks.push(
      b("gallery", {
        items: strip.map((image) => ({ image, alt: p.name, alt_ar: nameAr, link: "", caption: "" })),
        fullBleed: true,
        shape: strip.length === 4 ? "landscape" : "square",
        padding: "none",
      }),
    );
  }

  // The closing ask and the footer: the darkest band, fading navy → midnight.
  const foot = footerBlocks(site, BAZAR.navy);
  for (const f of foot) if (f.type === "contact") f.props.textColor = FOOT_MUTED;
  blocks.push(
    ...fade(
      [
        b("text", {
          text: `Whether you are growing an investment portfolio or looking for a home, ${p.name} in ${area} is an opportunity worth a closer look.`,
          text_ar: `سواء كنت توسّع محفظتك الاستثمارية أو تبحث عن منزل، فإن ${nameAr} في ${areaAr} فرصة تستحق نظرة أقرب.`,
          align: "center",
          textColor: WHITE,
          padding: "m",
        }),
        b("button", {
          label: "Register now for expert advice",
          label_ar: "سجّل الآن للحصول على استشارة",
          url,
          buttonColor: WHITE,
          buttonTextColor: BAZAR.navy,
          buttonStyle: "outline",
          shape: "pill",
          padding: "s",
        }),
        ...foot,
      ],
      BAZAR.navy,
      BAZAR.midnight,
    ),
  );

  const design = emptyDesign();
  // The unsubscribe line under the last block sits on the email's own
  // background: midnight, so the dark foot runs to the end.
  design.settings = { ...design.settings, contentBackground: BAZAR.midnight, mutedColor: FOOT_MUTED };
  design.blocks = blocks;
  const fromPrice = p.startingPrice ? priceParts(p.startingPrice) : null;
  return {
    subject: fromPrice ? `${p.name}: residences from AED ${fromPrice.value}${fromPrice.unit ? "M" : ""}` : `${p.name}, ${area}: register your interest`,
    preheader: `${p.developer ? `By ${p.developer}, ` : ""}${where}. Unit types, prices, payment plan and amenities.`,
    subject_ar: fromPrice
      ? `${nameAr}: مساكن ابتداءً من ${fromPrice.value_ar}${fromPrice.unit_ar ? ` ${fromPrice.unit_ar}` : ""} درهم`
      : `${nameAr}، ${areaAr}: سجّل اهتمامك`,
    preheader_ar: `${p.developer_ar || p.developer ? `من ${p.developer_ar || p.developer}، ` : ""}${whereAr}. أنواع الوحدات والأسعار وخطة الدفع والمرافق.`,
    design,
  };
}

/**
 * Stored values → component props.
 *
 * One pure function per block type, in the shape
 * `app/[locale]/(public)/_components/marketing/master-content.tsx` established for the
 * master pages. Pure and data-free by design: everything that needs a query
 * arrives already fetched in `LandingData`, so these can be unit-tested without
 * a database and the renderer stays a switch with no I/O in it.
 *
 * They lean on the same `str`/`img`/`list` helpers the master pages use, so an
 * untouched field falls back exactly the way an untouched master-page field
 * does.
 */

import {
  img,
  list,
  statPairs,
  str,
  type ImageValue,
  type SectionValues,
} from "@/lib/master-pages";
import { testimonialLimitOf } from "@/lib/master-pages/library";
import { listingRowToCard } from "@/app/[locale]/(public)/_components/marketing/map-listing";
import type { FeaturedCardProps } from "@/app/[locale]/(public)/_components/marketing/map-listing";
import type { CategoryTile } from "@/app/[locale]/(public)/_components/marketing/category-tiles";
import type { PropType } from "@/app/[locale]/(public)/_components/marketing/prop-type-grid";
import type { FeatureRowItem } from "@/app/[locale]/(public)/_components/marketing/feature-rows";
import type { CtaVariant } from "@/app/[locale]/(public)/_components/marketing/cta-band";
import {
  calculatorOptions,
  type CalculatorUnit,
} from "@/lib/developments/calculator-options";
import type { RenderTile } from "@/app/[locale]/(public)/developments/[slug]/_components/renders-gallery";
import type { ProjectFactsBandProps } from "@/app/[locale]/(public)/_components/marketing/project-facts-band";
import type { LandingProject } from "@/lib/queries/landing-projects";
import type { ProjectAdvisor } from "@/lib/queries/development-content";
import { handoverQuarter } from "@/lib/developments/handover";
import { isolateAuto } from "@/lib/i18n/bidi";
import type { LandingData } from "./data";

type Item = Record<string, string | boolean | null | ImageValue>;

function itemImage(item: Item, key = "image"): ImageValue | null {
  const v = item[key];
  if (!v || typeof v !== "object") return null;
  return v as ImageValue;
}

function text(item: Item, key: string): string {
  const v = item[key];
  return typeof v === "string" ? v.trim() : "";
}

/** An item an editor added and then blanked out shouldn't render. */
function named(item: Item, key: string): boolean {
  return text(item, key) !== "";
}

// ── openers ──────────────────────────────────────────────────────────────

export function heroMediaProps(values: SectionValues) {
  const image = img(values, "image");
  const stats = statPairs(values, "stats");
  return {
    eyebrow: str(values, "eyebrow") ?? undefined,
    title: str(values, "title") ?? "",
    sub: str(values, "sub") ?? undefined,
    image: image?.label ?? undefined,
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? null,
    tall: values.tall === true,
    kicker: stats.length > 0 ? stats : undefined,
  };
}

export function heroFormProps(values: SectionValues) {
  const image = img(values, "image");
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title"),
    titleEmphasis: str(values, "title_emphasis"),
    lede: str(values, "lede"),
    sub: str(values, "sub"),
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? null,
    formKey: str(values, "form_key"),
  };
}

// ── listings ─────────────────────────────────────────────────────────────

export function featuredPropertiesProps(
  values: SectionValues,
  data: LandingData,
) {
  const source = str(values, "source") ?? "picked";
  const limit = Number.parseInt(str(values, "limit") ?? "4", 10) || 4;

  let items: FeaturedCardProps[];
  if (source === "picked") {
    // Resolved in pick order, and a listing that has since been unpublished
    // drops out rather than rendering a card that links nowhere.
    items = list<Item>(values, "picks")
      .map((pick) => data.propertiesByRef.get(text(pick, "slug")))
      .filter((row) => row !== undefined)
      .map((row) => listingRowToCard(row));
  } else {
    items = (data.propertiesByQuery.get(`${source}:${limit}`) ?? [])
      .slice(0, limit)
      .map(listingRowToCard);
  }

  return {
    eyebrow: str(values, "eyebrow") ?? undefined,
    title: str(values, "title") ?? "",
    ctaLabel: str(values, "cta_label") ?? undefined,
    ctaHref: str(values, "cta_href") ?? undefined,
    items,
  };
}

export function featuredDevelopmentsProps(
  values: SectionValues,
  data: LandingData,
) {
  const picks = list<Item>(values, "picks")
    .map((pick) => text(pick, "slug"))
    .filter(Boolean);
  return {
    eyebrow: str(values, "eyebrow") ?? undefined,
    heading: str(values, "heading") ?? undefined,
    body: str(values, "body") ?? undefined,
    ctaLabel: str(values, "cta_label") ?? undefined,
    ctaHref: str(values, "cta_href") ?? undefined,
    featuredSlugs: picks,
    developments: data.developments,
  };
}

// ── content ──────────────────────────────────────────────────────────────

export function featureRowsProps(values: SectionValues) {
  const items: FeatureRowItem[] = list<Item>(values, "items")
    .filter((item) => named(item, "title"))
    .map((item) => {
      const image = itemImage(item);
      return {
        kicker: text(item, "kicker"),
        title: text(item, "title"),
        copy: text(item, "copy"),
        imageUrl: image?.url ?? null,
        imageAlt: image?.alt ?? null,
      };
    });
  return {
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading"),
    intro: str(values, "intro"),
    items,
  };
}

export function tilesProps(values: SectionValues) {
  const items: CategoryTile[] = list<Item>(values, "items")
    .filter((item) => named(item, "name"))
    .map((item) => {
      const image = itemImage(item);
      return {
        name: text(item, "name"),
        desc: text(item, "desc"),
        cta: text(item, "cta"),
        href: text(item, "href") || "#",
        img: image?.label ?? text(item, "name").toLowerCase(),
        imgUrl: image?.url ?? null,
        imgAlt: image?.alt ?? null,
      };
    });
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title"),
    items,
  };
}

export function propTypesProps(values: SectionValues) {
  const raw = Number.parseInt(str(values, "cols") ?? "3", 10);
  const cols: 3 | 4 | 5 = raw === 4 ? 4 : raw === 5 ? 5 : 3;
  const items: PropType[] = list<Item>(values, "items")
    .filter((item) => named(item, "name"))
    .map((item) => {
      const image = itemImage(item);
      return {
        name: text(item, "name"),
        desc: text(item, "desc"),
        cta: text(item, "cta") || undefined,
        href: text(item, "href") || undefined,
        img: image?.label ?? undefined,
        imgUrl: image?.url ?? null,
        imgAlt: image?.alt ?? null,
      };
    });
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title"),
    cols,
    aspect: str(values, "aspect") ?? "4/3",
    items,
  };
}

export function stepsProps(values: SectionValues) {
  const steps = list<Item>(values, "items")
    .map((item) => [text(item, "title"), text(item, "desc")] as [string, string])
    .filter(([t]) => t !== "");
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title"),
    steps,
  };
}

export function faqProps(values: SectionValues) {
  const items = list<Item>(values, "items")
    .map((item) => [text(item, "q"), text(item, "a")] as [string, string])
    .filter(([q]) => q !== "");
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title"),
    items,
  };
}

export function richTextProps(values: SectionValues) {
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title"),
    body: str(values, "body") ?? "",
    align: str(values, "align") === "center" ? ("center" as const) : ("left" as const),
    tone: str(values, "tone") === "surface" ? ("surface" as const) : ("bg" as const),
  };
}

export function imageBandProps(values: SectionValues) {
  const image = img(values, "image");
  return {
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? null,
    imageLabel: image?.label ?? null,
    caption: str(values, "caption"),
    tall: str(values, "height") === "tall",
  };
}

// ── conversion ───────────────────────────────────────────────────────────

export function formBandProps(values: SectionValues) {
  const image = img(values, "image");
  return {
    eyebrow: str(values, "eyebrow") ?? undefined,
    title: str(values, "title") ?? "",
    sub: str(values, "sub") ?? "",
    image: image?.label ?? "bazar advisory",
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? null,
    formKey: str(values, "form_key"),
  };
}

export function ctaBandProps(values: SectionValues) {
  const raw = str(values, "variant");
  const variant: CtaVariant =
    raw === "accent" ? "accent" : raw === "soft" ? "soft" : "ink";
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title") ?? "",
    body: str(values, "body"),
    ctaLabel: str(values, "cta_label") ?? "",
    ctaHref: str(values, "cta_href") ?? "/contact",
    cta2Label: str(values, "cta2_label"),
    cta2Href: str(values, "cta2_href"),
    variant,
  };
}

export function chipsProps(values: SectionValues) {
  const chips = list<Item>(values, "items")
    .filter((item) => named(item, "label"))
    .map((item) => ({
      label: text(item, "label"),
      href: text(item, "href") || undefined,
    }));
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title"),
    sub: str(values, "sub"),
    chips,
    icon: values.icon !== false,
    cta: str(values, "cta_label") ?? undefined,
    ctaHref: str(values, "cta_href") ?? undefined,
  };
}

// ── trust ────────────────────────────────────────────────────────────────

export function aboutBazarProps(values: SectionValues) {
  const image = img(values, "image");
  const stats = statPairs(values, "stats");
  return {
    eyebrow: str(values, "eyebrow") ?? undefined,
    heading: str(values, "heading") ?? undefined,
    body: str(values, "body") ?? undefined,
    stats: stats.length > 0 ? stats : undefined,
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? null,
    imageLabel: image?.label ?? null,
  };
}

export function whyBandProps(values: SectionValues) {
  const stats = statPairs(values, "stats");
  return {
    eyebrow: str(values, "eyebrow") ?? undefined,
    title: str(values, "title") ?? "",
    body: str(values, "body") ?? "",
    stats: stats.length > 0 ? stats : undefined,
  };
}

/**
 * The one adapter that reads `data` for its *copy* rather than for records.
 *
 * `limit` is applied here as well as in `collectDataRequest` — the request asks
 * for the largest slice any block on the page wants, so a second block set to
 * two would otherwise render the first block's four.
 */
export function testimonialsProps(values: SectionValues, data: LandingData) {
  const limit = testimonialLimitOf(str(values, "limit"));
  return {
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading"),
    items: data.testimonials.slice(0, limit),
  };
}

export function partnersProps(values: SectionValues, data: LandingData) {
  return {
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading"),
    body: str(values, "body"),
    ctaLabel: str(values, "cta_label"),
    // Empty only when the loader could not run at all; the component then
    // falls back to the catalogue that ships in code, as it does on /about.
    partners: data.partners.length > 0 ? data.partners : undefined,
  };
}

// ── project sections ─────────────────────────────────────────────────────
//
// Each returns null when there is nothing to draw — no project picked, the
// project unpublished since, or the record missing the one thing the section
// is about (a payment plan, a site plan, a map pin). The renderer drops the
// block on null, so a heading never sits over an empty band.

function projectOf(
  values: SectionValues,
  data: LandingData,
): LandingProject | null {
  const slug = str(values, "development");
  return slug ? (data.projectsBySlug.get(slug) ?? null) : null;
}

/**
 * The facts a project page lists in its overview, in its order. A key absent
 * from this list is never rendered — it is the whitelist as well as the order,
 * which is what stops a stray `facts` entry appearing unlabelled.
 */
export const PROJECT_FACT_KEYS = [
  "architecture",
  "landscape",
  "total_area_ft2",
  "lagoon_area_ft2",
  "density",
  "rera_escrow",
  "service_charge_estimate",
  "tenure",
] as const;

export function projectFactsProps(
  values: SectionValues,
  data: LandingData,
): ProjectFactsBandProps | null {
  const p = projectOf(values, data);
  if (!p) return null;
  const facts = PROJECT_FACT_KEYS.flatMap((key) => {
    const value = p.facts[key];
    return value ? [{ key, value }] : [];
  });
  return {
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading") ?? p.name,
    intro: str(values, "intro") ?? p.description ?? p.vision,
    startingPrice: p.startingPrice,
    bedrooms: p.bedroomsText,
    totalUnits: p.totalUnits,
    handover: handoverQuarter(p.handoverDate),
    // "60/40 Payment Plan" → "60/40", the same cut the project hero makes: the
    // ratio is the figure, and it reads the same in both languages.
    paymentPlan: p.paymentPlan?.name.split(" ")[0] ?? null,
    facts,
  };
}

/**
 * What the calculator can price — the starting price first, then each priced
 * unit type, then the units on sale. The same rule the project page applies.
 */
export function calculatorUnitsFor(p: LandingProject): CalculatorUnit[] {
  return calculatorOptions({
    startingPrice: p.startingPrice,
    unitTypes: p.unitTypePrices,
    units: p.units,
  });
}

export function projectPaymentPlanProps(
  values: SectionValues,
  data: LandingData,
) {
  const p = projectOf(values, data);
  if (!p?.paymentPlan) return null;
  return {
    plan: p.paymentPlan,
    // Blank keeps the component's own "Payment plan · <plan name>", which is
    // translated and names the plan — better than any fixed default.
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading") ?? p.paymentPlan.name,
    intro: str(values, "intro"),
    developmentName: p.name,
    units: calculatorUnitsFor(p),
  };
}

export function projectMasterPlanProps(
  values: SectionValues,
  data: LandingData,
) {
  const p = projectOf(values, data);
  if (!p?.masterplan) return null;
  const heading = str(values, "heading");
  return {
    eyebrow: str(values, "eyebrow"),
    heading,
    intro: str(values, "intro"),
    image: {
      url: p.masterplan.url,
      alt: p.masterplan.alt ?? [p.name, heading].filter(Boolean).join(" · "),
    },
    pins: p.masterPlanPins,
  };
}

export function projectUnitPlansProps(
  values: SectionValues,
  data: LandingData,
) {
  const p = projectOf(values, data);
  // No placeholder types here, unlike the project page: a campaign is not the
  // place to show drawings that don't exist yet.
  if (!p || p.unitTypes.length === 0) return null;
  return {
    types: p.unitTypes,
    developmentName: p.name,
    developmentId: p.id,
    gated: p.floorplanGated,
    // Read by `resolveLandingData` once a project on the page turns out to
    // gate its layouts, so it asks the same form here as on its own page.
    floorplanForm: data.forms.development_floorplan ?? null,
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading"),
    intro: str(values, "intro"),
  };
}

export function projectLocationProps(
  values: SectionValues,
  data: LandingData,
) {
  const p = projectOf(values, data);
  if (!p?.coords) return null;
  return {
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading"),
    intro: str(values, "intro"),
    lat: p.coords.lat,
    lng: p.coords.lng,
    title: p.name,
  };
}

// ── advisor ──────────────────────────────────────────────────────────────

const ARABIC_SCRIPT = /[؀-ۿ]/;

/**
 * `{advisor}` / `{advisor_first}` → the advisor's name.
 *
 * Isolated when the sentence around it is Arabic, so a Latin name does not
 * drag the punctuation after it to the wrong side — the rule the project
 * pages' own advisor band follows. Never isolated in the WhatsApp message:
 * the marks are invisible on a page and pointless percent-encoded into the
 * draft the visitor sends.
 */
function fillAdvisor(
  template: string | null,
  name: string,
  first: string,
  isolate: boolean,
): string | null {
  if (template === null) return null;
  const wrap = (s: string) =>
    isolate && ARABIC_SCRIPT.test(template) ? isolateAuto(s) : s;
  return template
    .replaceAll("{advisor_first}", wrap(first))
    .replaceAll("{advisor}", wrap(name));
}

export function advisorProps(values: SectionValues, data: LandingData) {
  const slug = str(values, "agent");
  const a = slug ? data.advisorsBySlug.get(slug) : undefined;
  // Not on the roster any more — suspended, left, or never publishable. There
  // is no substitute for a person, so the card goes.
  if (!a) return null;
  const first = a.display_name.split(" ")[0] ?? a.display_name;
  const fill = (key: string, isolate = true) =>
    fillAdvisor(str(values, key), a.display_name, first, isolate);
  const agent: ProjectAdvisor = {
    user_id: a.user_id,
    slug: a.slug,
    display_name: a.display_name,
    title: a.title,
    brn: a.brn,
    bio: a.bio,
    photo_url: a.photo_url,
    email: a.email,
    phone: a.phone,
    whatsapp: a.whatsapp,
  };
  return {
    agent,
    // Only the fallback message reads it, and the message is always set.
    developmentName: "",
    // "" rather than null for the two the component would otherwise fill with
    // English of its own ("Lead advisor", a generic greeting).
    eyebrow: fill("eyebrow") ?? "",
    heading: fill("heading"),
    intro: fill("intro"),
    quote: fill("quote"),
    callLabel: fill("call_label"),
    visitLabel: fill("visit_label"),
    visitMessage: fill("visit_message", false) ?? `${first}`,
  };
}

// ── new content ──────────────────────────────────────────────────────────

/** Photo rows that actually hold a photo; a blank row draws nothing. */
function galleryTiles(values: SectionValues, key: string): RenderTile[] {
  return list<Item>(values, key).flatMap((item) => {
    const image = itemImage(item);
    if (!image?.url) return [];
    return [
      {
        url: image.url,
        alt: image.alt ?? null,
        caption: text(item, "caption") || null,
      },
    ];
  });
}

export function galleryProps(values: SectionValues) {
  const first = galleryTiles(values, "first_images");
  // The second set sits beside the first; on its own it has nothing to sit
  // beside, and the gate's "has photos" check reads the first set only.
  const second = first.length > 0 ? galleryTiles(values, "second_images") : [];
  return {
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading"),
    intro: str(values, "intro"),
    interiorHeading: str(values, "first_heading"),
    exteriorHeading: str(values, "second_heading"),
    interior: first,
    exterior: second,
  };
}

export function valueGridProps(values: SectionValues) {
  const raw = Number.parseInt(str(values, "cols") ?? "4", 10);
  const cols: 2 | 3 | 4 = raw === 2 ? 2 : raw === 3 ? 3 : 4;
  const items = list<Item>(values, "items")
    .filter((item) => named(item, "name"))
    .map((item) => ({ name: text(item, "name"), desc: text(item, "desc") }));
  return {
    eyebrow: str(values, "eyebrow"),
    title: str(values, "title"),
    sub: str(values, "sub"),
    cols,
    items,
  };
}

export function statsBandProps(values: SectionValues) {
  return {
    heading: str(values, "heading"),
    intro: str(values, "intro"),
    stats: list<Item>(values, "stats")
      .filter((item) => named(item, "value"))
      .map((item) => ({ value: text(item, "value"), label: text(item, "label") })),
    footnote: str(values, "footnote"),
  };
}

export function mortgageCalculatorProps(values: SectionValues) {
  return {
    // `undefined`, not null: the component's own defaults are destructuring
    // defaults, which a null would bypass and render blank.
    eyebrow: str(values, "eyebrow") ?? undefined,
    heading: str(values, "heading") ?? undefined,
  };
}

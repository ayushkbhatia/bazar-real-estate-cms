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
import { listingRowToCard } from "@/app/[locale]/(public)/_components/marketing/map-listing";
import type { FeaturedCardProps } from "@/app/[locale]/(public)/_components/marketing/map-listing";
import type { CategoryTile } from "@/app/[locale]/(public)/_components/marketing/category-tiles";
import type { PropType } from "@/app/[locale]/(public)/_components/marketing/prop-type-grid";
import type { FeatureRowItem } from "@/app/[locale]/(public)/_components/marketing/feature-rows";
import type { CtaVariant } from "@/app/[locale]/(public)/_components/marketing/cta-band";
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
  const limit = Number.parseInt(str(values, "limit") ?? "3", 10) || 3;
  return {
    eyebrow: str(values, "eyebrow"),
    heading: str(values, "heading"),
    items: data.testimonials.slice(0, limit),
  };
}

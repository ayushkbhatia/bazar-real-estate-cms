import { list, type SectionValues } from "@/lib/master-pages";
import type { PropType } from "../../_components/marketing/prop-type-grid";
import type { ValueCard } from "./service-value-grid";

/**
 * Adapters from master-page section values to the props the presentational
 * components already take. Every list here is `cardList` from the registry, so
 * one reader covers both service landings.
 */

type RawCard = {
  enabled?: boolean;
  name?: string;
  desc?: string;
  cta?: string;
  href?: string;
  img?: string;
  image?: { url?: string | null; alt?: string | null; label?: string | null } | null;
};

/** Cards an editor hasn't switched off, with a title to render. */
function visible(values: SectionValues, key: string): RawCard[] {
  return list<RawCard>(values, key).filter(
    (c) => c.enabled !== false && (c.name ?? "").trim() !== "",
  );
}

/** Title + description only. */
export function valueCards(values: SectionValues, key = "items"): ValueCard[] {
  return visible(values, key).map((c) => ({
    name: c.name ?? "",
    desc: c.desc ?? "",
  }));
}

/** Title + description + optional art and link. */
export function mediaCards(values: SectionValues, key = "items"): PropType[] {
  return visible(values, key).map((c) => ({
    name: c.name ?? "",
    desc: c.desc ?? "",
    cta: c.cta || undefined,
    // A tile with no link renders as a plain card rather than a dead <a>.
    href: c.href || undefined,
    // `image.url` is resolved server-side by attachImageUrls from the stored
    // media_id; `img` is the placeholder caption used when no asset is picked.
    img: c.img || c.image?.label || undefined,
    imgUrl: c.image?.url ?? null,
    imgAlt: c.image?.alt ?? null,
  }));
}

/** The numbered flow, in the [title, description] pairs StepFlow takes. */
export function stepPairs(
  values: SectionValues,
  key = "steps",
): [string, string][] {
  return list<{ title?: string; desc?: string }>(values, key)
    .map((s) => [s.title ?? "", s.desc ?? ""] as [string, string])
    .filter(([title]) => title.trim() !== "");
}

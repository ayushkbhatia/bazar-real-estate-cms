import type { Database } from "@/db/types";
import type { InternalLinkRef } from "./model";

type Enums = Database["public"]["Enums"];

export type LinkCardImage = { url: string; alt: string };

type Common = {
  id: string;
  /** Today's public path, derived from the live record. */
  href: string;
  /** Display name, folded to the page's locale. */
  name: string;
  image: LinkCardImage | null;
};

export type ResolvedAreaLink = Common & {
  kind: "area";
  slug: string;
  /** What it sits in: "Saadiyat Island" for Mamsha, "Abu Dhabi" for Saadiyat. */
  parent: string | null;
  summary: string | null;
  /** Published listings filed under the area — the number on the /areas grid. */
  listings: number;
};

export type ResolvedDevelopmentLink = Common & {
  kind: "development";
  slug: string;
  developer: string | null;
  area: string | null;
  tagline: string | null;
  startingPriceAed: number | null;
  handoverDate: string | null;
};

export type ResolvedPropertyLink = Common & {
  kind: "property";
  reference: string;
  area: string | null;
  mode: Enums["property_mode"];
  type: Enums["property_type"];
  priceAed: number | null;
  beds: number | null;
  baths: number | null;
  builtUpFt2: number | null;
};

/**
 * A record an article links to, as the public card draws it. Every string on
 * it is already in the page's locale — nothing downstream folds twins.
 */
export type ResolvedInternalLink =
  | ResolvedAreaLink
  | ResolvedDevelopmentLink
  | ResolvedPropertyLink;

/**
 * The answer to "what does this link point at now", with the one distinction
 * that matters to a renderer:
 *
 *  - a record — draw it;
 *  - `null` — the lookup ran and the record is not public (unpublished,
 *    deleted): drop the card, keep a text link's words;
 *  - `undefined` — the lookup could not run (database unreachable, Supabase
 *    unconfigured): drop the card, but a text link keeps the href it was
 *    stored with, because that is still probably right.
 */
export type InternalLinkLookup = {
  get(ref: InternalLinkRef): ResolvedInternalLink | null | undefined;
};

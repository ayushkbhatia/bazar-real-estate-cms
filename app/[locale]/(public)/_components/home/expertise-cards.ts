/**
 * The pure half of the "Our Expertise" band: which cards draw, with what, and
 * how the desktop grid is cut. Kept apart from the component so it can be
 * tested without a request.
 */
import { areaCardSubtitle } from "@/lib/master-pages/area-card-subtitle";
import type { AreaCardRecord } from "@/lib/queries/area-cards";

export type ExpertiseCardInput = {
  enabled?: boolean;
  slug?: string | null;
  name?: string | null;
  subtitle?: string | null;
  href?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLabel?: string | null;
};

export type ExpertiseTile = {
  key: string;
  href: string;
  name: string;
  countLabel: string;
  imgLabel: string;
  imgUrl: string | null;
  imgAlt: string | null;
};

/**
 * Card list + the areas it names ⇒ the tiles to draw, in order.
 *
 * Each blank on a card falls back to its area: the name, the area page, the
 * hero photo. A card whose area no longer exists still draws when the editor
 * gave it a name and a link of its own, and is dropped when they did not —
 * a tile titled with a bare slug, linking to a 404, is worse than no tile.
 */
export function resolveExpertiseTiles(
  cards: ExpertiseCardInput[],
  records: Map<string, AreaCardRecord>,
  fallbackSubtitle: string,
): ExpertiseTile[] {
  return cards.flatMap((card, i) => {
    if (card.enabled === false) return [];
    const slug = card.slug?.trim() ?? "";
    const area = slug ? records.get(slug.toLowerCase()) : undefined;
    const name = card.name?.trim() || area?.name;
    const href = card.href?.trim() || (area ? `/areas/${area.slug}` : "");
    if (!name || !href) return [];
    return [
      {
        key: `${slug || "card"}-${i}`,
        href,
        name,
        countLabel: areaCardSubtitle(card.subtitle, area?.count) ?? fallbackSubtitle,
        imgLabel: card.imageLabel?.trim() || slug || name,
        imgUrl: card.imageUrl || area?.heroUrl || null,
        imgAlt: card.imageAlt?.trim() || null,
      },
    ];
  });
}

/** Whether any shown card asks for the live count, so the page fetches it. */
export function wantsCounts(cards: ExpertiseCardInput[]): boolean {
  return cards.some(
    (c) => c.enabled !== false && (c.subtitle ?? "").includes("{count}"),
  );
}

/**
 * The desktop grid for `total` tiles: the first is the large tile spanning
 * every row, the rest share the grid beside it in at most two rows.
 *
 * The large tile keeps the width ratio of the home page's Abu Dhabi tile
 * beside its 4-wide grid (1.15 : 2), scaled to however many columns the rest
 * need, so seven cards (one + 3×2) sit like the eight-card band above them.
 */
export function expertiseGrid(total: number): {
  columns: string;
  rows: string;
} {
  const rest = Math.max(0, total - 1);
  if (rest === 0) return { columns: "minmax(0,1fr)", rows: "minmax(0,1fr)" };
  const rows = rest <= 3 ? 1 : 2;
  const cols = Math.ceil(rest / rows);
  const lead = Math.round(((1.15 * cols) / 2) * 1000) / 1000;
  return {
    columns: `minmax(0,${lead}fr) repeat(${cols},minmax(0,1fr))`,
    rows: `repeat(${rows},minmax(0,1fr))`,
  };
}

/** A resolved master-page section's `cards` value ⇒ the band's input. */
export function expertiseCardsFrom(value: unknown): ExpertiseCardInput[] {
  if (!Array.isArray(value)) return [];
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const c = raw as Record<string, unknown>;
    const image = (c.image ?? null) as {
      url?: string | null;
      alt?: string | null;
      label?: string | null;
    } | null;
    return [
      {
        enabled: c.enabled !== false,
        slug: s(c.slug),
        name: s(c.name),
        subtitle: s(c.subtitle),
        href: s(c.href),
        imageUrl: image?.url ?? null,
        imageAlt: image?.alt ?? null,
        imageLabel: image?.label ?? null,
      },
    ];
  });
}

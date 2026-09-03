/**
 * Reads for the card-label vocabulary (`lib/card-labels.ts`).
 *
 * Its own module rather than another export off `site-settings.ts`, matching
 * `lib/queries/header-cta.ts`: the six public surfaces that draw a card import
 * only this, and the settings screen imports only the admin read.
 */
import { cache } from "react";

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { type Locale } from "@/lib/i18n/locales";
import { parseCardLabels } from "@/lib/schemas/card-labels";
import {
  labelsFor,
  resolveCardLabels,
  type CardLabel,
  type CardLabelSource,
  type ResolvedCardLabel,
} from "@/lib/card-labels";

/**
 * The vocabulary.
 *
 * Wrapped in `cache()` because those six surfaces each resolve their own
 * labels and several render in one pass — the home page draws a curated grid
 * and a featured band; `/areas/<slug>` draws a listings band under a
 * developments band. One request, one round trip.
 *
 * Its own single-column select for the trap 0096 documents and 0120, 0122
 * restate: `site_settings` has COLUMN-level grants and a select naming an
 * ungranted column fails WHOLE. Scoped like this, the blast radius of an
 * unapplied 0123 is that cards wear the two labels the site shipped with —
 * which is what they wore yesterday.
 */
export const getPublicCardLabels = cache(async (): Promise<CardLabel[]> => {
  if (!isSupabaseConfigured) return resolveCardLabels(null);
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("site_settings")
      .select("card_labels")
      .eq("id", 1)
      .maybeSingle();
    return resolveCardLabels(
      parseCardLabels((data as { card_labels?: unknown } | null)?.card_labels),
    );
  } catch {
    return resolveCardLabels(null);
  }
});

/**
 * One `await` per surface, one call per row.
 *
 * The six call sites are a mix: three read `locale` off their own `params`,
 * two are components deep in a tree with no params to read, and one already
 * calls `currentLocale()`. Handing back a bound function lets all six say the
 * same thing, and keeps the fold — which needs the locale — out of the render
 * loop where it would be re-derived per card.
 *
 * `locale` is threaded where a caller has it and read ambiently where it does
 * not. Ambient is safe here in a way it is not in a layout: these are pages and
 * the components under them, so `setRequestLocale` has already run.
 */
export const getCardLabelResolver = cache(async (locale?: Locale) => {
  const [vocabulary, active] = await Promise.all([
    getPublicCardLabels(),
    locale ? Promise.resolve(locale) : currentLocale(),
  ]);
  return (source: CardLabelSource, limit?: number): ResolvedCardLabel[] =>
    labelsFor(source, vocabulary, active, limit);
});

/** The same vocabulary for /admin, through the caller's session. */
export async function getCardLabelSettings(): Promise<CardLabel[]> {
  if (!isSupabaseConfigured) return resolveCardLabels(null);
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("site_settings")
      .select("card_labels")
      .eq("id", 1)
      .maybeSingle();
    return resolveCardLabels(
      parseCardLabels((data as { card_labels?: unknown } | null)?.card_labels),
    );
  } catch {
    return resolveCardLabels(null);
  }
}

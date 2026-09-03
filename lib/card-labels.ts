/**
 * The labels a card wears over its image — the vocabulary, and which of them a
 * given listing carries.
 *
 * WHAT THIS REPLACES
 *
 * `lib/listing-badge.ts` mapped two booleans on `properties.flags` to two
 * hard-coded catalogue strings and returned at most one. Three limits, all of
 * them the client's rather than the code's: the words could not be changed
 * without a deploy, a new label needed a developer, and a property that was
 * both exclusive AND vacant on transfer showed only the first.
 *
 * So the vocabulary moves to `site_settings.card_labels` (migration 0123),
 * edited at `/admin/settings/card-labels`, and a listing carries a LIST.
 *
 * WHERE ASSIGNMENT IS STORED, AND WHY THERE
 *
 * `properties.flags` and `developments.meta` are both free-form jsonb that
 * already exist, so `flags.labels: string[]` and `meta.labels: string[]` need
 * no migration and no generated-type change. That is worth more than a tidier
 * column: a label vocabulary is the kind of thing a client edits weekly, and
 * every schema change between here and them is a deploy.
 *
 * THE TWO BUILT-INS
 *
 * `exclusive` and `vacant_on_transfer` ship as real labels rather than as a
 * special case, because they are already set on live rows and their words are
 * already translated. `labelsFor` reads BOTH the new list and the two legacy
 * booleans, so nothing regresses on a property nobody has re-tagged — and the
 * client can rename or recolour either one from settings, which was the whole
 * request.
 *
 * A built-in cannot be deleted, only disabled: a listing still pointing at a
 * deleted id would silently lose a badge it had earned, and the flag it came
 * from would still be true in the database.
 */

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

/** The chip styles `components/brand/listing-card.tsx` already draws. */
export const CARD_LABEL_KINDS = [
  "ink",
  "accent",
  "success",
  "warn",
  "danger",
] as const;
export type CardLabelKind = (typeof CARD_LABEL_KINDS)[number];

/** Human names for the five, for the admin colour picker. */
export const CARD_LABEL_KIND_NAME: Record<CardLabelKind, string> = {
  ink: "Navy",
  accent: "Teal",
  success: "Green",
  warn: "Amber",
  danger: "Red",
};

export type CardLabel = {
  /** Stable key. Written into `flags.labels`, so it must never be reused. */
  id: string;
  text: string;
  /** Blank falls back to the English, which is the site-wide rule. */
  text_ar: string;
  kind: CardLabelKind;
  /** Off keeps the label in the vocabulary but stops any card drawing it. */
  enabled: boolean;
  /**
   * True for the two that ship with the product. They can be renamed,
   * recoloured and disabled, but not removed — see the note at the top.
   */
  builtIn?: boolean;
};

/**
 * The legacy boolean each built-in stands in for.
 *
 * This is the whole of the back-compatibility surface: one map, read in one
 * place. A label without an entry here is assigned only by `flags.labels`.
 */
export const BUILT_IN_FLAG: Record<string, string> = {
  exclusive: "exclusive",
  vacant_on_transfer: "vacant_on_transfer",
};

/**
 * The shipped vocabulary.
 *
 * The words and the colours are byte-identical to what `listingBadge` returned
 * — `listing.badge.exclusive` in ink, `listing.badge.vacantOnTransfer` in
 * accent — so a site whose client never opens the new screen renders exactly
 * what it rendered before.
 */
export const CARD_LABEL_DEFAULTS: CardLabel[] = [
  {
    id: "exclusive",
    text: "Exclusive",
    text_ar: "حصري",
    kind: "ink",
    enabled: true,
    builtIn: true,
  },
  {
    id: "vacant_on_transfer",
    text: "Vacant on transfer",
    text_ar: "شاغر عند نقل الملكية",
    kind: "accent",
    enabled: true,
    builtIn: true,
  },
];

/** The stored bag. `{}` — the default — renders the shipped vocabulary. */
export type CardLabelSettings = { labels?: CardLabel[] };

export const CARD_LABEL_SETTINGS_DEFAULTS: CardLabelSettings = {};

/**
 * The vocabulary a page renders: what the CMS holds, with any built-in the
 * client has not touched restored.
 *
 * The restore matters. An operator who saves the screen having deleted a
 * built-in row (or an older bag written before one existed) would otherwise
 * strand every property carrying that flag with no badge at all, and the cause
 * would be a row that is not there to look at.
 */
export function resolveCardLabels(
  settings?: CardLabelSettings | null,
): CardLabel[] {
  const stored = settings?.labels ?? [];
  const seen = new Set(stored.map((l) => l.id));
  const missing = CARD_LABEL_DEFAULTS.filter((d) => !seen.has(d.id));
  return [...stored, ...missing].map((l) => ({
    ...l,
    builtIn: CARD_LABEL_DEFAULTS.some((d) => d.id === l.id) || undefined,
  }));
}

/** One label, folded to a locale. Blank Arabic falls back to the English. */
export function labelText(label: CardLabel, locale: Locale): string {
  if (locale === "ar" && label.text_ar.trim()) return label.text_ar.trim();
  return label.text;
}

/** What a card actually draws. */
export type ResolvedCardLabel = {
  id: string;
  label: string;
  kind: CardLabelKind;
};

/** The shape `labelsFor` reads. Structural, so this module stays free of the
 *  query layer's row types. */
export type CardLabelSource =
  | {
      labels?: unknown;
      exclusive?: boolean | null;
      vacant_on_transfer?: boolean | null;
    }
  | null
  | undefined;

/**
 * The labels one listing wears, in vocabulary order.
 *
 * Vocabulary order rather than assignment order, deliberately: the client sets
 * the order once on the settings screen and every card on the site agrees,
 * instead of each listing's chips depending on which box an agent ticked
 * first. It also makes the old single-badge precedence — exclusive before
 * vacant-on-transfer — a thing the client controls rather than a constant.
 *
 * `limit` is the card's room, not a rule about the data. A listing may carry
 * six labels; a 116px row thumbnail can draw two.
 */
export function labelsFor(
  source: CardLabelSource,
  vocabulary: CardLabel[],
  locale: Locale = DEFAULT_LOCALE,
  limit = 2,
): ResolvedCardLabel[] {
  if (!source) return [];
  const assigned = new Set<string>(
    Array.isArray(source.labels)
      ? source.labels.filter((v): v is string => typeof v === "string")
      : [],
  );
  // The legacy booleans, read as if they were assignments. A property tagged
  // through the new UI and a property left on its old flag both arrive here.
  for (const [id, flag] of Object.entries(BUILT_IN_FLAG)) {
    if ((source as Record<string, unknown>)[flag] === true) assigned.add(id);
  }
  return vocabulary
    .filter((l) => l.enabled && assigned.has(l.id))
    .slice(0, limit)
    .map((l) => ({ id: l.id, label: labelText(l, locale), kind: l.kind }));
}

/**
 * A stable id for a label the operator has just typed.
 *
 * Slugified from the text so a glance at `flags.labels` in the database is
 * readable, with a counter rather than a random suffix on collision — two
 * labels called "New" should be `new` and `new-2`, not `new` and `new-x7f2`.
 * Falls back to a positional id when the text has no ASCII to slug, which
 * Arabic-only text does.
 */
export function cardLabelId(text: string, taken: readonly string[]): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `label_${taken.length + 1}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

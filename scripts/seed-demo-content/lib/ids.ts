/**
 * Deterministic UUID prefixes per entity kind so re-runs are idempotent
 * and so a casual reader can tell what an ID refers to.
 *
 * Existing seed.sql convention (do not change):
 *   11.. = areas        33.. = developments    55.. = articles
 *   22.. = developers   44.. = properties      66.. = pages
 *
 * Demo-content additions (this script):
 *   77.. = staff (agents)    aaaaaaaa.. = reviews
 *   88.. = media_assets      bbbbbbbb.. = property_media
 *   cccccccc.. = development_media      dddddddd.. = floor_plans
 */
const HEX_PREFIX = {
  area: "11111111",
  developer: "22222222",
  development: "33333333",
  property: "44444444",
  article: "55555555",
  page: "66666666",
  staff: "77777777",
  media_asset: "88888888",
  review: "aaaaaaaa",
  property_media: "bbbbbbbb",
  development_media: "cccccccc",
  floor_plan: "dddddddd",
} as const;

type Kind = keyof typeof HEX_PREFIX;

/** Build a deterministic UUID for a given entity kind and 1-based index. */
export function makeId(kind: Kind, idx: number): string {
  const prefix = HEX_PREFIX[kind];
  const padded = String(idx).padStart(12, "0");
  return `${prefix}-0000-0000-0000-${padded}`;
}

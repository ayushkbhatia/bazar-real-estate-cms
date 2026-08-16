/**
 * The querystring keys that mean "the visitor is running a property search".
 *
 * Deliberately a plain array rather than `Object.keys(filterParsers)`: this
 * list is imported by `proxy.ts`, which runs on every request, and deriving it
 * would pull `nuqs/server` into the middleware bundle for nothing. Parity with
 * `filterParsers` is asserted in `property.test.ts`, so the two cannot drift.
 */
export const FILTER_PARAM_KEYS = [
  "q",
  "beds",
  "baths",
  "type",
  "form",
  "price_min",
  "price_max",
  "area",
  "ft2_min",
  "ft2_max",
  "year_min",
  "year_max",
  "tenure",
  "furnishing",
  "amenities",
  "verified",
  "advisor",
  "sort",
  "page",
] as const;

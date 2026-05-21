/**
 * Pure, server-agnostic property helpers. Safe to import from Client
 * Components — no `next/headers`, no Supabase server client.
 */

/** Format AED with K/M suffix. */
export function formatPriceAED(aed: number): string {
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(1)}M`;
  if (aed >= 1_000) return `AED ${(aed / 1_000).toFixed(0)}K`;
  return `AED ${aed.toLocaleString()}`;
}

/** Build canonical URL for a property: /p/<slug>-<reference-lowercased>. */
export function propertyUrl(row: { slug: string; reference: string }): string {
  return `/p/${row.slug}-${row.reference.toLowerCase()}`;
}

/** Reverse: given a `[slug]` param, extract the trailing BAZ-XX-NNNN reference. */
export function extractReferenceFromSlug(slug: string): string | null {
  const match = slug.match(/(baz-[a-z]+-\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

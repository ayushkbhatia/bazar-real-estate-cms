/**
 * Sprint 12 — Meilisearch client + sync helpers.
 *
 * Two clients live here:
 *  - The admin client (server-only) writes the `properties` index from
 *    the cron / reindex routes. Uses MEILISEARCH_API_KEY.
 *  - The search client is intentionally NOT here — the search UI
 *    calls /api/search/properties on the server side and lets the
 *    search list component degrade to Postgres FTS when the index is
 *    cold or unconfigured.
 *
 * Index shape mirrors what /buy + /rent + /off-plan + /commercial want
 * to filter on. Updated as Sprint 12 ships the search-list rewrite.
 */

import { Meilisearch } from "meilisearch";
import { env, isMeilisearchConfigured } from "@/lib/env";

export const PROPERTIES_INDEX = "properties";

export type IndexedProperty = {
  id: string;            // primary key
  reference: string;
  slug: string;
  title: string;
  short_description: string | null;
  price_aed: number;
  mode: "buy" | "rent" | "off_plan" | "commercial";
  type: string;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  area_slug: string | null;
  area_name: string | null;
  amenities: string[];
  bazar_verified: boolean;
  published_at_unix: number | null;
  // pre-formatted hero key so the search list can render without a join
  hero_storage_key: string | null;
};

/** Server-only admin client. Returns null when env vars are absent so
 *  callers can degrade gracefully. */
export function meilisearchAdminClient(): Meilisearch | null {
  if (!isMeilisearchConfigured || !env.MEILISEARCH_HOST || !env.MEILISEARCH_API_KEY) {
    return null;
  }
  return new Meilisearch({
    host: env.MEILISEARCH_HOST,
    apiKey: env.MEILISEARCH_API_KEY,
  });
}

/** Apply the index settings the search UI depends on. Idempotent. */
export async function ensurePropertiesIndex(): Promise<void> {
  const client = meilisearchAdminClient();
  if (!client) return;
  const index = client.index(PROPERTIES_INDEX);
  await index.updateSettings({
    searchableAttributes: [
      "title",
      "short_description",
      "reference",
      "area_name",
      "amenities",
    ],
    filterableAttributes: [
      "mode",
      "type",
      "beds",
      "baths",
      "amenities",
      "area_slug",
      "bazar_verified",
      "price_aed",
      "built_up_ft2",
    ],
    sortableAttributes: ["price_aed", "published_at_unix", "built_up_ft2"],
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ],
  });
}

/** Upsert a batch of property documents. */
export async function upsertProperties(
  docs: IndexedProperty[],
): Promise<{ ok: boolean; count: number }> {
  if (docs.length === 0) return { ok: true, count: 0 };
  const client = meilisearchAdminClient();
  if (!client) return { ok: false, count: 0 };
  await client.index(PROPERTIES_INDEX).addDocuments(docs, { primaryKey: "id" });
  return { ok: true, count: docs.length };
}

/** Remove a property from the index by id. */
export async function deleteProperty(id: string): Promise<boolean> {
  const client = meilisearchAdminClient();
  if (!client) return false;
  await client.index(PROPERTIES_INDEX).deleteDocument(id);
  return true;
}

/** Run a search query against the index. Returns matched ids only —
 *  the caller hydrates from Postgres so RLS still applies. */
export async function searchProperties(opts: {
  q?: string;
  filters?: string[]; // Meili filter expressions
  sort?: string[]; // e.g. ["price_aed:asc"]
  limit?: number;
  offset?: number;
}): Promise<{ ids: string[]; total: number } | null> {
  const client = meilisearchAdminClient();
  if (!client) return null;
  const res = await client.index(PROPERTIES_INDEX).search(opts.q ?? "", {
    filter: opts.filters,
    sort: opts.sort,
    limit: opts.limit ?? 24,
    offset: opts.offset ?? 0,
    attributesToRetrieve: ["id"],
  });
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ids: res.hits.map((h: any) => String(h.id)),
    total: res.estimatedTotalHits ?? res.hits.length,
  };
}

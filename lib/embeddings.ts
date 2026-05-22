/**
 * Sprint 12 — Voyage AI embeddings.
 *
 * No first-party SDK; we fetch the REST endpoint directly. Falls back
 * to a deterministic null when VOYAGE_API_KEY isn't set so the
 * embedding-backfill cron and concierge semantic_search both degrade
 * gracefully to Postgres FTS.
 *
 * Default model: voyage-3 (1024 dims, multilingual). Cost ~$0.05 per
 * 1M tokens at writing time.
 */

import { env, isVoyageConfigured } from "@/lib/env";

const VOYAGE_API = "https://api.voyageai.com/v1/embeddings";

export const EMBEDDING_MODEL = "voyage-3";
export const EMBEDDING_DIM = 1024;

export type VoyageInputType = "document" | "query";

/** Embed a single text. Returns null when Voyage isn't configured. */
export async function embed(
  text: string,
  inputType: VoyageInputType = "document",
): Promise<number[] | null> {
  if (!isVoyageConfigured || !env.VOYAGE_API_KEY) return null;
  if (!text.trim()) return null;
  try {
    const res = await fetch(VOYAGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        model: EMBEDDING_MODEL,
        input_type: inputType,
      }),
    });
    if (!res.ok) {
      console.error("[voyage]", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as {
      data: { embedding: number[] }[];
    };
    return json.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("[voyage] threw", (e as Error).message);
    return null;
  }
}

/** Embed in batches (Voyage allows up to 128 texts/req). */
export async function embedBatch(
  texts: string[],
  inputType: VoyageInputType = "document",
): Promise<(number[] | null)[]> {
  if (!isVoyageConfigured || !env.VOYAGE_API_KEY || texts.length === 0)
    return texts.map(() => null);
  try {
    const res = await fetch(VOYAGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: texts,
        model: EMBEDDING_MODEL,
        input_type: inputType,
      }),
    });
    if (!res.ok) {
      console.error("[voyage batch]", res.status, await res.text().catch(() => ""));
      return texts.map(() => null);
    }
    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    const out: (number[] | null)[] = texts.map(() => null);
    for (const row of json.data) {
      out[row.index] = row.embedding;
    }
    return out;
  } catch (e) {
    console.error("[voyage batch] threw", (e as Error).message);
    return texts.map(() => null);
  }
}

/** Build the text we embed for a property. Order matters — title +
 *  area + description + amenities catches the bulk of the semantic
 *  intent in the first few hundred tokens. */
export function buildPropertyEmbedText(p: {
  title: string;
  short_description: string | null;
  description: string | null;
  area_name: string | null;
  type: string;
  beds: number;
  baths: number;
  amenities: string[] | null;
}): string {
  const parts = [
    `${p.beds}-bed ${p.baths}-bath ${p.type}`,
    p.title,
    p.area_name ? `in ${p.area_name}, Abu Dhabi` : "",
    p.short_description ?? "",
    p.description ? p.description.slice(0, 600) : "",
    p.amenities && p.amenities.length > 0
      ? `Amenities: ${p.amenities.join(", ")}`
      : "",
  ];
  return parts.filter(Boolean).join("\n").slice(0, 4000);
}

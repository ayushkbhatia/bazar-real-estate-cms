/**
 * Sprint 12 — pgvector embeddings backfill.
 *
 * Runs daily at 03:00. Finds published properties without a
 * property_embeddings row (or whose row predates the latest
 * properties.updated_at) and re-embeds them via Voyage.
 *
 * Batches 32 docs per Voyage call. Skips entirely when Voyage isn't
 * configured.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { env, isSupabaseConfigured, isVoyageConfigured } from "@/lib/env";
import {
  buildPropertyEmbedText,
  embedBatch,
  EMBEDDING_MODEL,
} from "@/lib/embeddings";
import { s8 } from "@/lib/supabase/sprint-8";
import type { Database } from "@/db/types";

function adminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Service-role Supabase not configured");
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const BATCH_SIZE = 32;
const MAX_BATCHES_PER_RUN = 50; // 1600 props/day at default cron

export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, reason: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, embedded: 0, skipped: "no supabase" });
  }
  if (!isVoyageConfigured) {
    return NextResponse.json({ ok: true, embedded: 0, skipped: "no voyage" });
  }

  try {
    const supabase = adminClient();
    let embedded = 0;

    for (let batchIdx = 0; batchIdx < MAX_BATCHES_PER_RUN; batchIdx++) {
      // Pull properties whose embedding is missing or stale. Using a
      // LEFT JOIN view is cleaner — for v1, two queries + JS filter.
      const { data: candidates, error } = await s8(supabase)
        .from("properties")
        .select(
          "id, title, short_description, description, type, beds, baths, amenities, updated_at, areas:area_id(name)",
        )
        .eq("status", "published")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .range(batchIdx * BATCH_SIZE, batchIdx * BATCH_SIZE + BATCH_SIZE - 1);
      if (error) throw error;
      if (!candidates || candidates.length === 0) break;

      // Filter to ones that need (re)embedding.
      const ids = candidates.map((c) => c.id);
      const { data: existing } = await s8(supabase)
        .from("property_embeddings")
        .select("property_id, updated_at")
        .in("property_id", ids);
      const existingMap = new Map(
        (existing ?? []).map(
          (e: { property_id: string; updated_at: string }) => [
            e.property_id,
            e.updated_at,
          ],
        ),
      );
      const needsEmbed = candidates.filter((c) => {
        const exUpdated = existingMap.get(c.id);
        return !exUpdated || new Date(exUpdated) < new Date(c.updated_at);
      });
      if (needsEmbed.length === 0) {
        if (candidates.length < BATCH_SIZE) break;
        continue;
      }

      const texts = needsEmbed.map((r) => {
        const area = Array.isArray(r.areas) ? r.areas[0] : r.areas;
        return buildPropertyEmbedText({
          title: r.title,
          short_description: r.short_description,
          description: r.description,
          area_name: area?.name ?? null,
          type: r.type,
          beds: r.beds,
          baths: r.baths,
          amenities: r.amenities,
        });
      });
      const vectors = await embedBatch(texts, "document");
      const upserts: {
        property_id: string;
        embedding: number[];
        model: string;
        updated_at: string;
      }[] = [];
      for (let i = 0; i < needsEmbed.length; i++) {
        const v = vectors[i];
        if (!v) continue;
        upserts.push({
          property_id: needsEmbed[i].id,
          embedding: v,
          model: EMBEDDING_MODEL,
          updated_at: new Date().toISOString(),
        });
      }
      if (upserts.length > 0) {
        await s8(supabase)
          .from("property_embeddings")
          .upsert(upserts, { onConflict: "property_id" });
        embedded += upserts.length;
      }
      if (candidates.length < BATCH_SIZE) break;
    }

    return NextResponse.json({ ok: true, embedded });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: "embeddings-backfill" } });
    console.error("[cron/embeddings-backfill]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

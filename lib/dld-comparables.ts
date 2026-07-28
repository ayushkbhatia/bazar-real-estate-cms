/**
 * Sprint 13 — DLD open-data comparables.
 *
 * The Dubai Land Department publishes monthly CSV exports of
 * transactions. Abu Dhabi (DMT) has a comparable open-data feed for
 * permitted transfers — endpoint URL is configured via the
 * `dld_open_data` integration row (config.csv_url) so the client can
 * swap the source after launch.
 *
 * The importer is intentionally simple: stream the CSV, filter to the
 * areas we cover, store as `dld_comparables` rows. /tools/valuation
 * reads these for the range estimate.
 */

import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import {
  getIntegration,
  markIntegrationError,
  markIntegrationSynced,
} from "@/lib/queries/integrations";
import type { Database } from "@/db/types";

export type DldComparable = {
  transaction_date: string;
  property_type: string;
  area_slug: string | null;
  built_up_ft2: number | null;
  price_aed: number;
  bedrooms: number | null;
  source: string;
};

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

/** Parse one row of a CSV string (handles quoted commas). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Fetch the DLD CSV from the integration's config.csv_url, parse it,
 *  and write a snapshot to `dld_comparables`. Sprint 8's migration
 *  doesn't include this table — Sprint 13 adds it via 0029. */
export async function importDldComparables(): Promise<{
  ok: boolean;
  imported: number;
  reason?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, imported: 0, reason: "no supabase" };
  const integration = await getIntegration("dld_open_data");
  const csvUrl =
    (integration?.config as { csv_url?: string } | null)?.csv_url ?? "";
  if (!csvUrl) {
    return { ok: false, imported: 0, reason: "csv_url missing on integration config" };
  }

  try {
    const res = await fetch(csvUrl, { cache: "no-store" });
    if (!res.ok) {
      const msg = `${res.status} ${res.statusText}`;
      await markIntegrationError("dld_open_data", msg);
      return { ok: false, imported: 0, reason: msg };
    }
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return { ok: false, imported: 0, reason: "empty CSV" };
    }
    const header = parseCsvLine(lines[0]).map((c) => c.toLowerCase().trim());
    const idx = {
      date: header.indexOf("transaction_date"),
      type: header.indexOf("property_type"),
      area: header.indexOf("area"),
      size: header.indexOf("built_up_ft2"),
      price: header.indexOf("price_aed"),
      beds: header.indexOf("bedrooms"),
    };

    const rows: DldComparable[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const price = Number(cols[idx.price]);
      if (!Number.isFinite(price) || price <= 0) continue;
      rows.push({
        transaction_date: cols[idx.date] ?? "",
        property_type: (cols[idx.type] ?? "").toLowerCase(),
        area_slug: cols[idx.area]
          ? cols[idx.area].toLowerCase().replace(/\s+/g, "-")
          : null,
        built_up_ft2: idx.size >= 0 ? Number(cols[idx.size]) || null : null,
        price_aed: price,
        bedrooms:
          idx.beds >= 0 ? (Number(cols[idx.beds]) || null) : null,
        source: "dld_open_data",
      });
    }

    const supabase = adminClient();
    // Replace last 12 months of snapshots; the importer is idempotent
    // because the CSV is point-in-time.
    const oneYearAgo = new Date(
      Date.now() - 365 * 86_400_000,
    ).toISOString();
    await supabase
      .from("dld_comparables")
      .delete()
      .gte("transaction_date", oneYearAgo);
    if (rows.length > 0) {
      // Insert in chunks of 500 to avoid request-size limits.
      for (let i = 0; i < rows.length; i += 500) {
        await supabase
          .from("dld_comparables")
          .insert(rows.slice(i, i + 500));
      }
    }

    await markIntegrationSynced("dld_open_data");
    return { ok: true, imported: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markIntegrationError("dld_open_data", message);
    return { ok: false, imported: 0, reason: message };
  }
}

/** Compute a comparable range for a subject property. Used by the
 *  valuation wizard's DMT comparables card. */
export async function getComparablesForSubject(opts: {
  area_slug: string | null;
  property_type: string;
  beds?: number | null;
  limit?: number;
}): Promise<DldComparable[]> {
  if (!isSupabaseConfigured || !opts.area_slug) return [];
  const supabase = adminClient();
  let q = supabase
    .from("dld_comparables")
    .select("*")
    .eq("area_slug", opts.area_slug)
    .eq("property_type", opts.property_type)
    .order("transaction_date", { ascending: false })
    .limit(opts.limit ?? 8);
  if (typeof opts.beds === "number") {
    q = q.eq("bedrooms", opts.beds);
  }
  const { data } = await q;
  return (data as DldComparable[] | null) ?? [];
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  evaluatePublishability,
  type PublishabilityResult,
} from "@/lib/publishability";
import { normaliseCompliance } from "@/lib/schemas/property";

/**
 * Shape returned by `listPropertiesByIdsForBulk`. Lightweight on purpose —
 * everything a bulk action needs without the joined development / area
 * blobs the catalogue table renders. Extend (don't reshape) sibling
 * helpers in `lib/queries/properties.ts`.
 */
export type BulkPropertyRow = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  status: string;
  price_aed: number;
  listing_permit_no: string | null;
  listing_permit_expires_at: string | null;
  compliance: Record<string, unknown> | null;
  has_hero: boolean;
};

/**
 * Resolve a list of property ids into bulk-action rows. RLS auto-applies —
 * rows the user can't see are dropped (they'll surface as "not_visible"
 * skips downstream).
 *
 * Preserves the order of `ids` so callers can render a stable per-row
 * pass/fail list. Caps at 500 ids defensively — the toolbar enforces 200
 * already.
 */
export async function listPropertiesByIdsForBulk(
  ids: string[],
): Promise<BulkPropertyRow[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, reference, slug, title, status, price_aed, listing_permit_no, listing_permit_expires_at, compliance, property_media(role)",
    )
    .in("id", ids.slice(0, 500))
    .is("deleted_at", null);
  if (error || !data) {
    if (error) console.error("[listPropertiesByIdsForBulk]", error);
    return [];
  }

  const rows: BulkPropertyRow[] = data.map((r) => {
    const media = (r as { property_media?: { role: string }[] }).property_media ?? [];
    return {
      id: r.id,
      reference: r.reference,
      slug: r.slug,
      title: r.title,
      status: r.status,
      price_aed: typeof r.price_aed === "number" ? r.price_aed : Number(r.price_aed),
      listing_permit_no: r.listing_permit_no,
      listing_permit_expires_at: r.listing_permit_expires_at,
      compliance: r.compliance as Record<string, unknown> | null,
      has_hero: media.some((m) => m.role === "hero"),
    };
  });

  const order = new Map(ids.map((id, idx) => [id, idx]));
  return rows.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

/** Run the existing publish gate on a bulk row. Pure-ish: just stitches
 *  the row shape into `evaluatePublishability`. */
export function evaluateBulkPublishability(
  row: BulkPropertyRow,
): PublishabilityResult {
  return evaluatePublishability({
    status: row.status,
    has_hero: row.has_hero,
    listing_permit_no: row.listing_permit_no,
    listing_permit_expires_at: row.listing_permit_expires_at,
    slug: row.slug,
    title: row.title,
    price_aed: row.price_aed,
    compliance: normaliseCompliance(row.compliance),
  });
}

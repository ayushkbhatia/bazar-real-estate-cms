/**
 * T3-B: shortlist lookup endpoint for the floating drawer.
 *
 * Accepts a `?ids=` comma-separated UUID list and returns the minimal
 * fields the drawer needs to render a row.  Reuses the existing
 * `getComparableProperties()` query (public-read on `published` properties)
 * so we don't fork a parallel data path.
 */

import { NextRequest, NextResponse } from "next/server";
import { getComparableProperties } from "@/lib/queries/compare";
import { SHORTLIST_CAP } from "@/lib/compare-store";
import { mediaPublicUrl } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const idsParam = new URL(req.url).searchParams.get("ids");
  const ids = (idsParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, SHORTLIST_CAP);
  if (ids.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // The drawer lists the whole shortlist, not a compare set, so it opts out
  // of the query's four-column default.
  const rows = await getComparableProperties(ids, SHORTLIST_CAP);
  const items = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    slug: r.slug,
    title: r.title,
    price_aed: r.price_aed,
    beds: r.beds,
    baths: r.baths,
    area_name: r.area_name,
    hero_url: r.hero ? mediaPublicUrl(r.hero.storage_key) : null,
    hero_alt: r.hero?.alt_text ?? null,
  }));

  return NextResponse.json({ items });
}

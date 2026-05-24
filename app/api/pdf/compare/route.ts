/**
 * BF-6 — compare PDF endpoint.
 *
 * GET /api/pdf/compare?ids=<id1,id2,...> → application/pdf.
 *
 * Resolves up to 4 published property rows (RLS-scoped via the public
 * client so we never leak draft/off-market) and streams a Bazar-branded
 * comparison PDF.
 */

import React from "react";
import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { ComparePdf, type ComparePropertyRow } from "@/lib/pdf/compare-pdf";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const idsParam = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (ids.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "ids query param required" },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, reason: "Supabase not configured" },
      { status: 503 },
    );
  }

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      // Two queries — Postgrest can't auto-resolve area_id when there
      // are multiple FKs (area_id, sub_community_id, building_id).
      "id, reference, title, price_aed, beds, baths, built_up_ft2, type, tenure, furnishing, view, amenities, area_id",
    )
    .in("id", ids)
    .eq("status", "published")
    .is("deleted_at", null);
  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { ok: false, reason: error?.message ?? "no properties" },
      { status: 404 },
    );
  }

  type RawRow = {
    id: string;
    reference: string;
    title: string;
    price_aed: number | string;
    beds: number;
    baths: number;
    built_up_ft2: number | null;
    type: string;
    tenure: string | null;
    furnishing: string | null;
    view: string | null;
    amenities: string[] | null;
    area_id: string | null;
  };

  // Resolve area names in a single follow-up read.
  const areaIds = Array.from(
    new Set(
      (data as RawRow[]).map((r) => r.area_id).filter((v): v is string => !!v),
    ),
  );
  let areaNameById = new Map<string, string>();
  if (areaIds.length > 0) {
    const { data: areaRows } = await supabase
      .from("areas")
      .select("id, name")
      .in("id", areaIds);
    areaNameById = new Map(
      (areaRows ?? []).map((a: { id: string; name: string }) => [a.id, a.name]),
    );
  }

  const rowsById = new Map<string, ComparePropertyRow>();
  for (const r of data as RawRow[]) {
    rowsById.set(r.id, {
      reference: r.reference,
      title: r.title,
      area_name: r.area_id ? areaNameById.get(r.area_id) ?? null : null,
      price_aed: Number(r.price_aed),
      beds: r.beds,
      baths: r.baths,
      built_up_ft2: r.built_up_ft2,
      type: r.type,
      tenure: r.tenure,
      furnishing: r.furnishing,
      view: r.view,
      amenities: r.amenities ?? [],
    });
  }
  // Preserve client-provided id order.
  const finalRows: ComparePropertyRow[] = ids
    .map((id) => rowsById.get(id))
    .filter((r): r is ComparePropertyRow => r !== undefined);

  const element = React.createElement(ComparePdf, { properties: finalRows });
  const stream = await renderToStream(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    element as any,
  );
  const webStream = nodeStreamToWebReadable(stream);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="bazar-compare.pdf"',
      "Cache-Control": "no-store",
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodeStreamToWebReadable(nodeStream: any): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err: Error) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy?.();
    },
  });
}

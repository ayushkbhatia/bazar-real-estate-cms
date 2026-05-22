/**
 * Sprint 12 — valuation report PDF endpoint.
 *
 * GET /api/pdf/valuation/[id] → branded valuation PDF. RLS gates which
 * rows the caller can read; we just call the existing query helper and
 * render whatever comes back. Owner sees full report; staff sees full
 * report; anyone else gets 404.
 */

import React from "react";
import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  ValuationReportPdf,
  type ValuationReport,
} from "@/lib/pdf/valuation-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, reason: "Supabase not configured" },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("valuation_requests")
    .select(
      "id, owner_name, property_type, beds, baths, built_up_ft2, building_name, address_line, area_id, estimate_low_aed, estimate_mid_aed, estimate_high_aed, advisor_estimate_aed, advisor_notes, sent_at, areas:area_id(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { ok: false, reason: "Not found" },
      { status: 404 },
    );
  }

  const areaName = Array.isArray(data.areas)
    ? data.areas[0]?.name ?? null
    : (data.areas as { name: string } | null)?.name ?? null;

  const report: ValuationReport = {
    id: data.id,
    owner_name: data.owner_name,
    property_type: data.property_type,
    beds: data.beds,
    baths: data.baths,
    built_up_ft2: data.built_up_ft2,
    building_name: data.building_name,
    area_name: areaName,
    estimate_low_aed: data.estimate_low_aed,
    estimate_mid_aed: data.estimate_mid_aed,
    estimate_high_aed: data.estimate_high_aed,
    advisor_estimate_aed: data.advisor_estimate_aed,
    advisor_notes: data.advisor_notes,
    sent_at: data.sent_at,
  };

  const element = React.createElement(ValuationReportPdf, { report });
  const stream = await renderToStream(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    element as any,
  );
  const webStream = nodeStreamToWebReadable(stream);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bazar-valuation-${id}.pdf"`,
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

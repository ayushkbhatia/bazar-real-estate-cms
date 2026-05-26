/**
 * Streams a Market Report PDF for the requested (area × type × quarter) tuple.
 * Mirrors the pattern in /api/pdf/mortgage and /api/pdf/valuation.
 */

import { NextRequest, NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import {
  PROPERTY_TYPES,
  getSnapshot,
  getTrend,
  listRecentComparables,
  quarterFromSlug,
  type PropertyTypeSlug,
} from "@/lib/queries/market-reports";
import { readPreferencesFromCookie } from "@/lib/preferences/server";
import { MarketReportPDF } from "@/lib/pdf/market-report-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const area = url.searchParams.get("area");
  const typeParam = url.searchParams.get("type");
  const quarterSlug = url.searchParams.get("quarter");

  if (!area || !typeParam || !quarterSlug) {
    return NextResponse.json(
      { error: "Missing area, type, or quarter param" },
      { status: 400 },
    );
  }
  if (!(PROPERTY_TYPES as readonly string[]).includes(typeParam)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  const quarter = quarterFromSlug(quarterSlug);
  if (!quarter) {
    return NextResponse.json({ error: "Invalid quarter" }, { status: 400 });
  }

  const property_type = typeParam as PropertyTypeSlug;
  const snapshot = await getSnapshot({ area_slug: area, property_type, quarter });
  if (!snapshot) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const [trend, comparables, prefs] = await Promise.all([
    getTrend({ area_slug: area, property_type, endQuarter: quarter, span: 8 }),
    listRecentComparables({ area_slug: area, property_type, quarter, limit: 12 }),
    readPreferencesFromCookie(),
  ]);

  const element = MarketReportPDF({
    snapshot,
    trend,
    comparables,
    prefs,
  });

  const stream = await renderToStream(element);
  // @react-pdf returns a Node Readable; convert to a Web ReadableStream
  const webStream = nodeToWeb(stream);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bazar-market-report-${area}-${property_type}-${quarterSlug}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

function nodeToWeb(node: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on("data", (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk)),
      );
      node.on("end", () => controller.close());
      node.on("error", (err) => controller.error(err));
    },
    cancel() {
      node.removeAllListeners?.();
    },
  });
}

/**
 * Sprint 12 — analytics export PDF endpoint.
 *
 * POST { snapshot } → application/pdf. Admin-only. The caller (the
 * "Export" button on /admin/analytics) gathers the on-screen snapshot
 * client-side and posts it here so the PDF matches what the user is
 * looking at; no re-query risks a stale comparison.
 */

import React from "react";
import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { z } from "zod";
import { currentStaffRow } from "@/lib/queries/staff";
import { AnalyticsPdf, type AnalyticsSnapshot } from "@/lib/pdf/analytics-pdf";

export const runtime = "nodejs";

const SnapshotSchema = z.object({
  rangeLabel: z.string().max(80),
  kpis: z.object({
    site_visits: z.number().nonnegative(),
    property_views: z.number().nonnegative(),
    enquiry_conversion_pct: z.number(),
    form_completions: z.number().nonnegative(),
    closes_aed: z.number().nonnegative(),
  }),
  traffic_by_source: z
    .array(
      z.object({
        label: z.string(),
        visits: z.number().nonnegative(),
        share: z.number(),
      }),
    )
    .max(20),
  top_searches: z
    .array(z.object({ query: z.string(), count: z.number().nonnegative() }))
    .max(50),
  top_neighborhoods: z
    .array(
      z.object({
        slug: z.string(),
        name: z.string(),
        views: z.number().nonnegative(),
      }),
    )
    .max(50),
  agent_leaderboard: z
    .array(
      z.object({
        display_name: z.string(),
        title: z.string().nullable(),
        closedAed: z.number().nonnegative(),
        deals: z.number().nonnegative(),
      }),
    )
    .max(50),
});

export async function POST(req: NextRequest) {
  const staff = await currentStaffRow();
  if (!staff) {
    return NextResponse.json(
      { ok: false, reason: "Staff role required" },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Invalid JSON" },
      { status: 400 },
    );
  }
  const parsed = SnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        reason: parsed.error.issues[0]?.message ?? "Invalid snapshot",
      },
      { status: 400 },
    );
  }

  const element = React.createElement(AnalyticsPdf, {
    snapshot: parsed.data as AnalyticsSnapshot,
  });
  const stream = await renderToStream(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    element as any,
  );
  const webStream = nodeStreamToWebReadable(stream);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="bazar-analytics.pdf"',
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

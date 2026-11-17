/**
 * Cash-flow timeline PDF endpoint — the "Custom plan as PDF" button in the
 * payment-plan section of a project page.
 *
 * POST { developmentName, unitLabel?, priceAed, plan, project?, unit? } →
 * application/pdf, drawn on Bazar's letterhead.
 * The plan is re-validated and the buckets are recomputed here rather than
 * trusted from the caller, so the document can't disagree with the page.
 */

import React from "react";
import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { z } from "zod";
import { paymentPlanSchema } from "@/lib/schemas/development";
import { PaymentPlanPdf } from "@/lib/pdf/payment-plan-pdf";
import { letterheadImage } from "@/lib/pdf/letterhead";

export const runtime = "nodejs";

const InputSchema = z.object({
  developmentName: z.string().min(1).max(120),
  unitLabel: z.string().max(160).nullish(),
  priceAed: z.number().min(0).max(1_000_000_000),
  plan: paymentPlanSchema,
  project: z
    .object({
      area: z.string().max(120).nullish(),
      developer: z.string().max(120).nullish(),
      handover: z.string().max(40).nullish(),
    })
    .nullish(),
  unit: z
    .object({
      kind: z.enum(["starting", "unitType", "unit"]).nullish(),
      type: z.string().max(120).nullish(),
      beds: z.number().int().min(0).max(50).nullish(),
      areaFt2: z.number().min(0).max(10_000_000).nullish(),
    })
    .nullish(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Invalid JSON" },
      { status: 400 },
    );
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // @react-pdf renderToStream expects a Document-rooted element; our
  // Shell wrapper provides that, but TS can't see through the FC.
  const element = React.createElement(PaymentPlanPdf, {
    developmentName: parsed.data.developmentName,
    unitLabel: parsed.data.unitLabel ?? null,
    priceAed: parsed.data.priceAed,
    plan: parsed.data.plan,
    project: parsed.data.project ?? undefined,
    unit: parsed.data.unit ?? undefined,
    letterhead: letterheadImage(),
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
      "Content-Disposition": 'attachment; filename="bazar-payment-plan.pdf"',
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

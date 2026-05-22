/**
 * Sprint 12 — mortgage scenario PDF endpoint.
 *
 * POST { input, result, scenarioName? } → application/pdf. The caller
 * (tools/mortgage pdf-action button) holds the calculator state +
 * computed result; we render the @react-pdf doc and stream it back.
 */

import React from "react";
import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { z } from "zod";
import {
  MortgageScenarioPdf,
  type MortgageScenarioInput,
  type MortgageScenarioResult,
} from "@/lib/pdf/mortgage-pdf";

export const runtime = "nodejs";

const InputSchema = z.object({
  input: z.object({
    property_price_aed: z.number().positive(),
    down_payment_pct: z.number().min(0).max(100),
    rate_pct: z.number().min(0).max(20),
    term_years: z.number().int().min(1).max(40),
    loan_type: z.enum(["fixed", "variable", "hybrid"]),
    buyer_status: z.enum(["uae_resident", "non_resident", "gcc_national"]),
  }),
  result: z.object({
    loan_amount_aed: z.number().nonnegative(),
    monthly_payment_aed: z.number().nonnegative(),
    total_interest_aed: z.number().nonnegative(),
    total_cost_aed: z.number().nonnegative(),
    dbr_pct: z.number().nullable(),
  }),
  scenarioName: z.string().max(120).nullish(),
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
      {
        ok: false,
        reason: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  // @react-pdf renderToStream expects a Document-rooted element; our
  // Shell wrapper provides that, but TS can't see through the FC.
  const element = React.createElement(MortgageScenarioPdf, {
    input: parsed.data.input as MortgageScenarioInput,
    result: parsed.data.result as MortgageScenarioResult,
    scenarioName: parsed.data.scenarioName ?? undefined,
  });
  const stream = await renderToStream(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    element as any,
  );

  // @react-pdf returns a Node Readable; convert to a web Response body.
  const webStream = nodeStreamToWebReadable(stream);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="bazar-mortgage-scenario.pdf"',
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

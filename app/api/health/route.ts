import { NextResponse } from "next/server";
import { httpStatusFor } from "@/lib/health";
import { buildHealthReport } from "@/lib/health-probes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const report = await buildHealthReport();
  return NextResponse.json(report, {
    status: httpStatusFor(report.status),
    headers: { "cache-control": "no-store" },
  });
}

// HEAD lets uptime monitors check without parsing JSON.
export async function HEAD() {
  const report = await buildHealthReport();
  return new NextResponse(null, {
    status: httpStatusFor(report.status),
    headers: { "cache-control": "no-store" },
  });
}

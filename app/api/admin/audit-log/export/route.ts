import { NextRequest } from "next/server";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import {
  listAuditLog,
  parseAuditFilters,
  rowsToCsv,
} from "@/lib/queries/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EXPORT_PAGES = 20; // 20 * 50 = 1000 rows. Plenty for v1.

export async function GET(req: NextRequest) {
  if (!(await currentUserIsAdmin())) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const filterInput: Record<string, string> = {};
  for (const [k, v] of url.searchParams) filterInput[k] = v;
  const filters = parseAuditFilters(filterInput);

  // Walk up to MAX_EXPORT_PAGES * 50 rows; v1 cap, fine for the
  // 90-day-or-so audit history we have on launch.
  let rows: Awaited<ReturnType<typeof listAuditLog>>["rows"] = [];
  for (let p = 0; p < MAX_EXPORT_PAGES; p++) {
    const { rows: pageRows, total } = await listAuditLog(filters, p);
    rows = rows.concat(pageRows);
    if (rows.length >= total || pageRows.length === 0) break;
  }

  const csv = rowsToCsv(rows);
  const filename = `bazar-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

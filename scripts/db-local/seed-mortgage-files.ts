/**
 * The bytes behind the local seed's files (seed-mortgage.ts writes the rows
 * only). Every active `mortgage_files` row gets a placeholder in the private
 * bucket at its storage key, so the CMS viewer (C3, C4) opens seeded files:
 * a PDF with the file's page count, each page naming the document, or a
 * card-shaped PNG for a photo.
 *
 * LOCAL ONLY. scripts/db-local/reset.sh runs it with the local stack's URL and
 * service key from `supabase status`; it refuses any URL that isn't this
 * machine's, so it can't write to production's bucket.
 *
 *   API_URL=… SERVICE_ROLE_KEY=… npx tsx scripts/db-local/seed-mortgage-files.ts
 */

import { createClient } from "@supabase/supabase-js";
import { MORTGAGE_BUCKET } from "../../lib/mortgage-requests/server/storage";
import { buildPdf, cardPng } from "../../lib/mortgage-requests/testing/fixtures";

const url = process.env.API_URL ?? "";
const key = process.env.SERVICE_ROLE_KEY ?? "";

function local(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
  } catch {
    return false;
  }
}

const NAMES: Record<string, string> = {
  emirates_id: "Emirates ID",
  passport: "Passport copy",
  salary_certificate: "Salary certificate",
  bank_statements_3m: "Bank statement",
  trade_license: "Business trade licence",
  bank_statements_12m: "Bank statement",
};

async function main() {
  if (!local(url) || !key) {
    console.error("seed-mortgage-files: needs API_URL on this machine and SERVICE_ROLE_KEY (local stack only)");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from("mortgage_files")
    .select("storage_key, mime, page_count, original_name, kind")
    .eq("state", "active");
  if (error) throw new Error(`files read failed: ${error.message}`);
  const rows = (data ?? []) as { storage_key: string; mime: string; page_count: number | null; original_name: string; kind: string | null }[];

  let done = 0;
  for (const f of rows) {
    const pdf = f.mime === "application/pdf";
    const bytes = pdf
      ? buildPdf({
          pages: Math.max(1, f.page_count ?? 1),
          // No kind: a bank's letter (C5), not one of the applicant's documents.
          lines: (page, pages) => [f.kind ? (NAMES[f.kind] ?? f.kind) : "Bank letter", f.original_name, `Page ${page} of ${pages}`, "Placeholder for local testing"],
        })
      : cardPng();
    const { error: upload } = await db.storage
      .from(MORTGAGE_BUCKET)
      .upload(f.storage_key, bytes, { contentType: pdf ? "application/pdf" : "image/png", upsert: true });
    if (upload) throw new Error(`upload failed for ${f.storage_key}: ${upload.message}`);
    done++;
  }
  console.log(`  ${done} placeholder file(s) in ${MORTGAGE_BUCKET}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

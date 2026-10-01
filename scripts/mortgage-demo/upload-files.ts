/**
 * The bytes behind the sample's files (the demo mode of
 * scripts/db-local/seed-mortgage.ts writes the rows and a manifest): a
 * placeholder in the private bucket at each file's storage key, so the CMS
 * viewer (C3, C4) and the bank package page open them — a PDF with the file's
 * page count, each page naming the document, or a card-shaped PNG for a photo.
 *
 * Writes only keys that belong to a sample request (sample.ts), and never over
 * an object that's already there, so a rerun only fills gaps.
 *
 *   (set -a; source .env.local; set +a; npx tsx scripts/mortgage-demo/upload-files.ts <manifest.json>)
 */

import { readFileSync } from "node:fs";
import { MORTGAGE_BUCKET } from "../../lib/mortgage-requests/server/storage";
import { buildPdf, cardPng } from "../../lib/mortgage-requests/testing/fixtures";
import { sampleRequests, serviceClient } from "./sample";

type ManifestFile = { storage_key: string; mime: string; page_count: number | null; original_name: string; kind: string | null };

const NAMES: Record<string, string> = {
  emirates_id: "Emirates ID",
  passport: "Passport copy",
  salary_certificate: "Salary certificate",
  bank_statements_3m: "Bank statement",
  trade_license: "Business trade licence",
  bank_statements_12m: "Bank statement",
};

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: upload-files.ts <manifest.json>");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { files: ManifestFile[] };
  const db = serviceClient();

  // Every key must be a file of a sample request on this stack.
  const samples = await sampleRequests(db);
  const { data, error } = await db.rpc("mortgage_erasure_files", { p_request_ids: samples.map((r) => r.id) });
  if (error) throw new Error(`files read failed: ${error.message}`);
  const allowed = new Set(((data ?? []) as { storage_key: string }[]).map((f) => f.storage_key));
  const strays = manifest.files.filter((f) => !allowed.has(f.storage_key));
  if (strays.length) throw new Error(`${strays.length} file(s) in the manifest aren't a sample's; nothing uploaded`);

  let uploaded = 0;
  let present = 0;
  for (const f of manifest.files) {
    const pdf = f.mime === "application/pdf";
    const bytes = pdf
      ? buildPdf({
          pages: Math.max(1, f.page_count ?? 1),
          // No kind: a bank's letter (C5), not one of the applicant's documents.
          lines: (page, pages) => [f.kind ? (NAMES[f.kind] ?? f.kind) : "Bank letter", f.original_name, `Page ${page} of ${pages}`, "Sample document for the demo"],
        })
      : cardPng();
    const { error: upload } = await db.storage
      .from(MORTGAGE_BUCKET)
      .upload(f.storage_key, bytes, { contentType: pdf ? "application/pdf" : "image/png", upsert: false });
    if (!upload) uploaded++;
    else if (/exists|duplicate/i.test(upload.message)) present++;
    else throw new Error(`upload failed for ${f.storage_key}: ${upload.message}`);
  }
  console.log(`${uploaded} placeholder(s) uploaded to ${MORTGAGE_BUCKET}, ${present} already there`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Erase the sample (scripts/mortgage-demo/README.md): every sample request's
 * files from the private bucket first, then its rows — documents, consents,
 * bank submissions, the activity log, everything — through the erasure
 * functions the DSR tool uses (0151). Then the sample banks, once nothing
 * points at them: FAB, ADCB and Mashreq while every inbox is @example.com.
 *
 *   (set -a; source .env.local; set +a; npx tsx scripts/mortgage-demo/clear.ts)         # lists
 *   (set -a; source .env.local; set +a; npx tsx scripts/mortgage-demo/clear.ts --yes)   # erases
 */

import { MORTGAGE_BUCKET } from "../../lib/mortgage-requests/server/storage";
import { sampleRequests, serviceClient } from "./sample";

const SAMPLE_BANKS = ["FAB", "ADCB", "MSQ"];

async function main() {
  const erase = process.argv.includes("--yes");
  const db = serviceClient();
  const samples = await sampleRequests(db);
  console.log(`${samples.length} sample request(s)${samples.length ? `: ${samples.map((r) => r.reference).join(", ")}` : ""}`);

  const { data: banks, error: banksError } = await db
    .from("mortgage_partner_banks")
    .select("id, code, package_emails")
    .in("code", SAMPLE_BANKS);
  if (banksError) throw new Error(`banks read failed: ${banksError.message}`);
  const sampleBanks = ((banks ?? []) as { id: string; code: string; package_emails: string[] | null }[]).filter(
    (b) => (b.package_emails ?? []).length > 0 && (b.package_emails ?? []).every((e) => e.toLowerCase().endsWith("@example.com")),
  );
  console.log(`${sampleBanks.length} sample bank(s)${sampleBanks.length ? `: ${sampleBanks.map((b) => b.code).join(", ")}` : ""}`);

  if (!erase) {
    console.log("Nothing changed. Run with --yes to erase them.");
    return;
  }

  if (samples.length) {
    const ids = samples.map((r) => r.id);
    const { data: files, error } = await db.rpc("mortgage_erasure_files", { p_request_ids: ids });
    if (error) throw new Error(`files read failed: ${error.message}`);
    const keys = ((files ?? []) as { storage_key: string }[]).map((f) => f.storage_key);
    // Objects first: a row without its object is harmless, an object without its row is lost track of.
    for (let i = 0; i < keys.length; i += 500) {
      const { error: removeError } = await db.storage.from(MORTGAGE_BUCKET).remove(keys.slice(i, i + 500));
      if (removeError) throw new Error(`bucket delete failed: ${removeError.message}`);
    }
    const { error: eraseError } = await db.rpc("mortgage_erase_requests", { p_request_ids: ids });
    if (eraseError) throw new Error(`erasure failed: ${eraseError.message}`);
    console.log(`erased ${samples.length} request(s) and ${keys.length} file(s)`);
  }

  for (const bank of sampleBanks) {
    const { count } = await db.from("mortgage_bank_submissions").select("id", { count: "exact", head: true }).eq("bank_id", bank.id);
    if (count) {
      console.log(`kept ${bank.code}: ${count} submission(s) still point at it`);
      continue;
    }
    const { error } = await db.from("mortgage_partner_banks").delete().eq("id", bank.id);
    if (error) throw new Error(`bank delete failed (${bank.code}): ${error.message}`);
    console.log(`deleted sample bank ${bank.code}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Erase the sample (scripts/mortgage-demo/README.md): every sample request's
 * files from the private bucket first, then its rows — documents, consents,
 * the activity log, everything — through the erasure functions the DSR tool
 * uses (0156).
 *
 *   (set -a; source .env.local; set +a; npx tsx scripts/mortgage-demo/clear.ts)         # lists
 *   (set -a; source .env.local; set +a; npx tsx scripts/mortgage-demo/clear.ts --yes)   # erases
 */

import { MORTGAGE_BUCKET } from "../../lib/mortgage-requests/server/storage";
import { sampleRequests, serviceClient } from "./sample";

async function main() {
  const erase = process.argv.includes("--yes");
  const db = serviceClient();
  const samples = await sampleRequests(db);
  console.log(`${samples.length} sample request(s)${samples.length ? `: ${samples.map((r) => r.reference).join(", ")}` : ""}`);

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
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

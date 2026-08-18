/**
 * Second pass over bodies that already have Arabic.
 *
 * `translate-records.ts` treats a non-null `_ar` as done, so a body that landed
 * 7 of 12 blocks keeps five English paragraphs forever. This walks the STORED
 * Arabic, finds blocks that are still English, retries just those against the
 * matching English block, and splices them back. Reports the reason for every
 * block it still cannot translate.
 */
import { createClient } from "@supabase/supabase-js";
import { toSlots, fromSlots, markIssues, normaliseModelEntities } from "../../lib/i18n/mt/html";
import { mask } from "../../lib/i18n/mt/mask";
import { nounMap } from "../../lib/i18n/mt/proper-nouns";
import { numeralOverrides } from "../../lib/i18n/mt/numerals";
import { translateField } from "../../lib/i18n/mt/translate";
import { mtClientFromEnv } from "../../lib/i18n/mt/hf-client";

const DRY = process.argv.includes("--dry-run");
const AR = /[؀-ۿ]/;
const LAT = /[A-Za-z]{4,}/;

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from("articles").select("id,slug,body_html,body_html_ar").order("slug");
  type Row = { id: string; slug: string; body_html: string; body_html_ar: string | null };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.body_html_ar);
  const { client, proseModel, provider } = await mtClientFromEnv();
  const nouns = nounMap();
  const terms = [...nouns.keys()];

  let fixed = 0, still = 0, scanned = 0;
  const reasons = new Map<string, number>();

  for (const r of rows) {
    const en = toSlots(r.body_html);
    const ar = toSlots(r.body_html_ar!);
    if (en.slots.length !== ar.slots.length) {
      console.log(`SKIP ${r.slug} — ${en.slots.length} EN slots vs ${ar.slots.length} AR, cannot align`);
      continue;
    }
    const stale = ar.slots.map((s, i) => (!AR.test(s.text) && LAT.test(s.text) ? i : -1)).filter(i => i >= 0);
    scanned += ar.slots.length;
    if (!stale.length) continue;
    process.stdout.write(`${r.slug}: ${stale.length}/${ar.slots.length} English … `);
    if (DRY) { console.log("(dry run)"); still += stale.length; continue; }

    const out: (string | null)[] = ar.slots.map(s => s.text);
    for (const i of stale) {
      const slot = en.slots[i]!;
      const res = await translateField({
        client, text: slot.text, kind: "body", properNouns: nouns,
        overrides: numeralOverrides(mask(slot.text, terms)),
        model: proseModel, fallbackModel: provider === "anthropic" ? undefined : null,
        extraIssues: (o) => markIssues(slot, o),
      });
      if (res.ok) { out[i] = normaliseModelEntities(res.text); fixed++; }
      else {
        still++;
        for (const c of res.issues) reasons.set(c.code, (reasons.get(c.code) ?? 0) + 1);
      }
    }
    const html = fromSlots(ar, out);
    const { error } = await sb.from("articles").update({ body_html_ar: html }).eq("id", r.id);
    console.log(error ? `WRITE FAILED ${error.message}` : `repaired`);
  }
  console.log(`\nscanned ${scanned} stored blocks · repaired ${fixed} · still English ${still}`);
  if (reasons.size) {
    console.log("\nwhy the rest still fail:");
    for (const [c, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${c}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });

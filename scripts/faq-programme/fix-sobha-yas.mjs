// One-off (2026-11-20): Sobha City Abu Dhabi is in Al Bahia (Gulf News, Khaleej
// Times, The National), though the DB files it under Yas Island. Drop it from the
// Yas Island area FAQs; rewrite through run.mjs from 2026-11-20-fix-unpublished/.
import fs from "node:fs";
const edits = [
  [2, "AED 1.3–1.7 million at Sobha City, Yas Park Place and The Canopies", "AED 1.39–1.65 million at Yas Park Place and The Canopies",
      "من 1.3 إلى 1.7 مليون درهم في سوبها سيتي وياس بارك بليس وذا كانوبيز", "من 1.39 إلى 1.65 مليون درهم في ياس بارك بليس وذا كانوبيز"],
  [4, "Manchester City Yas Residences by Ohana, Sobha City Abu Dhabi, JW Marriott", "Manchester City Yas Residences by Ohana, JW Marriott",
      "ومساكن مانشستر سيتي ياس من أوهانا، وسوبها سيتي أبوظبي، ومساكن", "ومساكن مانشستر سيتي ياس من أوهانا، ومساكن"],
  [6, "The Wadi, Sobha City, Yas Park Place", "The Wadi, Yas Park Place", "ذا وادي وسوبها سيتي وياس بارك بليس", "ذا وادي وياس بارك بليس"],
];
for (const f of ["scripts/faq-programme/2026-11-20-wave-0/payload.json", "scripts/faq-programme/2026-11-20-fix-unpublished/payload.json"]) {
  const p = JSON.parse(fs.readFileSync(f, "utf8"));
  const faq = p.pages.find((x) => x.slug === "yas-island").faq;
  for (const [i, a, b, c, d] of edits) {
    const e = faq[i - 1];
    if (!e.a.includes(a) || !e.a_ar.includes(c)) throw new Error(`${f} yas#${i}: text not found`);
    e.a = e.a.replace(a, b); e.a_ar = e.a_ar.replace(c, d);
  }
  fs.writeFileSync(f, JSON.stringify(p, null, 2) + "\n");
}
console.log("ok");

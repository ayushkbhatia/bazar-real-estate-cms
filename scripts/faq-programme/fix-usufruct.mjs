// One-off (2026-11-20): Wave 1 said foreigners can take usufruct/musataha rights
// outside Abu Dhabi's investment areas. Under Law No. 19 of 2005 those rights
// are open to non-nationals only INSIDE the investment areas (Tamimi; Chambers),
// so the claim is dropped from five nationals-only area FAQs.
import fs from "node:fs";
const E = [
  ["b", "khalifa-city", 1, "Outside those, non-nationals can usually rent or take long-term rights, so", "Outside those, non-nationals usually rent, so",
    "يقتصر حق غير المواطنين عادةً على الإيجار أو الحقوق طويلة الأجل،", "يقتصر حق غير المواطنين عادةً على الإيجار،"],
  ["b", "al-bahia", 1, "Non-nationals can rent, and in some cases take long-term rights such as usufruct of up to 99 years.", "Non-nationals can rent there.",
    "ويمكن لغير المواطنين الاستئجار، وفي بعض الحالات الحصول على حقوق طويلة الأجل مثل حق الانتفاع لمدة تصل إلى 99 عامًا.", "ويمكن لغير المواطنين الاستئجار فيها."],
  ["b", "al-rahba", 1, "Expatriates can rent there, and long-term rights such as usufruct of up to 99 years are possible only by agreement with the owner.", "Expatriates can rent there.",
    "ويمكن للمقيمين الاستئجار فيها، أما الحقوق طويلة الأجل مثل حق الانتفاع لمدة تصل إلى 99 عامًا فلا تكون إلا باتفاق مع المالك.", "ويمكن للمقيمين الاستئجار فيها."],
  ["b", "al-shahama", 1, "Expatriates can rent, and long-term rights such as usufruct of up to 99 years are possible only by agreement with an owner.", "Expatriates can rent there.",
    "ويمكن للمقيمين الاستئجار، أما الحقوق طويلة الأجل مثل حق الانتفاع لمدة تصل إلى 99 عامًا فلا تكون إلا باتفاق مع المالك.", "ويمكن للمقيمين الاستئجار فيها."],
  ["c", "rabdan", 1, "outright ownership is reserved for UAE nationals, while foreigners can hold musataha or usufruct rights.", "ownership is reserved for UAE nationals.",
    "يقتصر التملك التام على مواطني الدولة، بينما يمكن للأجانب الحصول على حق المساطحة أو حق الانتفاع.", "يقتصر التملك على مواطني الدولة."],
];
for (const [b, slug, i, a, a2, r, r2] of E) {
  const f = `scripts/faq-programme/2026-11-20-wave-1/batch-${b}/payload.json`;
  const p = JSON.parse(fs.readFileSync(f, "utf8"));
  const e = p.pages.find((x) => x.slug === slug).faq[i - 1];
  if (!e.a.includes(a) || !e.a_ar.includes(r)) throw new Error(`${slug}: text not found`);
  e.a = e.a.replace(a, a2); e.a_ar = e.a_ar.replace(r, r2);
  fs.writeFileSync(f, JSON.stringify(p, null, 2) + "\n");
}
console.log("ok");

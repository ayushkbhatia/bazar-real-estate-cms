// One-off (2026-11-20): remove references to 8 unpublished seed projects from
// live FAQs written in waves 0 and 1. Edits the payloads in place; the fixed
// pages are then rewritten through run.mjs from 2026-11-20-fix-unpublished/.
import fs from "node:fs";
const R = (f, slug, i, from, to) => {
  const p = JSON.parse(fs.readFileSync(f, "utf8"));
  const e = p.pages.find((x) => x.slug === slug).faq[i - 1];
  for (const k of ["a", "a_ar"]) {
    const [a, b] = k === "a" ? [from[0], to[0]] : [from[1], to[1]];
    if (a == null) continue;
    if (!e[k].includes(a)) throw new Error(`${slug}#${i} ${k}: not found: ${a}`);
    e[k] = e[k].replace(a, b);
  }
  fs.writeFileSync(f, JSON.stringify(p, null, 2) + "\n");
};
const W0 = "scripts/faq-programme/2026-11-20-wave-0/payload.json";
const W1A = "scripts/faq-programme/2026-11-20-wave-1/batch-a/payload.json";

R(W0, "saadiyat-island", 2,
  ["start from around AED 2.4–3.1 million in projects such as Bayviews, Sei Saadiyat and Mamsha Gardens, while branded residences and beachfront villas run well above AED 6 million.",
   "وتبدأ أسعار الشقق على الخريطة حاليًا من نحو 2.4 إلى 3.1 مليون درهم في مشاريع مثل باي فيوز وسي السعديات وممشى جاردنز، بينما تتجاوز المساكن ذات العلامات التجارية والفلل الشاطئية 6 ملايين درهم بكثير."],
  ["start from around AED 2.95–3.1 million at Sei Saadiyat and Mamsha Gardens, while villas at Talay in Marsa Al Saadiyat start from AED 13.5 million.",
   "وتبدأ أسعار الشقق على الخريطة حاليًا من نحو 2.95 إلى 3.1 مليون درهم في سي السعديات وممشى جاردنز، بينما تبدأ أسعار الفلل في تالاي بمرسى السعديات من 13.5 مليون درهم."]);
R(W0, "saadiyat-island", 4,
  ["Off-plan projects on Saadiyat Island include Sei Saadiyat, Mamsha Gardens, Bayviews Saadiyat, Mamsha Al Saadiyat and Talay at Marsa Al Saadiyat, all by Aldar, with branded launches such as Bulgari Residences, Mandarin Oriental Residences, Six Senses Residences and Saadiyat Lagoons. Handovers run from 2027 to 2030.",
   "تشمل المشاريع على الخريطة في جزيرة السعديات: سي السعديات وممشى جاردنز وباي فيوز السعديات وممشى السعديات وتالاي في مرسى السعديات، وجميعها من تطوير الدار، إضافة إلى مشاريع تحمل علامات تجارية مثل مساكن بولغاري ومساكن ماندارين أورينتال ومساكن سيكس سينسز والسعديات لاغونز. وتمتد مواعيد التسليم من 2027 إلى 2030."],
  ["Off-plan projects listed on Saadiyat Island include three Aldar communities: Sei Saadiyat, apartments due for handover in 2030; Mamsha Gardens, apartments and townhouses due in 2028, where most remaining stock is now resale; and Talay at Marsa Al Saadiyat, 351 villas due in 2029. A Bazar advisor can confirm which units are still available from the developer.",
   "تشمل المشاريع على الخريطة المدرجة في جزيرة السعديات ثلاثة مجتمعات من تطوير الدار: سي السعديات، وهي شقق يُتوقع تسليمها في 2030؛ وممشى جاردنز، وهي شقق ومنازل تاون هاوس يُتوقع تسليمها في 2028 ومعظم المعروض المتبقي فيها الآن إعادة بيع؛ وتالاي في مرسى السعديات، وهي 351 فيلا يُتوقع تسليمها في 2029. ويمكن لمستشاري بازار تأكيد الوحدات التي ما زالت متاحة لدى المطوّر."]);
R(W0, "yas-island", 4,
  ["Yas Riva Reserve and Solaya by Aldar", "وياس ريفا ريزيرف وسولايا من الدار"],
  ["and Yas Riva Reserve by Aldar", "وياس ريفا ريزيرف من الدار"]);
R(W0, "yas-island", 4, ["Handovers run from 2028 to 2030.", "من 2028 إلى 2030"], ["Handovers run from 2029 to 2030.", "من 2029 إلى 2030"]);
R(W0, "yas-island", 6,
  ["Manchester City Yas Residences, Solaya or JW Marriott Residences", "مساكن مانشستر سيتي ياس وسولايا ومساكن جيه دبليو ماريوت"],
  ["Manchester City Yas Residences, JW Marriott Residences or Yas Riva Reserve", "مساكن مانشستر سيتي ياس ومساكن جيه دبليو ماريوت وياس ريفا ريزيرف"]);
R(W1A, "al-reem-island", 2,
  [", rising to AED 3,100,000 at Reem Hills Phase 4, where townhouses and villas sit alongside the island's towers.",
   "، وتصل إلى 3,100,000 درهم في ريم هيلز - المرحلة الرابعة، حيث تجاور منازل التاون هاوس والفلل أبراج الجزيرة."],
  [", rising to AED 2,316,000 at Radiant Legacy.", "، وتصل إلى 2,316,000 درهم في راديانت ليجاسي."]);
R(W1A, "al-reem-island", 4,
  ["Ten off-plan projects are on sale on Al Reem Island, including Reem Hills Phase 4, Rixos Residences,",
   "تُعرض عشرة مشاريع على الخريطة للبيع في جزيرة الريم، منها ريم هيلز - المرحلة الرابعة وريكسوس ريزيدنسز"],
  ["Nine off-plan projects are on sale on Al Reem Island, including Rixos Residences,",
   "تُعرض تسعة مشاريع على الخريطة للبيع في جزيرة الريم، منها ريكسوس ريزيدنسز"]);
R(W1A, "al-reem-island", 5,
  ["that includes Reem Hills Phase 4 from AED 3,100,000, Radiant Legacy", "ريم هيلز - المرحلة الرابعة بدءًا من 3,100,000 درهم، وراديانت ليجاسي"],
  ["that includes Radiant Legacy", "راديانت ليجاسي"]);
console.log("ok");

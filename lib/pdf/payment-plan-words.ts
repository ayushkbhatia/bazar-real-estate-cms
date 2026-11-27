/**
 * Every word the payment-plan PDF prints, in English and in Arabic.
 *
 * The English is what the PDF has always said, moved here unchanged. The
 * Arabic is a first draft (ADR-0008) the client can correct; it borrows the
 * project page's own words where the page already says the same thing
 * (messages/ar/development.json → payment.*), so the document and the page it
 * was downloaded from agree.
 *
 * The currency and area words are not here: they come from the site's unit
 * dictionary (`/admin/settings/units`), which the route reads.
 */
import type { Locale } from "@/lib/i18n/locales";

export type PaymentPlanWords = {
  title: string;
  docTitle: (name: string) => string;
  preparedBy: string;
  company: string;
  date: string;
  dear: string;
  intro: (args: {
    name: string;
    what: "starting" | "unitType" | "unit" | null;
    type: string | null;
    hasPrice: boolean;
  }) => string;
  project: string;
  location: string;
  /** "Khalifa City, Abu Dhabi"; just "Abu Dhabi" without an area. */
  place: (area: string | null) => string;
  handover: string;
  /** "Q4 2029" as the page writes it, in this language. */
  quarter: (q: number, year: number) => string;
  startingPrice: (currency: string) => string;
  price: (currency: string) => string;
  unitType: string;
  startingPriceValue: string;
  bedrooms: string;
  size: (area: string) => string;
  sizeFrom: (area: string) => string;
  developer: string;
  instalmentsLabel: string;
  heads: [string, string, string, string, string];
  total: string;
  percent: (pct: string) => string;
  duringConstruction: string;
  atHandover: string;
  postHandover: string;
  instalments: (n: number) => string;
  overMonths: (pct: number, months: number) => string;
  /** A figure with its currency, on the side the language writes it. */
  money: (amount: string, currency: string) => string;
  note: string;
  /** "27-Nov-2026" / "27 نوفمبر 2026". */
  issued: (d: Date) => string;
};

const EN: PaymentPlanWords = {
  title: "PAYMENT PLAN",
  docTitle: (name) => `Payment plan · ${name}`,
  preparedBy: "Prepared by: ",
  company: "Bazar Real Estate",
  date: "Date: ",
  dear: "Dear Customer,",
  intro: ({ name, what, type, hasPrice }) => {
    const phrase =
      what === "starting"
        ? "at its starting price"
        : what === "unitType" && type
          ? `for the ${type} unit type`
          : what === "unit"
            ? "for the unit you selected"
            : "";
    return `Thank you for your interest in ${name}. Below is the developer's payment plan${phrase ? ` ${phrase}` : ""}, set out milestone by milestone with ${hasPrice ? "the amount due at each" : "the share of the price due at each"}.`;
  },
  project: "Project",
  location: "Location",
  place: (area) => (area ? `${area}, Abu Dhabi` : "Abu Dhabi"),
  handover: "Estimated Handover",
  quarter: (q, year) => `Q${q} ${year}`,
  startingPrice: (cur) => `Starting Price (${cur})`,
  price: (cur) => `Price (${cur})`,
  unitType: "Unit Type",
  startingPriceValue: "Starting price",
  bedrooms: "Bedrooms",
  size: (area) => `Size (${area})`,
  sizeFrom: (area) => `Size from (${area})`,
  developer: "Developer",
  instalmentsLabel: "Instalments",
  heads: ["Inst.", "Milestone", "Percentage", "Due", "Amount"],
  total: "Total",
  percent: (pct) => `${pct} %`,
  duringConstruction: "During construction",
  atHandover: "At handover",
  postHandover: "Post-handover",
  instalments: (n) => `${n} instalment${n === 1 ? "" : "s"}`,
  overMonths: (pct, months) => `${pct}% over ${months} months`,
  money: (amount, cur) => `${cur} ${amount}`,
  note: "Indicative only. Milestone dates follow the developer's construction programme and may move; amounts exclude ADM registration fees, service charges and any mortgage costs. This document is not an offer or a reservation. Speak to your Bazar advisor before committing to a schedule.",
  issued: (d) =>
    d
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Dubai",
      })
      .replace(/ /g, "-"),
};

const AR_QUARTERS = ["الربع الأول", "الربع الثاني", "الربع الثالث", "الربع الرابع"];

/** Arabic counts its nouns in four shapes; these are the page's own. */
function arInstalments(n: number): string {
  if (n === 1) return "قسط واحد";
  if (n === 2) return "قسطان";
  if (n >= 3 && n <= 10) return `${n} أقساط`;
  return `${n} قسطاً`;
}

const AR: PaymentPlanWords = {
  title: "خطة الدفع",
  docTitle: (name) => `خطة الدفع · ${name}`,
  preparedBy: "أعدّها: ",
  company: "بازار للعقارات",
  date: "التاريخ: ",
  dear: "عزيزنا العميل،",
  intro: ({ name, what, type, hasPrice }) => {
    const phrase =
      what === "starting"
        ? " بسعر البداية"
        : what === "unitType" && type
          ? ` لنوع الوحدة ${type}`
          : what === "unit"
            ? " للوحدة التي اخترتها"
            : "";
    return `شكراً لاهتمامك بمشروع ${name}. نعرض لك أدناه خطة الدفع التي وضعها المطوّر${phrase}، مرحلةً بمرحلة، مع ${hasPrice ? "المبلغ المستحق في كل مرحلة" : "نسبة السعر المستحقة في كل مرحلة"}.`;
  },
  project: "المشروع",
  location: "الموقع",
  place: (area) => (area ? `${area}، أبوظبي` : "أبوظبي"),
  handover: "موعد التسليم المتوقع",
  quarter: (q, year) => `${AR_QUARTERS[q - 1] ?? `الربع ${q}`} ${year}`,
  startingPrice: (cur) => `سعر البداية (${cur})`,
  price: (cur) => `السعر (${cur})`,
  unitType: "نوع الوحدة",
  startingPriceValue: "سعر البداية",
  bedrooms: "غرف النوم",
  size: (area) => `المساحة (${area})`,
  sizeFrom: (area) => `المساحة ابتداءً من (${area})`,
  developer: "المطوّر",
  instalmentsLabel: "عدد الأقساط",
  heads: ["القسط", "المرحلة", "النسبة", "الاستحقاق", "المبلغ"],
  total: "الإجمالي",
  // No space: a lone "%" after a space is a neutral the bidi pass can move.
  percent: (pct) => `${pct}%`,
  duringConstruction: "أثناء الإنشاء",
  atHandover: "عند التسليم",
  postHandover: "بعد التسليم",
  instalments: arInstalments,
  overMonths: (pct, months) => `${pct}% على مدى ${months} شهرًا`,
  money: (amount, cur) => `${amount}\u00A0${cur}`,
  note: "هذه الخطة استرشادية فقط. تتبع مواعيد الأقساط البرنامج الإنشائي للمطوّر وقد تتغيّر، ولا تشمل المبالغ رسوم التسجيل لدى بلدية أبوظبي ولا رسوم الخدمات ولا أي تكاليف للتمويل العقاري. هذه الوثيقة ليست عرضاً ولا حجزاً. تحدّث إلى مستشارك في بازار قبل الالتزام بأي جدول دفعات.",
  issued: (d) =>
    d.toLocaleDateString("ar-AE-u-nu-latn", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Dubai",
    }),
};

export function paymentPlanWords(locale: Locale): PaymentPlanWords {
  return locale === "ar" ? AR : EN;
}

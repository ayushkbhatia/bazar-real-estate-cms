// @vitest-environment node
import { describe, expect, it } from "vitest";
import { inLanguage, pdfPageCount, renderPaymentPlanPdf } from "./payment-plan-pdf";
import { letterheadImage } from "./letterhead";

const short = {
  name: "60/40 Payment Plan",
  milestones: [
    { percent: 60, label: "During construction", timing: "Monthly" },
    { percent: 40, label: "On Handover", timing: "Q3 2029" },
  ],
};

// The schema's maximum: twelve milestones, with post-handover instalments.
const longest = {
  name: "40/60 Post-handover Plan",
  post_handover_months: 24,
  milestones: [
    { percent: 10, label: "Booking", timing: "On booking" },
    ...[1, 2, 3, 4, 5].map((n) => ({
      percent: 6,
      label: `Instalment ${n}`,
      timing: `${n * 15}% construction`,
    })),
    { percent: 10, label: "On Handover", timing: "Q4 2028" },
    ...[1, 2, 3, 4, 5].map((n) => ({
      percent: 10,
      label: `Post-handover ${n}`,
      timing: `${n * 4} months after handover`,
    })),
  ],
};

// Every field at its schema limit: 80-character labels, 60-character timings.
const worst = {
  name: "Post-handover payment plan with quarterly instalments over the construction period".slice(
    0,
    80,
  ),
  milestones: Array.from({ length: 12 }, (_, i) => ({
    percent: i === 6 ? 12 : 8,
    label: (i === 6
      ? "On Handover — balance payable on completion and issue of the building handover notice"
      : `Instalment ${i + 1} — payable on reaching the stated construction milestone`
    )
      .slice(0, 80)
      .padEnd(80, "."),
    timing: "Within thirty days of the developer's written notice".padEnd(
      60,
      ".",
    ),
  })),
};

const base = {
  project: {
    area: "Saadiyat Island",
    developer: "Aldar Properties",
    handover: "Q4 2028",
  },
  unit: { kind: "unit" as const, type: "Villa", beds: 6, areaFt2: 6824 },
  letterhead: letterheadImage(),
  issuedAt: new Date("2026-11-17T08:00:00Z"),
};

describe("payment-plan PDF", () => {
  it("ships the letterhead as a JPEG", () => {
    expect(letterheadImage().subarray(0, 2).toString("hex")).toBe("ffd8");
  });

  it("is one A4 page on the letterhead, however long the plan", async () => {
    const cases = [
      {
        developmentName: "JW Marriott Residences",
        priceAed: 3_200_000,
        plan: short,
      },
      { developmentName: "JW Marriott Residences", priceAed: 0, plan: short },
      {
        developmentName: "Saadiyat Lagoons Phase 2 — Garden Villas",
        priceAed: 20_816_103,
        plan: longest,
      },
      {
        developmentName:
          "The Residences at Saadiyat Grove Cultural District — Phase Two Garden Villas and Townhouses".padEnd(
            120,
            ".",
          ),
        priceAed: 999_999_999,
        plan: worst,
      },
    ];
    for (const [c, locale] of cases.flatMap((c) => [[c, "en"], [c, "ar"]] as const)) {
      const pdf = await renderPaymentPlanPdf({ ...base, ...c, locale });
      const raw = pdf.toString("latin1");
      expect(raw.startsWith("%PDF")).toBe(true);
      expect(pdfPageCount(pdf)).toBe(1);
      // A4, not a page shrunk to its content.
      expect(raw).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
      expect(raw).toContain("/Subtype /Image");
    }
  }, 60_000);

  it("draws in Arabic on /ar, in the embedded Arabic face, and in Helvetica otherwise", async () => {
    const input = { ...base, developmentName: "JW Marriott Residences", priceAed: 3_200_000, plan: short };
    const ar = (await renderPaymentPlanPdf({ ...input, locale: "ar" })).toString("latin1");
    const en = (await renderPaymentPlanPdf(input)).toString("latin1");
    expect(ar).toMatch(/IBMPlexSansArabic/);
    expect(ar).not.toMatch(/\/BaseFont \/Helvetica/);
    expect(en).toMatch(/\/BaseFont \/Helvetica/);
    expect(en).not.toMatch(/IBMPlexSansArabic/);
  }, 30_000);
});

// fontkit caches one glyph per id; subsetting the first PDF cached the digits
// without their code points, and the SECOND Arabic PDF with a figure beside an
// Arabic word ("120 درهم") then threw in the bidi pass. One render proves
// nothing; it takes a warm font.
it("renders Arabic again and again on a warm font", async () => {
  for (let i = 0; i < 6; i++) {
    const pdf = await renderPaymentPlanPdf({
      ...base,
      developmentName: "مساكن جيه دبليو ماريوت",
      priceAed: 1000 + i * 120_123,
      plan: i % 2 ? longest : short,
      locale: "ar",
    });
    expect(pdfPageCount(pdf)).toBe(1);
  }
}, 60_000);

describe("inLanguage", () => {
  it("prints English as given on the English site", () => {
    expect(inLanguage("en", "On Handover", "عند التسليم")).toBe("On Handover");
  });
  it("prefers the editor's typed Arabic, then the store, then the English", () => {
    expect(inLanguage("ar", "On Handover", " عند الاستلام ")).toBe("عند الاستلام");
    expect(inLanguage("ar", "A milestone nobody has translated", null)).toBe(
      "A milestone nobody has translated",
    );
  });
  it("leaves text that is already Arabic alone", () => {
    expect(inLanguage("ar", "مدينة خليفة")).toBe("مدينة خليفة");
  });
});

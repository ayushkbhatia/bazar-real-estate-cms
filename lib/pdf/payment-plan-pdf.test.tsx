// @vitest-environment node
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { PaymentPlanPdf } from "./payment-plan-pdf";
import { letterheadImage } from "./letterhead";

const plan = {
  name: "60/40 Payment Plan",
  milestones: [
    { percent: 60, label: "During construction", timing: "Monthly" },
    { percent: 40, label: "On Handover", timing: "Q3 2029" },
  ],
};

describe("payment-plan PDF", () => {
  it("ships the letterhead as an A4 JPEG", () => {
    const jpg = letterheadImage();
    expect(jpg.subarray(0, 2).toString("hex")).toBe("ffd8");
  });

  it("draws one A4 page on the letterhead, with or without a price", async () => {
    for (const priceAed of [3_200_000, 0]) {
      const pdf = await renderToBuffer(
        React.createElement(PaymentPlanPdf, {
          developmentName: "JW Marriott Residences",
          priceAed,
          plan,
          project: { area: "Yas Island", developer: "Taraf", handover: "Q3 2029" },
          unit: { kind: "unitType", type: "2 Bedroom", beds: 2, areaFt2: 1450 },
          letterhead: letterheadImage(),
          issuedAt: new Date("2026-11-17T08:00:00Z"),
        }) as unknown as Parameters<typeof renderToBuffer>[0],
      );
      const raw = pdf.toString("latin1");
      expect(raw.startsWith("%PDF")).toBe(true);
      expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(1);
      expect(raw).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
      expect(raw).toContain("/Subtype /Image");
    }
  });
});

import { describe, expect, it } from "vitest";
import { pdfLabel, pdfLanguageSuffix } from "./language-note";

describe("PDF language note", () => {
  it("leaves English controls untouched", () => {
    expect(pdfLanguageSuffix("en")).toBe("");
    expect(pdfLabel("Download PDF", "en")).toBe("Download PDF");
  });

  it("marks the download as English on an Arabic page", () => {
    // The alternative is not "an Arabic PDF" — it is a broken-looking one.
    // @react-pdf/renderer lays every flexDirection:"row" out left-to-right
    // regardless of the direction style, and the standard-14 fonts carry no
    // Arabic, so a half-measure renders blank boxes in a mirrored-looking
    // frame. That reads as a broken feature; a labelled English PDF reads as
    // an unfinished one.
    expect(pdfLabel("Download PDF", "ar")).toBe("Download PDF (English)");
    expect(pdfLabel("PDF summary", "ar")).toBe("PDF summary (English)");
  });

  it("defaults to English when no locale is passed", () => {
    expect(pdfLabel("Download PDF")).toBe("Download PDF");
  });
});

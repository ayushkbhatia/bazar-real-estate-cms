import { describe, expect, it } from "vitest";
import { descriptionHtml } from "./rich-text";

describe("descriptionHtml", () => {
  it("renders the stored HTML instead of printing its tags", () => {
    expect(descriptionHtml("<p>One</p><p>Two &amp; three</p>")).toBe("<p>One</p><p>Two &amp; three</p>");
  });

  it("sanitises on the way out, whoever wrote the row", () => {
    const html = descriptionHtml('<p onclick="x()">Hi</p><script>alert(1)</script><img src="javascript:x">');
    expect(html).toBe("<p>Hi</p>");
  });

  it("turns an older plain-text description into paragraphs", () => {
    expect(descriptionHtml("Line one\nline two\n\nNext")).toBe("<p>Line one<br>line two</p><p>Next</p>");
    expect(descriptionHtml("Plain & simple")).toBe("<p>Plain &amp; simple</p>");
  });

  it("is empty for nothing", () => {
    expect(descriptionHtml(null)).toBe("");
    expect(descriptionHtml("   ")).toBe("");
  });
});

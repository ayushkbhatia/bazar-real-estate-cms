import { describe, expect, it } from "vitest";
import { emailImageUrl, parseEmailImageParams } from "./email-image";

const parse = (url: string) => parseEmailImageParams(new URL(url).searchParams);

describe("email image addresses", () => {
  it("round-trips a size, a crop and a tint", () => {
    const url = emailImageUrl("https://site", "brand/a.png", { width: 600, ratio: 2, tint: "#003452", opacity: 35 });
    expect(parse(url)).toEqual({ key: "brand/a.png", width: 1200, ratio: 2, tint: "003452", opacity: 35 });
  });

  it("refuses anything that is not a media key or a width it makes", () => {
    expect(parse("https://site/x?k=../etc/passwd&w=1200")).toBeNull();
    expect(parse("https://site/x?k=https://evil.example/a.png&w=1200")).toBeNull();
    expect(parse("https://site/x?k=brand/a.png&w=5000")).toBeNull();
  });
});

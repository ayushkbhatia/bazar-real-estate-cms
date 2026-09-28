import { describe, expect, it } from "vitest";
import { redactSecureLinkPaths } from "./secure-link-redaction";

describe("secure link redaction", () => {
  it("keeps the route and drops the token, for an applicant's link and a bank's package", () => {
    expect(redactSecureLinkPaths("https://www.bazarrealestate.ae/mortgages/r/Ab_3-x9QzT0kLmNoPq?utm=1")).toBe(
      "https://www.bazarrealestate.ae/mortgages/r/[token]?utm=1",
    );
    expect(redactSecureLinkPaths("/mortgages/p/Zz9_yy8-XX7ww6VV5uu4TT3ss2RR1qq0PP#top")).toBe("/mortgages/p/[token]#top");
    expect(redactSecureLinkPaths("/ar/mortgages/p/abcdefghijklmnop")).toBe("/ar/mortgages/p/[token]");
  });

  it("leaves every other path alone", () => {
    for (const path of ["/mortgages/apply", "/mortgages/pre-approval", "/p/villa-in-saadiyat", "/admin/mortgages/BZM-26-0412"]) {
      expect(redactSecureLinkPaths(path)).toBe(path);
    }
  });
});

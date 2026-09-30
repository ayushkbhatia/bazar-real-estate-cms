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

  it("and in the API routes behind them", () => {
    expect(redactSecureLinkPaths("POST /api/mortgage/links/Ab3_x-9QzT0kLmNoPqRsTuV/verify")).toBe("POST /api/mortgage/links/[token]/verify");
    expect(redactSecureLinkPaths("/api/mortgage/packages/Zz9_yy8-XX7ww6VV5uu4/files/3f1c2a4e")).toBe(
      "/api/mortgage/packages/[token]/files/3f1c2a4e",
    );
    // Drafts are Bearer-authenticated, not token-in-path: their ids stay.
    expect(redactSecureLinkPaths("/api/mortgage/drafts/3f1c2a4e/files")).toBe("/api/mortgage/drafts/3f1c2a4e/files");
  });

  it("leaves every other path alone", () => {
    for (const path of ["/mortgages/apply", "/mortgages/pre-approval", "/p/villa-in-saadiyat", "/admin/mortgages/BZM-26-0412"]) {
      expect(redactSecureLinkPaths(path)).toBe(path);
    }
  });
});

/**
 * `RESEND_FROM_ADDRESS` used to be validated with a bare `z.string().email()`,
 * which rejected the display-name form that Resend accepts and that
 * docs/INTEGRATIONS.md instructed operators to use. Because lib/env.ts parses
 * at module scope with a throwing `.parse()`, setting the documented value
 * failed `next build` outright. These cover the parsing that replaced it.
 */
import { describe, it, expect } from "vitest";
import { extractEmailAddress } from "@/lib/env";

describe("extractEmailAddress", () => {
  it("returns a bare address unchanged", () => {
    expect(extractEmailAddress("hello@bazarrealestate.com")).toBe(
      "hello@bazarrealestate.com",
    );
  });

  it("unwraps the display-name form", () => {
    expect(
      extractEmailAddress("Bazar Real Estate <hello@bazarrealestate.com>"),
    ).toBe("hello@bazarrealestate.com");
  });

  it("tolerates surrounding whitespace", () => {
    expect(extractEmailAddress("  Bazar <hello@bazar.ae>  ")).toBe(
      "hello@bazar.ae",
    );
  });

  it("handles a display name containing an angle bracket-free address", () => {
    expect(extractEmailAddress("Sales, Bazar <sales@bazar.ae>")).toBe(
      "sales@bazar.ae",
    );
  });

  it("leaves an unparseable value alone so the schema can reject it", () => {
    expect(extractEmailAddress("not an address")).toBe("not an address");
  });
});

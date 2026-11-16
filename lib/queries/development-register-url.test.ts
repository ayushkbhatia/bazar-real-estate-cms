import { describe, expect, it } from "vitest";
import { developmentRegisterUrl, registerUrlForProjectLink } from "./development-utils";

describe("a project's sign-up page", () => {
  it("sits under the project page", () => {
    expect(developmentRegisterUrl({ slug: "jw-marriott-residences" })).toBe(
      "/developments/jw-marriott-residences/register",
    );
  });

  it("is offered for a link to the project page, in either language", () => {
    for (const [link, want] of [
      ["/developments/jw-marriott-residences", "/developments/jw-marriott-residences/register"],
      ["/developments/jw-marriott-residences/", "/developments/jw-marriott-residences/register"],
      ["/developments/jw-marriott-residences#units", "/developments/jw-marriott-residences/register"],
      ["/developments/jw-marriott-residences?utm_source=x", "/developments/jw-marriott-residences/register"],
      ["/ar/developments/jw-marriott-residences", "/ar/developments/jw-marriott-residences/register"],
      [" /developments/Saadiyat-Lagoons ", "/developments/saadiyat-lagoons/register"],
    ] as const) {
      expect(registerUrlForProjectLink(link)).toBe(want);
    }
  });

  it("is not offered for anything else", () => {
    for (const link of [
      "/developments",
      "/developments/jw-marriott-residences/register",
      "/off-plan/search",
      "/off-plan/launches",
      "/contact",
      "https://example.com/developments/jw-marriott-residences",
      "{{unsubscribe_url}}",
      "",
    ]) {
      expect(registerUrlForProjectLink(link)).toBeNull();
    }
  });
});

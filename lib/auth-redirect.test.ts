import { describe, it, expect } from "vitest";
import { safeRelativePath, pickPostSignInPath } from "./auth-redirect";

describe("safeRelativePath", () => {
  it("accepts a plain relative path", () => {
    expect(safeRelativePath("/admin/properties")).toBe("/admin/properties");
    expect(safeRelativePath("/account")).toBe("/account");
  });

  it("rejects absolute and protocol-relative URLs (open-redirect guard)", () => {
    expect(safeRelativePath("https://evil.com")).toBeNull();
    expect(safeRelativePath("http://evil.com")).toBeNull();
    expect(safeRelativePath("//evil.com")).toBeNull();
    expect(safeRelativePath("/\\evil.com")).toBeNull();
  });

  it("rejects non-slash, empty, and non-string input", () => {
    expect(safeRelativePath("admin")).toBeNull();
    expect(safeRelativePath("")).toBeNull();
    expect(safeRelativePath(null)).toBeNull();
    expect(safeRelativePath(undefined)).toBeNull();
  });
});

describe("pickPostSignInPath", () => {
  it("routes staff to /admin and customers to /account when no request", () => {
    expect(pickPostSignInPath({ isStaff: true })).toBe("/admin");
    expect(pickPostSignInPath({ isStaff: false })).toBe("/account");
  });

  it("honours a safe requested path for the matching role", () => {
    expect(
      pickPostSignInPath({ isStaff: true, requested: "/admin/enquiries" }),
    ).toBe("/admin/enquiries");
    expect(
      pickPostSignInPath({ isStaff: false, requested: "/account/saved" }),
    ).toBe("/account/saved");
  });

  it("never sends a non-staff user to an /admin destination", () => {
    expect(
      pickPostSignInPath({ isStaff: false, requested: "/admin" }),
    ).toBe("/account");
    expect(
      pickPostSignInPath({ isStaff: false, requested: "/admin/properties" }),
    ).toBe("/account");
  });

  it("does not treat '/administrator' as an /admin destination", () => {
    // Prefix check must be path-segment aware.
    expect(
      pickPostSignInPath({ isStaff: false, requested: "/administrator" }),
    ).toBe("/administrator");
  });

  it("falls back to role default when the request is unsafe", () => {
    expect(
      pickPostSignInPath({ isStaff: true, requested: "https://evil.com" }),
    ).toBe("/admin");
    expect(
      pickPostSignInPath({ isStaff: false, requested: "//evil.com" }),
    ).toBe("/account");
  });
});

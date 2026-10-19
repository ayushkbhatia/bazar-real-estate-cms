import { describe, expect, it } from "vitest";
import { isMortgageAdminPath } from "./mortgage-admin-paths";
import {
  ALL_STAFF_ROLES,
  ROLE_LABEL,
  STAFF_ROLES,
  isMortgageAdmin,
  staffInviteSchema,
} from "@/lib/schemas/staff";

describe("isMortgageAdminPath", () => {
  it.each([
    "/admin/mortgages",
    "/admin/mortgages/BZM-26-0001",
    "/admin/mortgages/settings",
    "/admin/pages/mortgage-stages",
  ])("lets a Mortgage Admin open %s", (p) => {
    expect(isMortgageAdminPath(p)).toBe(true);
  });

  it.each([
    "/admin",
    "/admin/enquiries",
    "/admin/pages",
    "/admin/settings/mortgage",
    "/admin/mortgages-export",
    "/admin/pages/mortgage-stages-old",
    null,
  ])("keeps a Mortgage Admin out of %s", (p) => {
    expect(isMortgageAdminPath(p)).toBe(false);
  });
});

describe("Mortgage Admin role", () => {
  it("can be invited but is not one of the CMS-wide roles", () => {
    expect(ALL_STAFF_ROLES).toContain("mortgage_admin");
    expect(STAFF_ROLES).not.toContain("mortgage_admin");
    expect(ROLE_LABEL.mortgage_admin).toBe("Mortgage Admin");
    expect(
      staffInviteSchema.safeParse({
        email: "someone@example.com",
        display_name: "Someone",
        role: "mortgage_admin",
      }).success,
    ).toBe(true);
  });

  it("is recognised only by its own name", () => {
    expect(isMortgageAdmin("mortgage_admin")).toBe(true);
    expect(isMortgageAdmin("admin")).toBe(false);
    expect(isMortgageAdmin(null)).toBe(false);
  });
});

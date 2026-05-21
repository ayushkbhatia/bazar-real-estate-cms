import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  can,
  permissionsSummary,
  staffInviteSchema,
  staffRoleUpdateSchema,
  staffStatusUpdateSchema,
} from "./staff";

describe("staffInviteSchema", () => {
  it("accepts a well-formed invite", () => {
    const r = staffInviteSchema.safeParse({
      email: "jameel@bazar.ae",
      display_name: "Jameel Khan",
      role: "agent",
    });
    expect(r.success).toBe(true);
  });

  it("trims whitespace from email and display_name", () => {
    const r = staffInviteSchema.safeParse({
      email: "  jameel@bazar.ae  ",
      display_name: "  Jameel Khan  ",
      role: "editor",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("jameel@bazar.ae");
      expect(r.data.display_name).toBe("Jameel Khan");
    }
  });

  it("rejects a malformed email", () => {
    const r = staffInviteSchema.safeParse({
      email: "not-an-email",
      display_name: "X",
      role: "agent",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a too-short display name", () => {
    const r = staffInviteSchema.safeParse({
      email: "j@x.io",
      display_name: "A",
      role: "agent",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown role", () => {
    const r = staffInviteSchema.safeParse({
      email: "j@x.io",
      display_name: "Jameel",
      role: "superuser",
    });
    expect(r.success).toBe(false);
  });
});

describe("staffRoleUpdateSchema", () => {
  it("requires a valid uuid", () => {
    const ok = staffRoleUpdateSchema.safeParse({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      role: "editor",
    });
    expect(ok.success).toBe(true);
    const bad = staffRoleUpdateSchema.safeParse({
      user_id: "not-a-uuid",
      role: "editor",
    });
    expect(bad.success).toBe(false);
  });
});

describe("staffStatusUpdateSchema", () => {
  it("accepts known statuses only", () => {
    const ok = staffStatusUpdateSchema.safeParse({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      status: "suspended",
    });
    expect(ok.success).toBe(true);
    const bad = staffStatusUpdateSchema.safeParse({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      status: "deleted",
    });
    expect(bad.success).toBe(false);
  });
});

describe("PERMISSIONS / can()", () => {
  it("only admins can manage users", () => {
    expect(can("admin", "manage_users")).toBe(true);
    expect(can("editor", "manage_users")).toBe(false);
    expect(can("agent", "manage_users")).toBe(false);
    expect(can("marketing", "manage_users")).toBe(false);
    expect(can("support", "manage_users")).toBe(false);
  });

  it("only admins can manage settings", () => {
    expect(can("admin", "manage_settings")).toBe(true);
    expect(can("editor", "manage_settings")).toBe(false);
  });

  it("admins, editors and agents can publish a property", () => {
    expect(can("admin", "publish_property")).toBe(true);
    expect(can("editor", "publish_property")).toBe(true);
    expect(can("agent", "publish_property")).toBe(true);
    expect(can("marketing", "publish_property")).toBe(false);
    expect(can("support", "publish_property")).toBe(false);
  });

  it("admins, editors and marketing can edit the blog", () => {
    expect(can("admin", "edit_blog")).toBe(true);
    expect(can("editor", "edit_blog")).toBe(true);
    expect(can("marketing", "edit_blog")).toBe(true);
    expect(can("agent", "edit_blog")).toBe(false);
    expect(can("support", "edit_blog")).toBe(false);
  });

  it("support can read enquiries but not the audit log", () => {
    expect(can("support", "reply_enquiries")).toBe(true);
    expect(can("support", "read_audit_log")).toBe(false);
  });

  it("returns false for null/undefined role", () => {
    expect(can(null, "manage_users")).toBe(false);
    expect(can(undefined, "publish_property")).toBe(false);
  });

  it("matrix is consistent — every permission lists at least admin", () => {
    for (const [perm, roles] of Object.entries(PERMISSIONS)) {
      expect(roles).toContain("admin");
      expect(perm.length).toBeGreaterThan(0);
    }
  });
});

describe("permissionsSummary", () => {
  it("returns a short string for each role", () => {
    expect(permissionsSummary("admin")).toBe("Full access");
    expect(permissionsSummary("editor")).toBe("Catalogue + content");
    expect(permissionsSummary("agent")).toBe("Own listings only");
    expect(permissionsSummary("marketing")).toBe("Pages, media, blog");
    expect(permissionsSummary("support")).toBe("Read-only on enquiries");
  });
});

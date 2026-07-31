/**
 * @vitest-environment node
 *
 * lib/auth.ts pulls in createSupabaseServerClient, which imports
 * `server-only` and `next/headers`. We mock the server-client factory
 * outright so the helper can run under the node test environment without
 * pulling Next's request context.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectSpy, notFoundSpy, getUserMock, maybeSingleMock } = vi.hoisted(
  () => ({
    redirectSpy: vi.fn((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    }),
    notFoundSpy: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    getUserMock: vi.fn(),
    maybeSingleMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectSpy,
  notFound: notFoundSpy,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  redirectSpy.mockClear();
  notFoundSpy.mockClear();
  getUserMock.mockReset();
  maybeSingleMock.mockReset();
});

describe("requireSignedIn", () => {
  it("redirects to the staff door when there is no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { requireSignedIn } = await import("./auth");
    await expect(requireSignedIn()).rejects.toThrow(/NEXT_REDIRECT:\/admin\/login/);
    expect(redirectSpy).toHaveBeenCalledWith("/admin/login");
  });

  it("returns the user + supabase client when signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { requireSignedIn } = await import("./auth");
    const out = await requireSignedIn();
    expect(out.user.id).toBe("u1");
    expect(out.supabase).toBeDefined();
    expect(redirectSpy).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("delegates the sign-in redirect to requireSignedIn", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { requireRole } = await import("./auth");
    await expect(requireRole(["admin"])).rejects.toThrow(
      /NEXT_REDIRECT:\/admin\/login/,
    );
  });

  it("404s when the user has no staff row", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { requireRole } = await import("./auth");
    await expect(requireRole(["admin"])).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalled();
  });

  it("404s when the staff row select errors", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "rls" },
    });
    const { requireRole } = await import("./auth");
    await expect(requireRole(["admin"])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s when the staff status is not active", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: "u1",
        display_name: "Suspended Sally",
        role: "admin",
        status: "suspended",
        photo_url: null,
        title: null,
      },
      error: null,
    });
    const { requireRole } = await import("./auth");
    await expect(requireRole(["admin"])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s when the role is outside the allow-list", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: "u1",
        display_name: "Support Steve",
        role: "support",
        status: "active",
        photo_url: null,
        title: null,
      },
      error: null,
    });
    const { requireRole } = await import("./auth");
    await expect(requireRole(["admin", "editor"])).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("returns the staff row when the role matches and status is active", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: "u1",
        display_name: "Admin Alice",
        role: "admin",
        status: "active",
        photo_url: null,
        title: "Founder",
      },
      error: null,
    });
    const { requireRole } = await import("./auth");
    const out = await requireRole(["admin"]);
    expect(out.user.id).toBe("u1");
    expect(out.staff.role).toBe("admin");
    expect(out.staff.status).toBe("active");
    expect(notFoundSpy).not.toHaveBeenCalled();
  });

  it("accepts any role in the allow-list", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: "u1",
        display_name: "Editor Edith",
        role: "editor",
        status: "active",
        photo_url: null,
        title: null,
      },
      error: null,
    });
    const { requireRole } = await import("./auth");
    const out = await requireRole(["admin", "editor", "marketing"]);
    expect(out.staff.role).toBe("editor");
  });
});

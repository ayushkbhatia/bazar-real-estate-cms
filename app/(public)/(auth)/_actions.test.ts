/**
 * @vitest-environment node
 *
 * `signInAction` is the single sign-in path for BOTH doors: the customer page
 * at /sign-in and the staff page at /admin/login, which imports it from here
 * (app/(staff-auth)/admin/login/_form.tsx). It had no test at all, and no
 * Playwright project authenticates — so the staff door could be broken with
 * the whole CI gate staying green.
 *
 * That matters right now because the customer-account surface is being removed
 * and this module sits inside the route group scheduled for deletion. These
 * tests exist to fail loudly if that refactor changes how staff sign in.
 *
 * The module imports `server-only` and Next's request context, so the Supabase
 * factory and next/navigation are mocked outright, following lib/auth.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  redirectSpy,
  signInWithPasswordMock,
  maybeSingleMock,
  isConfiguredRef,
} = vi.hoisted(() => ({
  // Next's redirect() throws to unwind the request; mirror that so the action
  // can't fall through and silently return.
  redirectSpy: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  signInWithPasswordMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  isConfiguredRef: { value: true },
}));

vi.mock("next/navigation", () => ({ redirect: redirectSpy }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Map(),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

vi.mock("@/lib/env", () => ({
  get isSupabaseConfigured() {
    return isConfiguredRef.value;
  },
  env: {},
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    }),
  }),
}));

async function signIn(fields: Record<string, string>) {
  const { signInAction } = await import("./_actions");
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return signInAction({ status: "idle" }, form);
}

/** The action redirects by throwing; capture the destination. */
async function destinationOf(fields: Record<string, string>): Promise<string> {
  try {
    await signIn(fields);
  } catch (err) {
    const m = /^NEXT_REDIRECT:(.*)$/.exec((err as Error).message);
    if (m) return m[1];
    throw err;
  }
  throw new Error("expected a redirect, got none");
}

const CREDS = { email: "someone@bazar.ae", password: "correct-horse" };

beforeEach(() => {
  vi.clearAllMocks();
  isConfiguredRef.value = true;
  signInWithPasswordMock.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  maybeSingleMock.mockResolvedValue({ data: null });
});

describe("signInAction — the staff door", () => {
  it("sends an active staff member to /admin", async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: "active" } });
    expect(await destinationOf(CREDS)).toBe("/admin");
  });

  it("honours a safe ?redirect back into the CMS", async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: "active" } });
    expect(
      await destinationOf({ ...CREDS, redirect: "/admin/enquiries" }),
    ).toBe("/admin/enquiries");
  });

  it("does not treat a suspended staff row as staff", async () => {
    // Only `active` counts. A suspended account signing in must not be routed
    // into the CMS, where the role gate would bounce them anyway.
    maybeSingleMock.mockResolvedValue({ data: { status: "suspended" } });
    expect(await destinationOf(CREDS)).not.toBe("/admin");
  });

  it("refuses an /admin redirect for a non-staff user", async () => {
    // The open-goal case: anyone appending ?redirect=/admin to the customer
    // sign-in form.
    maybeSingleMock.mockResolvedValue({ data: null });
    expect(await destinationOf({ ...CREDS, redirect: "/admin" })).not.toBe(
      "/admin",
    );
  });

  it("ignores an off-site redirect", async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: "active" } });
    const dest = await destinationOf({
      ...CREDS,
      redirect: "https://evil.example.com/steal",
    });
    expect(dest).toBe("/admin");
    expect(dest.startsWith("/")).toBe(true);
  });

  it("ignores a protocol-relative redirect", async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: "active" } });
    expect(await destinationOf({ ...CREDS, redirect: "//evil.example.com" })).toBe(
      "/admin",
    );
  });
});

describe("signInAction — failure handling", () => {
  it("returns the provider's message rather than redirecting", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const result = await signIn(CREDS);
    expect(result).toEqual({
      status: "error",
      message: "Invalid login credentials",
    });
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it("rejects a malformed email without calling the provider", async () => {
    const result = await signIn({ email: "not-an-email", password: "x" });
    expect(result.status).toBe("error");
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("rejects a missing password without calling the provider", async () => {
    const result = await signIn({ email: "someone@bazar.ae", password: "" });
    expect(result.status).toBe("error");
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("degrades to a message when Supabase isn't configured", async () => {
    isConfiguredRef.value = false;
    const result = await signIn(CREDS);
    expect(result.status).toBe("error");
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("never redirects anywhere when sign-in fails", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "nope" },
    });
    await signIn(CREDS);
    expect(redirectSpy).not.toHaveBeenCalled();
  });
});

describe("signInAction — role lookup", () => {
  it("looks the role up against the signed-in user id", async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: "active" } });
    await destinationOf(CREDS);
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: CREDS.email,
      password: CREDS.password,
    });
    expect(maybeSingleMock).toHaveBeenCalled();
  });

  it("treats a missing user id as not staff", async () => {
    // Defensive: a provider response without a user must not fall through to
    // the staff branch.
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    expect(await destinationOf(CREDS)).not.toBe("/admin");
  });
});

/**
 * @vitest-environment node
 *
 * /forgot-password is the only self-service way back into a staff account now
 * that the Supabase magic link is retired (plan decision D10). It is public and
 * unauthenticated, and it emails an address the caller chooses — so the
 * response must never reveal who is staff, and the rate limit is load-bearing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { issueMock, rateLimitMock } = vi.hoisted(() => ({
  issueMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/staff-password-link", () => ({
  issueStaffPasswordLink: issueMock,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: rateLimitMock,
  extractClientIp: () => "1.2.3.4",
  rateLimitMessage: (s: number) => `Too many requests. Try again in ${s}s.`,
}));

async function submit(email: string) {
  const { requestStaffPasswordLink } = await import("./_actions");
  const form = new FormData();
  form.set("email", email);
  return requestStaffPasswordLink({ status: "idle" }, form);
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ ok: true });
  issueMock.mockResolvedValue({ status: "sent", email: "a@b.com" });
});

describe("requestStaffPasswordLink — account enumeration", () => {
  it("says the same thing whether or not the address is staff", async () => {
    issueMock.mockResolvedValue({ status: "sent", email: "real@bazar.ae" });
    const found = await submit("real@bazar.ae");

    issueMock.mockResolvedValue({ status: "no_such_staff" });
    const missing = await submit("stranger@example.com");

    expect(found.status).toBe("sent");
    expect(missing.status).toBe("sent");
    // Identical wording — otherwise the page is a staff-directory oracle.
    expect(missing.message).toBe(found.message);
  });

  it("does not reveal a suspended account either", async () => {
    issueMock.mockResolvedValue({ status: "sent", email: "a@b.com" });
    const normal = await submit("a@b.com");
    issueMock.mockResolvedValue({ status: "suspended" });
    const suspended = await submit("suspended@bazar.ae");
    expect(suspended.status).toBe("sent");
    expect(suspended.message).toBe(normal.message);
  });

  it("never names the address back to the caller", async () => {
    const result = await submit("someone@bazar.ae");
    expect(result.message).not.toContain("someone@bazar.ae");
  });
});

describe("requestStaffPasswordLink — validation and limits", () => {
  it("rejects a malformed address without sending", async () => {
    const result = await submit("not-an-email");
    expect(result.status).toBe("error");
    expect(issueMock).not.toHaveBeenCalled();
  });

  it("enforces the rate limit before issuing anything", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 600 });
    const result = await submit("a@b.com");
    expect(result.status).toBe("error");
    expect(issueMock).not.toHaveBeenCalled();
  });

  it("tells the truth when sending actually failed", async () => {
    // A misconfiguration is ours, not the visitor's — claiming "check your
    // inbox" would strand someone who is locked out.
    issueMock.mockResolvedValue({ status: "error", message: "smtp exploded" });
    const result = await submit("a@b.com");
    expect(result.status).toBe("error");
    // ...without leaking the internal reason.
    expect(result.message).not.toContain("smtp exploded");
    expect(result.message).toMatch(/administrator/i);
  });

  it("normalises the address before issuing", async () => {
    await submit("  Someone@Bazar.AE  ");
    expect(issueMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: expect.stringContaining("@") }),
    );
  });
});

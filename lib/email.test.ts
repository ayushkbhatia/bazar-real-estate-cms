/**
 * @vitest-environment node
 *
 * lib/env.ts guards server-only env access with `typeof window === "undefined"`.
 * In the default jsdom environment, `window` is defined, so serverEnv falls
 * back to the no-op shape and RESEND_API_KEY is never read. Pin this file
 * to the node environment so the real env-loading code path runs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * sendEmail's from + replyTo chain:
 *   from    = input.from  ?? env.RESEND_FROM_ADDRESS ?? DEFAULT_FROM
 *   replyTo = input.replyTo ?? env.RESEND_REPLY_TO   ?? DEFAULT_REPLY_TO
 *
 * This test pins that contract by mocking the Resend SDK and asserting on
 * what we hand it. No real network call; the in-module client cache is
 * reset by `vi.resetModules()` between cases.
 */

// vi.hoisted runs before vi.mock factories, which themselves run before
// the top-level test imports. Lets the spy be referenced from both the
// mock factory and the test bodies.
const { sendSpy } = vi.hoisted(() => ({ sendSpy: vi.fn() }));

vi.mock("resend", () => ({
  // `new Resend(apiKey)` in email.ts — needs a real constructor, not an
  // arrow function. Bind sendSpy onto the instance.
  Resend: class {
    emails = { send: sendSpy };
  },
}));

const DEFAULT_FROM = "Bazar Real Estate <onboarding@resend.dev>";
const DEFAULT_REPLY_TO = "hello@bazar.ae";

beforeEach(() => {
  sendSpy.mockReset();
  sendSpy.mockResolvedValue({ data: { id: "msg_123" }, error: null });
  // RESEND_API_KEY needs to be set or isResendConfigured stays false and
  // sendEmail returns { status: "skipped" } before reaching the SDK.
  vi.stubEnv("RESEND_API_KEY", "test-key");
  // Delivery is blocked outside production by default, so these specs — which
  // exist to exercise the real send path — have to opt in, exactly as a
  // developer testing a live send from their machine would.
  vi.stubEnv("EMAIL_DRY_RUN", "false");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function importEmail() {
  vi.resetModules();
  return import("./email");
}

describe("sendEmail · from + reply-to env chain", () => {
  it("uses RESEND_FROM_ADDRESS + RESEND_REPLY_TO when no overrides are given", async () => {
    vi.stubEnv("RESEND_FROM_ADDRESS", "hello@bazar.ae");
    vi.stubEnv("RESEND_REPLY_TO", "advisor@bazar.ae");
    const { sendEmail } = await importEmail();

    const result = await sendEmail({
      to: "owner@example.com",
      subject: "Test",
      text: "plain",
      html: "<b>html</b>",
    });
    expect(result.status).toBe("ok");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const args = sendSpy.mock.calls[0][0];
    expect(args.from).toBe("hello@bazar.ae");
    expect(args.replyTo).toBe("advisor@bazar.ae");
  });

  it("falls back to DEFAULT_FROM + DEFAULT_REPLY_TO when env vars are unset", async () => {
    // `vi.stubEnv(_, "")` would fail the schema's `z.string().email()` check
    // — RESEND_*_ADDRESS / RESEND_REPLY_TO are optional, not allow-empty.
    delete process.env.RESEND_FROM_ADDRESS;
    delete process.env.RESEND_REPLY_TO;
    const { sendEmail } = await importEmail();

    await sendEmail({
      to: "owner@example.com",
      subject: "Test",
      text: "plain",
      html: "<b>html</b>",
    });
    const args = sendSpy.mock.calls[0][0];
    expect(args.from).toBe(DEFAULT_FROM);
    expect(args.replyTo).toBe(DEFAULT_REPLY_TO);
  });

  it("input overrides take precedence over env (per-call from/replyTo)", async () => {
    vi.stubEnv("RESEND_FROM_ADDRESS", "hello@bazar.ae");
    vi.stubEnv("RESEND_REPLY_TO", "advisor@bazar.ae");
    const { sendEmail } = await importEmail();

    await sendEmail({
      to: "owner@example.com",
      subject: "Test",
      text: "plain",
      html: "<b>html</b>",
      from: "newsletter@bazar.ae",
      replyTo: "no-reply@bazar.ae",
    });
    const args = sendSpy.mock.calls[0][0];
    expect(args.from).toBe("newsletter@bazar.ae");
    expect(args.replyTo).toBe("no-reply@bazar.ae");
  });

  it("env replyTo wins when only the per-call from is overridden", async () => {
    vi.stubEnv("RESEND_FROM_ADDRESS", "hello@bazar.ae");
    vi.stubEnv("RESEND_REPLY_TO", "advisor@bazar.ae");
    const { sendEmail } = await importEmail();

    await sendEmail({
      to: "owner@example.com",
      subject: "Test",
      text: "plain",
      html: "<b>html</b>",
      from: "newsletter@bazar.ae",
    });
    const args = sendSpy.mock.calls[0][0];
    expect(args.from).toBe("newsletter@bazar.ae");
    expect(args.replyTo).toBe("advisor@bazar.ae");
  });

  it("returns { status: 'skipped' } and never calls Resend when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await importEmail();

    const result = await sendEmail({
      to: "owner@example.com",
      subject: "Test",
      text: "plain",
      html: "<b>html</b>",
    });
    expect(result.status).toBe("skipped");
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe("explainResendError", () => {
  it("explains the owner-only restriction, which is the common failure", async () => {
    const { explainResendError } = await import("./email");
    const out = explainResendError(
      "You can only send testing emails to your own email address",
    );
    expect(out).toMatch(/verified sending domain/i);
    expect(out).toMatch(/RESEND_FROM_ADDRESS/);
  });

  it("explains an unverified from-domain", async () => {
    const { explainResendError } = await import("./email");
    expect(explainResendError("The domain is not verified")).toMatch(
      /verify the sending domain/i,
    );
  });

  it("keeps the original message so nothing is hidden", async () => {
    const { explainResendError } = await import("./email");
    const original = "Rate limit exceeded";
    expect(explainResendError(original)).toContain(original);
  });
});

describe("sendEmail · the dry-run guard", () => {
  it("blocks delivery outside production by default", async () => {
    // The accident this exists for: .env.local holds a live Resend key AND
    // points at the production database, so a cron curled from a laptop sent
    // a real digest to all three admins.
    vi.stubEnv("EMAIL_DRY_RUN", "");
    vi.stubEnv("NODE_ENV", "development");
    const { sendEmail } = await importEmail();

    const result = await sendEmail({
      to: "owner@example.com",
      subject: "Should not arrive",
      text: "x",
      html: "<p>x</p>",
    });

    expect(result.status).toBe("skipped");
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("says why, so a missing email is not mistaken for a bug", async () => {
    vi.stubEnv("EMAIL_DRY_RUN", "");
    vi.stubEnv("NODE_ENV", "development");
    const { sendEmail } = await importEmail();
    const result = await sendEmail({
      to: "a@b.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    });
    expect(result.status === "skipped" && result.reason).toContain(
      "EMAIL_DRY_RUN=false",
    );
  });

  it("sends in production without anything being set", async () => {
    vi.stubEnv("EMAIL_DRY_RUN", "");
    vi.stubEnv("NODE_ENV", "production");
    const { sendEmail } = await importEmail();
    const result = await sendEmail({
      to: "a@b.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    });
    expect(result.status).toBe("ok");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("can be forced on in production, for an incident", async () => {
    vi.stubEnv("EMAIL_DRY_RUN", "1");
    vi.stubEnv("NODE_ENV", "production");
    const { sendEmail } = await importEmail();
    const result = await sendEmail({
      to: "a@b.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    });
    expect(result.status).toBe("skipped");
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

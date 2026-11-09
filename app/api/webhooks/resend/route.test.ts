/**
 * @vitest-environment node
 *
 * The Resend webhook belongs to the account, and the account also sends for
 * Indus Hydraulics, so Indus's events arrive here. A permanent bounce is acted
 * on by address: before the sender check, an Indus bounce for someone who is
 * also a Bazar subscriber marked them bounced and suppressed them. These sign
 * real payloads and check what reaches the database.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const KEY = Buffer.from("a-test-signing-key-of-some-length");

const { rpc, envMock } = vi.hoisted(() => ({
  rpc: vi.fn(),
  envMock: {
    RESEND_WEBHOOK_SECRET: "",
    RESEND_FROM_ADDRESS: "hello@bazarrealestate.com" as string | undefined,
  },
}));

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { POST } from "./route";

envMock.RESEND_WEBHOOK_SECRET = `whsec_${KEY.toString("base64")}`;

function signedRequest(payload: unknown): NextRequest {
  const body = JSON.stringify(payload);
  const id = "msg_1";
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = `v1,${createHmac("sha256", KEY).update(`${id}.${ts}.${body}`).digest("base64")}`;
  return new NextRequest("http://localhost/api/webhooks/resend", {
    method: "POST",
    body,
    headers: {
      "svix-id": id,
      "svix-timestamp": ts,
      "svix-signature": signature,
    },
  });
}

function bounce(from: string | undefined) {
  return {
    type: "email.bounced",
    created_at: "2026-11-09T12:00:00.000Z",
    data: {
      email_id: "re_1",
      ...(from === undefined ? {} : { from }),
      to: ["subscriber@example.com"],
      bounce: { type: "Permanent", subType: "General", message: "" },
    },
  };
}

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "subscriber", error: null });
    envMock.RESEND_FROM_ADDRESS = "hello@bazarrealestate.com";
  });

  it("writes nothing for another site's bounce, and answers 200", async () => {
    for (const from of [
      "Indus Hydraulics <newsletter@news.indushydraulics.com>",
      "info@indushydraulics.com",
    ]) {
      const res = await POST(signedRequest(bounce(from)));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, ignored: "other-sender" });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records Bazar's own bounce", async () => {
    const res = await POST(
      signedRequest(bounce("Marketing at Bazar <marketing@bazarrealestate.com>")),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "newsletter_record_email_event",
      expect.objectContaining({ p_email_id: "re_1", p_permanent: true }),
    );
  });

  it("records a bounce with no From rather than lose it", async () => {
    const res = await POST(signedRequest(bounce(undefined)));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("accepts the configured sender's domain when it is a new one", async () => {
    envMock.RESEND_FROM_ADDRESS = "Bazar <hello@bazar.ae>";
    await POST(signedRequest(bounce("hello@bazar.ae")));
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

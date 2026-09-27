/**
 * @vitest-environment node
 *
 * A lead's acknowledgement is stamped on its row only when it went out. The
 * stamp is what keeps /api/cron/enquiry-auto-reply from sending the same email
 * a second time; its absence is what lets the sweep retry one that failed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SendEmailResult } from "@/lib/email";

type Filter = [op: "eq" | "is", column: string, value: unknown];
type UpdateCall = {
  table: string;
  payload: Record<string, unknown>;
  filters: Filter[];
};

const { sendEmailMock, reportErrorMock, admin } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  reportErrorMock: vi.fn(async () => {}),
  admin: {
    /** What `createAdminClient()` returns — null means no service-role key. */
    client: null as unknown,
    updates: [] as UpdateCall[],
    /** What the stamp's UPDATE resolves to. */
    result: { error: null } as { error: unknown },
  },
}));

vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/lib/observability", () => ({ reportError: reportErrorMock }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => admin.client,
}));

/** Records `from(t).update(p).eq(…).is(…)` and resolves to `admin.result`. */
const recordingClient = {
  from(table: string) {
    return {
      update(payload: Record<string, unknown>) {
        const call: UpdateCall = { table, payload, filters: [] };
        admin.updates.push(call);
        const chain = {
          eq(column: string, value: unknown) {
            call.filters.push(["eq", column, value]);
            return chain;
          },
          is(column: string, value: unknown) {
            call.filters.push(["is", column, value]);
            return chain;
          },
          then<T>(resolve: (v: { error: unknown }) => T) {
            return Promise.resolve(admin.result).then(resolve);
          },
        };
        return chain;
      },
    };
  },
};

import { sendEnquiryAcknowledgement } from "./enquiry-acknowledgement";

const EMAIL = {
  to: "layla@example.com",
  subject: "We have your enquiry",
  text: "Thank you — an advisor will be in touch.",
  html: "<p>Thank you — an advisor will be in touch.</p>",
};

function sendReturns(result: SendEmailResult) {
  sendEmailMock.mockResolvedValue(result);
}

beforeEach(() => {
  sendEmailMock.mockReset();
  reportErrorMock.mockClear();
  admin.client = recordingClient;
  admin.updates = [];
  admin.result = { error: null };
});

describe("sendEnquiryAcknowledgement", () => {
  it("sends the email it was given, unchanged", async () => {
    sendReturns({ status: "ok", id: "re_1" });
    await sendEnquiryAcknowledgement("enq-1", EMAIL);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(EMAIL);
  });

  it("stamps ack_sent_at on that lead once the send is ok", async () => {
    sendReturns({ status: "ok", id: "re_1" });
    await sendEnquiryAcknowledgement("enq-1", EMAIL);

    expect(admin.updates).toHaveLength(1);
    const [stamp] = admin.updates;
    expect(stamp.table).toBe("enquiries");
    expect(Object.keys(stamp.payload)).toEqual(["ack_sent_at"]);
    expect(new Date(String(stamp.payload.ack_sent_at)).toISOString()).toBe(
      stamp.payload.ack_sent_at,
    );
    expect(stamp.filters).toContainEqual(["eq", "id", "enq-1"]);
  });

  it("never overwrites an acknowledgement already recorded", async () => {
    // The sweep can only have got there first in a race; if it did, its time
    // is the one the email actually went out at.
    sendReturns({ status: "ok", id: "re_1" });
    await sendEnquiryAcknowledgement("enq-1", EMAIL);
    expect(admin.updates[0].filters).toContainEqual([
      "is",
      "ack_sent_at",
      null,
    ]);
  });

  it.each<[string, SendEmailResult]>([
    ["errored", { status: "error", message: "Resend is down" }],
    ["was skipped", { status: "skipped", reason: "RESEND_API_KEY not set" }],
  ])(
    "leaves the lead unstamped when the send %s, so the sweep retries it",
    async (_label, result) => {
      sendReturns(result);
      await sendEnquiryAcknowledgement("enq-1", EMAIL);
      expect(admin.updates).toEqual([]);
    },
  );

  it("hands back the send's own result", async () => {
    sendReturns({ status: "ok", id: "re_42" });
    await expect(sendEnquiryAcknowledgement("enq-1", EMAIL)).resolves.toEqual({
      status: "ok",
      id: "re_42",
    });
    sendReturns({ status: "error", message: "nope" });
    await expect(sendEnquiryAcknowledgement("enq-1", EMAIL)).resolves.toEqual({
      status: "error",
      message: "nope",
    });
  });

  it("reports a stamp the database refused, and does not throw", async () => {
    // The lead is saved and the email has gone: a failed write must not turn
    // into an error screen for the visitor.
    sendReturns({ status: "ok", id: "re_1" });
    admin.result = { error: { message: "permission denied for table enquiries" } };

    await expect(sendEnquiryAcknowledgement("enq-1", EMAIL)).resolves.toEqual({
      status: "ok",
      id: "re_1",
    });
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(reportErrorMock).toHaveBeenCalledWith(
      { message: "permission denied for table enquiries" },
      expect.objectContaining({
        source: "enquiry-acknowledgement/stamp",
        context: { enquiryId: "enq-1" },
      }),
    );
  });

  it("reports a client that throws, and does not throw", async () => {
    sendReturns({ status: "ok", id: "re_1" });
    admin.client = {
      from() {
        throw new Error("fetch failed");
      },
    };
    await expect(
      sendEnquiryAcknowledgement("enq-1", EMAIL),
    ).resolves.toMatchObject({ status: "ok" });
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
  });

  it("sends without stamping when there is no service-role key", async () => {
    // No key, no sweep either — it needs the same one — so nothing to keep
    // away, and nothing worth reporting.
    sendReturns({ status: "ok", id: "re_1" });
    admin.client = null;
    await expect(
      sendEnquiryAcknowledgement("enq-1", EMAIL),
    ).resolves.toMatchObject({ status: "ok" });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(reportErrorMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendEmailBatch: vi.fn(), lookup: vi.fn() }));

vi.mock("@/lib/email", () => ({
  EMAIL_BATCH_LIMIT: 100,
  sendEmailBatch: mocks.sendEmailBatch,
}));
vi.mock("@/lib/content-assets/system-resolve", () => ({ readEmailBrand: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
vi.mock("./sender-read", () => ({ readNewsletterSender: vi.fn() }));
// Featured records: whatever each test says the catalogue answers.
vi.mock("./features", () => ({
  newsletterFeatures: async () => ({ lookup: { get: mocks.lookup }, labels: undefined }),
  featureDrawer: () => () => ({ html: "<table>CARD</table>", text: "CARD" }),
}));

import { DEFAULT_EMAIL_BRAND } from "@/lib/content-assets/email-brand";
import { MAX_ATTEMPTS, emailHash, sendClaimed } from "./send";

type Patch = { id: string; patch: Record<string, unknown> };

/** Just enough of the Supabase client for one batch: two reads and per-row updates. */
function fakeDb(rows: { campaigns: object[]; subscribers: object[]; contacts?: object[]; suppressed?: string[] }) {
  const updates: Patch[] = [];
  const tables: Record<string, object[]> = {
    newsletter_campaigns: rows.campaigns,
    newsletter_subscribers: rows.subscribers,
    newsletter_list_contacts: rows.contacts ?? [],
    newsletter_suppressions: (rows.suppressed ?? []).map((email) => ({ email_hash: emailHash(email) })),
  };
  const client = {
    from(table: string) {
      return {
        select: () => ({
          in: async () => ({ data: tables[table] ?? [], error: null }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            updates.push({ id, patch });
            return { error: null };
          },
        }),
      };
    },
  };
  return { client: client as never, updates };
}

const campaign = {
  id: "c1",
  subject: "October",
  preheader: "",
  body: "<p>Hello</p>",
  subject_ar: "أكتوبر",
  preheader_ar: "",
  body_ar: "<p>مرحباً</p>",
};
const subscribers = [
  { id: "s1", email: "a@example.com", status: "confirmed", unsubscribe_token: "t1" },
  { id: "s2", email: "b@example.com", status: "confirmed", unsubscribe_token: "t2" },
  { id: "s3", email: "c@example.com", status: "unsubscribed", unsubscribe_token: "t3" },
];
const claimed = (attempts = 1) => [
  { id: "d1", campaign_id: "c1", subscriber_id: "s1", locale: "en", attempts },
  { id: "d2", campaign_id: "c1", subscriber_id: "s2", locale: "ar", attempts },
  { id: "d3", campaign_id: "c1", subscriber_id: "s3", locale: "en", attempts },
];

describe("sendClaimed", () => {
  beforeEach(() => {
    mocks.sendEmailBatch.mockReset();
    mocks.lookup.mockReset();
  });

  it("mails a custom list's contact with the list footer and their own unsubscribe link, and skips suppressed or removed addresses", async () => {
    mocks.sendEmailBatch.mockResolvedValue({ status: "ok", ids: ["r1"] });
    const contacts = [
      { id: "k1", email: "guest@example.com", status: "active", unsubscribe_token: "kt1" },
      { id: "k2", email: "gone@example.com", status: "unsubscribed", unsubscribe_token: "kt2" },
      { id: "k3", email: "a@example.com", status: "active", unsubscribe_token: "kt3" },
    ];
    const { client, updates } = fakeDb({ campaigns: [campaign], subscribers: [], contacts, suppressed: ["A@example.com"] });
    const report = await sendClaimed(client, [
      { id: "d1", campaign_id: "c1", subscriber_id: null, contact_id: "k1", locale: "en", attempts: 1 },
      { id: "d2", campaign_id: "c1", subscriber_id: null, contact_id: "k2", locale: "en", attempts: 1 },
      { id: "d3", campaign_id: "c1", subscriber_id: null, contact_id: "k3", locale: "en", attempts: 1 },
    ], DEFAULT_EMAIL_BRAND);
    expect(report).toMatchObject({ sent: 1, skipped: 2 });
    const [sent] = mocks.sendEmailBatch.mock.calls[0]![0];
    expect(sent.to).toBe("guest@example.com");
    expect(sent.html).toContain("mailing list");
    expect(sent.html).toContain("/newsletter/unsubscribe/kt1");
    expect(sent.headers["List-Unsubscribe"]).toContain("token=kt1");
    expect(updates.filter((u) => u.patch.status === "skipped").map((u) => u.id).sort()).toEqual(["d2", "d3"]);
  });

  it("skips a confirmed subscriber whose address was suppressed on a list since the snapshot", async () => {
    mocks.sendEmailBatch.mockResolvedValue({ status: "ok", ids: ["r2"] });
    const { client } = fakeDb({ campaigns: [campaign], subscribers, suppressed: ["a@example.com"] });
    const report = await sendClaimed(client, claimed(), DEFAULT_EMAIL_BRAND);
    expect(report).toMatchObject({ sent: 1, skipped: 2 });
    expect(mocks.sendEmailBatch.mock.calls[0]![0].map((i: { to: string }) => i.to)).toEqual(["b@example.com"]);
  });

  it("sends from the newsletter's own sender when given one, and the env's otherwise", async () => {
    mocks.sendEmailBatch.mockResolvedValue({ status: "ok", ids: ["r1", "r2"] });
    const sender = { from: "Marketing at Bazar Real Estate <marketing@bazarrealestate.com>", replyTo: "marketing@bazarrealestate.ae" };
    await sendClaimed(fakeDb({ campaigns: [campaign], subscribers }).client, claimed(), DEFAULT_EMAIL_BRAND, sender);
    for (const input of mocks.sendEmailBatch.mock.calls[0]![0]) {
      expect(input).toMatchObject({ from: sender.from, replyTo: sender.replyTo });
    }
    mocks.sendEmailBatch.mockClear();
    await sendClaimed(fakeDb({ campaigns: [campaign], subscribers }).client, claimed(), DEFAULT_EMAIL_BRAND);
    expect(mocks.sendEmailBatch.mock.calls[0]![0][0]).not.toHaveProperty("from");
  });

  it("sends one batch, each in the recipient's language with their own unsubscribe link, and skips anyone who left", async () => {
    mocks.sendEmailBatch.mockResolvedValue({ status: "ok", ids: ["r1", "r2"] });
    const { client, updates } = fakeDb({ campaigns: [campaign], subscribers });
    const report = await sendClaimed(client, claimed(), DEFAULT_EMAIL_BRAND);

    expect(report).toEqual({ sent: 2, skipped: 1, failed: 0, retried: 0 });
    const [inputs, opts] = mocks.sendEmailBatch.mock.calls[0]!;
    expect(inputs.map((i: { to: string }) => i.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(inputs[0].subject).toBe("October");
    expect(inputs[1].subject).toBe("أكتوبر");
    expect(inputs[0].html).toContain("/newsletter/unsubscribe/t1");
    expect(inputs[1].html).toContain("/ar/newsletter/unsubscribe/t2");
    expect(inputs[0].headers["List-Unsubscribe"]).toContain("token=t1");
    expect(opts.idempotencyKey).toMatch(/^newsletter-[0-9a-f]{40}$/);

    expect(updates.find((u) => u.id === "d3")!.patch.status).toBe("skipped");
    expect(updates.find((u) => u.id === "d1")!.patch).toMatchObject({ status: "sent", resend_id: "r1" });
    expect(updates.find((u) => u.id === "d2")!.patch).toMatchObject({ status: "sent", resend_id: "r2" });
  });

  it("puts a refused batch back in the queue, and fails it after the last attempt", async () => {
    mocks.sendEmailBatch.mockResolvedValue({ status: "error", message: "rate limited" });
    const first = fakeDb({ campaigns: [campaign], subscribers });
    const retry = await sendClaimed(first.client, claimed(1), DEFAULT_EMAIL_BRAND);
    expect(retry).toMatchObject({ sent: 0, retried: 2, failed: 0 });
    expect(first.updates.find((u) => u.id === "d1")!.patch.status).toBe("queued");

    const last = fakeDb({ campaigns: [campaign], subscribers });
    const failed = await sendClaimed(last.client, claimed(MAX_ATTEMPTS), DEFAULT_EMAIL_BRAND);
    expect(failed).toMatchObject({ failed: 2, retried: 0 });
    expect(last.updates.find((u) => u.id === "d2")!.patch).toMatchObject({ status: "failed", error: "rate limited" });
  });

  it("marks a dry run skipped rather than sent", async () => {
    mocks.sendEmailBatch.mockResolvedValue({ status: "skipped", reason: "dry run" });
    const { client, updates } = fakeDb({ campaigns: [campaign], subscribers });
    const report = await sendClaimed(client, claimed(), DEFAULT_EMAIL_BRAND);
    expect(report).toMatchObject({ sent: 0, skipped: 3 });
    expect(updates.every((u) => u.patch.status === "skipped")).toBe(true);
  });

  it("does nothing for an empty claim", async () => {
    const { client } = fakeDb({ campaigns: [], subscribers: [] });
    expect(await sendClaimed(client, [], DEFAULT_EMAIL_BRAND)).toEqual({ sent: 0, skipped: 0, failed: 0, retried: 0 });
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });

  const featured = {
    ...campaign,
    body: '<p>Hi</p><div data-email-feature="property" data-ids="11111111-0000-0000-0000-000000000001" data-layout="card" data-labels="[]"></div>',
  };

  it("draws featured blocks into each email", async () => {
    mocks.lookup.mockReturnValue({ kind: "property" });
    mocks.sendEmailBatch.mockResolvedValue({ status: "ok", ids: ["r1", "r2"] });
    const { client } = fakeDb({ campaigns: [featured], subscribers });
    await sendClaimed(client, claimed(), DEFAULT_EMAIL_BRAND);
    expect(mocks.sendEmailBatch.mock.calls[0]![0][0].html).toContain("<table>CARD</table>");
  });

  it("requeues rather than sends when the featured records couldn't be looked up", async () => {
    mocks.lookup.mockReturnValue(undefined);
    mocks.sendEmailBatch.mockResolvedValue({ status: "ok", ids: ["r2"] });
    const { client, updates } = fakeDb({ campaigns: [featured], subscribers });
    const report = await sendClaimed(client, claimed(), DEFAULT_EMAIL_BRAND);
    // d1 (English, featured body) waits; d2 gets the Arabic edition, which features nothing.
    expect(report).toMatchObject({ sent: 1, retried: 1 });
    expect(updates.find((u) => u.id === "d1")!.patch).toMatchObject({ status: "queued" });

    const last = fakeDb({ campaigns: [featured], subscribers });
    await sendClaimed(last.client, claimed(MAX_ATTEMPTS), DEFAULT_EMAIL_BRAND);
    expect(last.updates.find((u) => u.id === "d1")!.patch).toMatchObject({ status: "failed" });
  });
});

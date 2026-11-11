import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseEmailEvent,
  SIGNATURE_TOLERANCE_S,
  verifyResendSignature,
} from "./events";
import { isOwnSender, ownSenderDomains, SENDER_DOMAINS } from "./sender";

const KEY = Buffer.from("a-test-signing-key-of-some-length");
const SECRET = `whsec_${KEY.toString("base64")}`;
const NOW = new Date("2026-10-19T12:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));

function sign(body: string, id = "msg_1", ts = TS, key = KEY) {
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

describe("verifyResendSignature", () => {
  const body = '{"type":"email.delivered"}';

  it("accepts a body signed with the secret", () => {
    expect(
      verifyResendSignature(
        body,
        { id: "msg_1", timestamp: TS, signature: sign(body) },
        SECRET,
        NOW,
      ),
    ).toBe(true);
  });

  it("accepts any matching entry while a secret is being rotated", () => {
    const other = sign(body, "msg_1", TS, Buffer.from("the-old-key"));
    const header = `${other} ${sign(body)}`;
    expect(
      verifyResendSignature(
        body,
        { id: "msg_1", timestamp: TS, signature: header },
        SECRET,
        NOW,
      ),
    ).toBe(true);
  });

  it("refuses a tampered body, another message id, or a wrong key", () => {
    const signature = sign(body);
    expect(
      verifyResendSignature(
        `${body} `,
        { id: "msg_1", timestamp: TS, signature },
        SECRET,
        NOW,
      ),
    ).toBe(false);
    expect(
      verifyResendSignature(
        body,
        { id: "msg_2", timestamp: TS, signature },
        SECRET,
        NOW,
      ),
    ).toBe(false);
    const wrong = `whsec_${Buffer.from("not-the-key").toString("base64")}`;
    expect(
      verifyResendSignature(
        body,
        { id: "msg_1", timestamp: TS, signature },
        wrong,
        NOW,
      ),
    ).toBe(false);
  });

  it("refuses a replay outside the tolerance", () => {
    const old = String(Number(TS) - SIGNATURE_TOLERANCE_S - 1);
    expect(
      verifyResendSignature(
        body,
        { id: "msg_1", timestamp: old, signature: sign(body, "msg_1", old) },
        SECRET,
        NOW,
      ),
    ).toBe(false);
  });

  it("refuses missing headers and non-v1 entries", () => {
    const value = sign(body).slice(3);
    expect(
      verifyResendSignature(
        body,
        { id: null, timestamp: TS, signature: sign(body) },
        SECRET,
        NOW,
      ),
    ).toBe(false);
    expect(
      verifyResendSignature(
        body,
        { id: "msg_1", timestamp: TS, signature: `v2,${value}` },
        SECRET,
        NOW,
      ),
    ).toBe(false);
    expect(
      verifyResendSignature(
        body,
        { id: "msg_1", timestamp: TS, signature: sign(body) },
        "",
        NOW,
      ),
    ).toBe(false);
  });
});

describe("parseEmailEvent", () => {
  const base = {
    created_at: "2026-10-19T12:00:01.000Z",
    data: {
      email_id: "re_1",
      from: "Bazar Real Estate <hello@bazarrealestate.com>",
      to: ["a@example.com"],
    },
  };

  it("maps the three events it acts on", () => {
    expect(parseEmailEvent({ ...base, type: "email.delivered" })).toEqual({
      type: "delivered",
      emailId: "re_1",
      recipients: ["a@example.com"],
      permanent: false,
      at: "2026-10-19T12:00:01.000Z",
      senderDomain: "bazarrealestate.com",
    });
    expect(parseEmailEvent({ ...base, type: "email.complained" })?.type).toBe(
      "complained",
    );
  });

  it("reads whether a bounce was permanent", () => {
    const bounce = (type: string) =>
      parseEmailEvent({
        ...base,
        type: "email.bounced",
        data: { ...base.data, bounce: { type, subType: "", message: "" } },
      });
    expect(bounce("Permanent")?.permanent).toBe(true);
    expect(bounce("Transient")?.permanent).toBe(false);
    expect(bounce("Undetermined")?.permanent).toBe(false);
  });

  it("ignores other events and payloads without a message id", () => {
    expect(parseEmailEvent({ ...base, type: "email.opened" })).toBeNull();
    expect(parseEmailEvent({ ...base, type: "domain.updated" })).toBeNull();
    expect(parseEmailEvent({ type: "email.delivered", data: {} })).toBeNull();
    expect(parseEmailEvent(null)).toBeNull();
  });
});

describe("the sender's domain", () => {
  const event = (from: unknown) =>
    parseEmailEvent({
      type: "email.bounced",
      created_at: "2026-11-09T12:00:00.000Z",
      data: { email_id: "re_1", from, to: ["a@example.com"] },
    })?.senderDomain;

  it("reads a bare From and a display-name From, lower-cased", () => {
    expect(event("hello@bazarrealestate.com")).toBe("bazarrealestate.com");
    expect(event("Marketing at Bazar <Marketing@BazarRealEstate.COM>")).toBe(
      "bazarrealestate.com",
    );
    expect(event('"Indus, Hydraulics" <newsletter@news.indushydraulics.com>')).toBe(
      "news.indushydraulics.com",
    );
  });

  it("is null when there is no readable From", () => {
    expect(event(undefined)).toBeNull();
    expect(event("")).toBeNull();
    expect(event("Bazar Real Estate")).toBeNull();
    expect(event(42)).toBeNull();
  });
});

describe("isOwnSender", () => {
  it("matches the apex and its subdomains", () => {
    expect(isOwnSender("example.com", "example.com")).toBe(true);
    expect(isOwnSender("news.example.com", "example.com")).toBe(true);
    expect(isOwnSender("NEWS.Example.com", "example.com")).toBe(true);
  });

  it("refuses a look-alike and another site", () => {
    expect(isOwnSender("evilexample.com", "example.com")).toBe(false);
    expect(isOwnSender("example.com.evil.net", "example.com")).toBe(false);
    expect(isOwnSender("indushydraulics.com", SENDER_DOMAINS)).toBe(false);
    expect(isOwnSender("news.indushydraulics.com", SENDER_DOMAINS)).toBe(false);
  });

  it("counts a missing From as ours", () => {
    expect(isOwnSender(null, "example.com")).toBe(true);
    expect(isOwnSender(null, SENDER_DOMAINS)).toBe(true);
  });

  it("accepts every domain Bazar sends from", () => {
    expect(isOwnSender("bazarrealestate.com", SENDER_DOMAINS)).toBe(true);
    expect(isOwnSender("bazarrealestate.ae", SENDER_DOMAINS)).toBe(true);
    expect(isOwnSender("mail.bazarrealestate.com", SENDER_DOMAINS)).toBe(true);
  });

  it("adds the configured From's domain to the list", () => {
    expect(ownSenderDomains("Bazar <hello@bazar.ae>")).toEqual([
      ...SENDER_DOMAINS,
      "bazar.ae",
    ]);
    expect(ownSenderDomains("hello@bazarrealestate.com")).toEqual([
      ...SENDER_DOMAINS,
    ]);
    expect(ownSenderDomains(undefined)).toEqual([...SENDER_DOMAINS]);
  });
});

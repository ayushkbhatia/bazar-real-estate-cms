import { describe, expect, it } from "vitest";
import {
  classifyRawSubmission,
  classifySubmission,
  HONEYPOT_FIELD,
  MIN_FILL_MS,
  RENDERED_AT_FIELD,
  withoutSpamControls,
} from "./spam";

const NOW = 1_700_000_000_000;

describe("classifySubmission", () => {
  it("passes a submission that leaves the honeypot alone", () => {
    expect(
      classifySubmission({
        honeypot: "",
        renderedAt: NOW - 30_000,
        now: NOW,
      }),
    ).toEqual({ spam: false });
  });

  it("catches anything that fills the honeypot", () => {
    expect(
      classifySubmission({ honeypot: "https://example.com", now: NOW }),
    ).toEqual({ spam: true, reason: "honeypot" });
  });

  it("treats whitespace in the honeypot as untouched", () => {
    // A field a bot skipped and a field a browser padded look the same from
    // here, and only one of them is worth rejecting a lead over.
    expect(classifySubmission({ honeypot: "   ", now: NOW })).toEqual({
      spam: false,
    });
  });

  it("catches a form returned faster than a person could fill it", () => {
    expect(
      classifySubmission({
        renderedAt: NOW - (MIN_FILL_MS - 1),
        now: NOW,
      }),
    ).toEqual({ spam: true, reason: "too-fast" });
  });

  it("allows a submission exactly at the floor", () => {
    expect(
      classifySubmission({ renderedAt: NOW - MIN_FILL_MS, now: NOW }),
    ).toEqual({ spam: false });
  });

  it("reports the honeypot first when a submission trips both", () => {
    // The reason is a breadcrumb, so it should name the signal we trust, not
    // whichever check happened to run first.
    expect(
      classifySubmission({
        honeypot: "x",
        renderedAt: NOW - 1,
        now: NOW,
      }),
    ).toEqual({ spam: true, reason: "honeypot" });
  });

  describe("absence is never evidence", () => {
    // Every one of these is a real way for an honest visitor to arrive:
    // JavaScript that has not run, a stripped input, a proxy that drops
    // unknown fields. None may cost them their enquiry.
    it.each([
      ["nothing at all", {}],
      ["no timestamp", { honeypot: "" }],
      ["an empty timestamp", { renderedAt: "" }],
      ["an unparseable timestamp", { renderedAt: "not-a-number" }],
      ["a null timestamp", { renderedAt: null }],
      ["a zero timestamp", { renderedAt: 0 }],
      ["a negative timestamp", { renderedAt: -1 }],
    ])("passes %s", (_label, input) => {
      expect(classifySubmission({ ...input, now: NOW })).toEqual({
        spam: false,
      });
    });
  });

  it("does not punish a clock running ahead of ours", () => {
    // A visitor's machine can legitimately be minutes fast; that is skew, not
    // a submission from the future, and it says nothing either way.
    expect(
      classifySubmission({ renderedAt: NOW + 60_000, now: NOW }),
    ).toEqual({ spam: false });
  });
});

describe("classifyRawSubmission", () => {
  it("reads the control fields out of a raw payload", () => {
    expect(
      classifyRawSubmission(
        { name: "Real Person", [HONEYPOT_FIELD]: "filled-in" },
        NOW,
      ),
    ).toEqual({ spam: true, reason: "honeypot" });
  });

  it("passes a payload that carries answers and nothing else", () => {
    expect(
      classifyRawSubmission(
        {
          name: "Real Person",
          email: "real@example.com",
          [RENDERED_AT_FIELD]: NOW - 45_000,
        },
        NOW,
      ),
    ).toEqual({ spam: false });
  });

  it("judges the bot's own shape as spam", () => {
    // Taken from a row the service left in production: every field filled,
    // including the one nobody can see.
    expect(
      classifyRawSubmission(
        {
          name: "Xfbnlpp Lqckpzvd",
          email: "b.e.q.oya.d477@gmail.com",
          phone: "8976444389",
          message: "6022055434",
          [HONEYPOT_FIELD]: "http://spam.example",
          [RENDERED_AT_FIELD]: NOW - 400,
        },
        NOW,
      ),
    ).toEqual({ spam: true, reason: "honeypot" });
  });

  it("does NOT judge that same row on its content alone", () => {
    // The gibberish is not the test. Strip the controls and this has to pass,
    // because the same shape is a transliterated name typed in a hurry — and
    // dropping a real client is worse than keeping a row someone deletes.
    expect(
      classifyRawSubmission(
        {
          name: "Xfbnlpp Lqckpzvd",
          email: "b.e.q.oya.d477@gmail.com",
          message: "6022055434",
        },
        NOW,
      ),
    ).toEqual({ spam: false });
  });
});

describe("withoutSpamControls", () => {
  it("removes both control fields and keeps every answer", () => {
    expect(
      withoutSpamControls({
        name: "Real Person",
        message: "Hello",
        [HONEYPOT_FIELD]: "",
        [RENDERED_AT_FIELD]: NOW,
      }),
    ).toEqual({ name: "Real Person", message: "Hello" });
  });

  it("does not mutate what it was given", () => {
    // The caller still holds the raw payload; stripping is for the schema.
    const raw = { name: "Real Person", [HONEYPOT_FIELD]: "" };
    withoutSpamControls(raw);
    expect(raw).toHaveProperty(HONEYPOT_FIELD);
  });

  it("is a no-op on a payload that never carried them", () => {
    expect(withoutSpamControls({ name: "Real Person" })).toEqual({
      name: "Real Person",
    });
  });
});

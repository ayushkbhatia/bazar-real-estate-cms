import { describe, expect, it } from "vitest";
import {
  domainOf,
  formatFrom,
  ownVerifiedDomains,
  resolveNewsletterSender,
  senderSettingsSchema,
} from "./sender";

const env = { from: "hello@bazarrealestate.com", replyTo: "someone@example.com" };

describe("newsletter sender", () => {
  it("formats a display name, quoting only names RFC 5322 reserves characters in", () => {
    expect(formatFrom("Marketing at Bazar Real Estate", "marketing@bazarrealestate.com")).toBe(
      "Marketing at Bazar Real Estate <marketing@bazarrealestate.com>",
    );
    expect(formatFrom("Bazar, Marketing", "m@x.com")).toBe('"Bazar, Marketing" <m@x.com>');
    expect(formatFrom("  ", "m@x.com")).toBe("m@x.com");
  });

  it("lays the stored row over the env, field by field", () => {
    expect(resolveNewsletterSender(null, env)).toEqual(env);
    expect(
      resolveNewsletterSender({ from_name: "Marketing", from_address: "marketing@bazarrealestate.com", reply_to: "" }, env),
    ).toEqual({ from: "Marketing <marketing@bazarrealestate.com>", replyTo: env.replyTo });
    expect(resolveNewsletterSender({ from_name: "Marketing", from_address: "", reply_to: "m@bazarrealestate.ae" }, env)).toEqual({
      from: env.from,
      replyTo: "m@bazarrealestate.ae",
    });
  });

  it("validates the form: addresses lower-cased, no header injection in the name", () => {
    const ok = senderSettingsSchema.safeParse({
      from_name: "Marketing at Bazar Real Estate",
      from_address: " Marketing@BazarRealEstate.com ",
      reply_to: "marketing@bazarrealestate.ae",
    });
    expect(ok.success && ok.data.from_address).toBe("marketing@bazarrealestate.com");
    expect(
      senderSettingsSchema.safeParse({ from_name: "x\r\nBcc: y@z.com", from_address: "a@b.com", reply_to: "a@b.com" }).success,
    ).toBe(false);
    expect(senderSettingsSchema.safeParse({ from_name: "", from_address: "nope", reply_to: "a@b.com" }).success).toBe(false);
    expect(domainOf("marketing@BazarRealEstate.ae")).toBe("bazarrealestate.ae");
  });
});

describe("ownVerifiedDomains", () => {
  const verified = [
    "news.indushydraulics.com",
    "untiltime.day",
    "businesslistings.me",
    "indushydraulics.com",
    "bazarrealestate.com",
  ];

  it("keeps only this site's domains from the shared account's list", () => {
    expect(ownVerifiedDomains(verified)).toEqual(["bazarrealestate.com"]);
    expect(ownVerifiedDomains([...verified, "mail.bazarrealestate.ae"])).toEqual([
      "bazarrealestate.com",
      "mail.bazarrealestate.ae",
    ]);
  });

  it("adds the configured sender's own domain", () => {
    expect(ownVerifiedDomains([...verified, "bazar.ae"], "Bazar <hello@bazar.ae>")).toEqual([
      "bazarrealestate.com",
      "bazar.ae",
    ]);
  });
});

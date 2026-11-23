import { describe, expect, it } from "vitest";
import {
  campaignFromName,
  domainOf,
  fromAddressOf,
  fromNameOf,
  formatFrom,
  ownVerifiedDomains,
  resolveNewsletterSender,
  senderSettingsSchema,
  withFromName,
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

describe("a newsletter's own sender name (0177)", () => {
  const sender = { from: "Marketing at Bazar Real Estate <marketing@bazarrealestate.ae>", replyTo: "m@bazarrealestate.ae" };

  it("swaps only the name, keeping the address and Reply-To", () => {
    expect(withFromName(sender, "Saadiyat Lagoons by Bazar")).toEqual({
      from: "Saadiyat Lagoons by Bazar <marketing@bazarrealestate.ae>",
      replyTo: sender.replyTo,
    });
    expect(withFromName(sender, "Bazar, Saadiyat").from).toBe('"Bazar, Saadiyat" <marketing@bazarrealestate.ae>');
    expect(withFromName(sender, "  ")).toBe(sender);
    expect(withFromName(sender, null)).toBe(sender);
    // An env sender with no name at all still gets one.
    expect(withFromName({ from: "hello@bazarrealestate.ae", replyTo: "x@y.z" }, "Bazar").from).toBe(
      "Bazar <hello@bazarrealestate.ae>",
    );
  });

  it("picks the Arabic name for the Arabic edition, then the English, then none", () => {
    const c = { from_name: "Saadiyat Lagoons", from_name_ar: "سعديات لاجونز" };
    expect(campaignFromName(c, "en")).toBe("Saadiyat Lagoons");
    expect(campaignFromName(c, "ar")).toBe("سعديات لاجونز");
    expect(campaignFromName({ from_name: "Saadiyat Lagoons", from_name_ar: " " }, "ar")).toBe("Saadiyat Lagoons");
    expect(campaignFromName({ from_name: "", from_name_ar: "سعديات" }, "en")).toBe("");
    expect(campaignFromName({}, "ar")).toBe("");
  });

  it("reads a From header back into its name and address", () => {
    expect(fromAddressOf('"Bazar, Marketing" <m@x.com>')).toBe("m@x.com");
    expect(fromAddressOf("m@x.com")).toBe("m@x.com");
    expect(fromNameOf('"Bazar, Marketing" <m@x.com>')).toBe("Bazar, Marketing");
    expect(fromNameOf("Marketing at Bazar <m@x.com>")).toBe("Marketing at Bazar");
    expect(fromNameOf("m@x.com")).toBe("");
  });
});

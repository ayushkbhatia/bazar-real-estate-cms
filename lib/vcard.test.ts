import { describe, expect, it } from "vitest";
import { buildVCard, vCardFilename } from "./vcard";

/**
 * The .vcf behind "Add to Contacts" on /contact-qr. These assertions are about
 * what phones will actually parse, so they check the wire format — CRLF, the
 * mandatory N line, RFC 2426 escaping — not just that a field made it in.
 */
describe("buildVCard", () => {
  const full = buildVCard({
    fullName: "Bazar Real Estate",
    organisation: "Bazar Real Estate",
    mobile: "+971 50 691 1103",
    workPhone: "+971 2 632 2223",
    email: "info@bazarrealestate.ae",
    url: "https://www.bazarrealestate.ae",
    address: {
      street: "Sheikha Salama Building, Office 4",
      locality: "Abu Dhabi",
      country: "United Arab Emirates",
    },
  });

  it("opens and closes a 3.0 card", () => {
    expect(full.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(full.endsWith("END:VCARD\r\n")).toBe(true);
  });

  it("uses CRLF throughout — some Android importers reject bare LF", () => {
    expect(full.split("\n").every((l) => l === "" || l.endsWith("\r"))).toBe(
      true,
    );
  });

  it("emits N as well as FN — N is mandatory in 3.0", () => {
    expect(full).toContain("N:Bazar Real Estate;;;;\r\n");
    expect(full).toContain("FN:Bazar Real Estate\r\n");
  });

  it("types the two numbers differently, so one imports as mobile", () => {
    expect(full).toContain("TEL;TYPE=CELL,VOICE:+971 50 691 1103");
    expect(full).toContain("TEL;TYPE=WORK,VOICE:+971 2 632 2223");
  });

  it("puts the address in the street/locality/country slots of ADR", () => {
    expect(full).toContain(
      "ADR;TYPE=WORK:;;Sheikha Salama Building\\, Office 4;Abu Dhabi;;;United Arab Emirates",
    );
  });

  it("escapes backslash, comma, semicolon and newline per RFC 2426", () => {
    const card = buildVCard({
      fullName: "A, B; C\\D",
      note: "line one\nline two",
    });
    expect(card).toContain("FN:A\\, B\\; C\\\\D");
    expect(card).toContain("NOTE:line one\\nline two");
  });

  it("drops fields that are blank rather than emitting empty lines", () => {
    const card = buildVCard({ fullName: "Bazar", email: "   ", url: null });
    expect(card).not.toContain("EMAIL");
    expect(card).not.toContain("URL:");
    expect(card).not.toContain("ADR");
  });

  it("falls back to the organisation when there is no full name", () => {
    const card = buildVCard({ fullName: "", organisation: "Bazar" });
    expect(card).toContain("FN:Bazar");
    expect(card).toContain("ORG:Bazar");
  });

  it("is deterministic — no REV, so the response can be cached", () => {
    expect(buildVCard({ fullName: "Bazar" })).toBe(
      buildVCard({ fullName: "Bazar" }),
    );
    expect(full).not.toContain("REV:");
  });
});

describe("vCardFilename", () => {
  it("slugs the name", () => {
    expect(vCardFilename("Bazar Real Estate")).toBe("bazar-real-estate.vcf");
  });

  it("never produces a nameless file", () => {
    expect(vCardFilename("  ")).toBe("contact.vcf");
    expect(vCardFilename("···")).toBe("contact.vcf");
  });
});

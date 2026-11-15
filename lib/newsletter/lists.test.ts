import { describe, expect, it } from "vitest";
import { contactsToCsv, isValidEmail, localeOf, parseContacts, parseCsv, SUPPRESSION_LOOKUP_CHUNK } from "./lists";
import { emailHash } from "./send";

describe("parseCsv", () => {
  it("reads quoted fields with delimiters, quotes and line breaks, and a BOM", () => {
    expect(parseCsv('﻿name,email\n"Doe, Jane",jane@x.com\n"A ""B""",b@x.com\r\n')).toEqual([
      ["name", "email"],
      ["Doe, Jane", "jane@x.com"],
      ['A "B"', "b@x.com"],
    ]);
    expect(parseCsv("name;email\nJane;jane@x.com")).toEqual([
      ["name", "email"],
      ["Jane", "jane@x.com"],
    ]);
  });
});

describe("parseContacts", () => {
  it("takes the header's columns, lower-cases, dedupes, and reports the unusable lines", () => {
    const r = parseContacts(
      "Full Name,E-mail Address,Language\nJane Doe, JANE@Example.com ,Arabic\nNo Address,,en\nBad,not-an-email,en\nJane again,jane@example.com,en\n",
    );
    expect(r.contacts).toEqual([{ email: "jane@example.com", name: "Jane Doe", locale: "ar" }]);
    expect(r.duplicates).toBe(1);
    expect(r.invalid.map((i) => [i.line, i.reason])).toEqual([
      [3, "No email address"],
      [4, "Not an email address"],
    ]);
  });

  it("joins first and last names, and finds the address column when there's no header", () => {
    expect(parseContacts("first name,last name,email\nJane,Doe,j@x.com").contacts[0]).toEqual({ email: "j@x.com", name: "Jane Doe", locale: "en" });
    const bare = parseContacts("Jane,j@x.com\nAli,a@x.com");
    expect(bare.columns.header).toBe(false);
    expect(bare.contacts.map((c) => [c.name, c.email])).toEqual([
      ["Jane", "j@x.com"],
      ["Ali", "a@x.com"],
    ]);
  });

  it("knows Arabic from its names, and validates addresses", () => {
    expect(localeOf("العربية")).toBe("ar");
    expect(localeOf("AR")).toBe("ar");
    expect(localeOf("French")).toBe("en");
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("contactsToCsv", () => {
  it("quotes commas and defuses spreadsheet formulas", () => {
    const csv = contactsToCsv([{ email: "a@b.com", name: "=HYPERLINK(1), x", locale: "en", status: "active", created_at: "2026-11-03T10:00:00Z" }]);
    expect(csv.split("\n")[1]).toBe(`"'=HYPERLINK(1), x",a@b.com,en,active,2026-11-03`);
  });
});

describe("SUPPRESSION_LOOKUP_CHUNK", () => {
  // The import's suppression lookup is a GET with the hashes in the URL.
  // Supabase's gateway returned "400 Bad Request" at 400 hashes (~26 KB);
  // keep one chunk's filter well under that.
  it("keeps one lookup's URL filter under 8 KB", () => {
    const hashes = Array.from({ length: SUPPRESSION_LOOKUP_CHUNK }, (_, i) => emailHash(`person${i}@example.com`));
    const filter = `email_hash=in.(${hashes.join(",")})`;
    expect(filter.length).toBeLessThan(8 * 1024);
  });
});

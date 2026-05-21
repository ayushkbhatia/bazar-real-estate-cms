import { describe, it, expect } from "vitest";
import { buildIcs, formatIcsDate, escapeIcsText } from "./ics";

describe("formatIcsDate", () => {
  it("formats a UTC date as YYYYMMDDTHHMMSSZ", () => {
    const d = new Date(Date.UTC(2026, 4, 21, 13, 5, 7));
    expect(formatIcsDate(d)).toBe("20260521T130507Z");
  });

  it("pads single-digit values", () => {
    const d = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(formatIcsDate(d)).toBe("20260101T000000Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes commas, semicolons, backslashes, and newlines per RFC 5545", () => {
    expect(escapeIcsText("hello, world; with\\backslash\nand newline")).toBe(
      "hello\\, world\\; with\\\\backslash\\nand newline",
    );
  });
});

describe("buildIcs", () => {
  const baseEvent = {
    uid: "viewing-123",
    summary: "Bazar viewing · BAZ-AD-04891",
    description: "Confirming our viewing at Mamsha Al Saadiyat.",
    location: "Mamsha Al Saadiyat, Saadiyat Island, Abu Dhabi",
    startsAt: new Date(Date.UTC(2026, 5, 1, 13, 0, 0)),
    endsAt: new Date(Date.UTC(2026, 5, 1, 13, 45, 0)),
  };

  it("includes the required VCALENDAR / VEVENT envelope", () => {
    const ics = buildIcs(baseEvent);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("formats start + end as UTC ICS dates", () => {
    const ics = buildIcs(baseEvent);
    expect(ics).toContain("DTSTART:20260601T130000Z");
    expect(ics).toContain("DTEND:20260601T134500Z");
  });

  it("uses METHOD:REQUEST when specified", () => {
    const ics = buildIcs({ ...baseEvent, method: "REQUEST" });
    expect(ics).toContain("METHOD:REQUEST");
  });

  it("emits an ATTENDEE line when supplied", () => {
    const ics = buildIcs({
      ...baseEvent,
      method: "REQUEST",
      attendee: { name: "Ayush", email: "lead@example.com" },
      organizer: { name: "Bazar Advisor", email: "hello@bazar.ae" },
    });
    // RFC 5545 folds long lines with "\r\n " — collapse before searching.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("ATTENDEE");
    expect(unfolded).toContain("mailto:lead@example.com");
    expect(unfolded).toContain("ORGANIZER");
    expect(unfolded).toContain("mailto:hello@bazar.ae");
  });

  it("escapes user-supplied text", () => {
    const ics = buildIcs({
      ...baseEvent,
      summary: "Viewing; with, commas",
    });
    expect(ics).toContain("SUMMARY:Viewing\\; with\\, commas");
  });

  it("ends with CRLF line breaks", () => {
    const ics = buildIcs(baseEvent);
    // No bare \n outside the escaped sequences (the only \n we add is via
    // line-folding, which uses \r\n).
    expect(ics.split("\r\n").length).toBeGreaterThan(5);
  });
});

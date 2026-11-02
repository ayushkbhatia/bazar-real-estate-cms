import { describe, expect, it } from "vitest";
import { nameIssue, phoneIssue } from "./contact-validation";

/** Shapes the 2 Nov 2026 bot filed, by the hundred. */
const BOT_NAMES = [
  "lQ9hkvs0wF ZbQVUokJcp",
  "RxNgOxTAT7 MQNAbmuU64",
  "kzidRYKLAA zIHqASw87Z",
  "GwKfibYcun L7lF1XjKrt",
  "TsDREbYC8K iV6mMLfCkV",
  "riTLE4vA7y asnxABtrOL",
  "mOufICUqiL poMFwTd98d",
  "nmGIZspdux KbXNHrOCmg",
  "vDxmBXnWxf ocetqQISzx",
  "SskUZXRetW XF825nurvn",
];

describe("nameIssue", () => {
  it("accepts the names people actually have", () => {
    for (const name of [
      "Omar Hasan",
      "Mary-Jane O'Brien",
      "Sarah McDonald",
      "DeAndre Jordan",
      "Jean-Luc d'Artagnan",
      "JOHN SMITH",
      "Li",
      "J. R. Tolkien",
      "Ahmed Al-Hashimi",
      "محمد بن راشد",
      "فاطمة الزهراء",
      "José Martínez",
      "Zoë Ångström",
      "Anne Marie van der Berg",
    ]) {
      expect(nameIssue(name), name).toBeNull();
    }
  });

  it("refuses every bot name from the flood", () => {
    for (const name of BOT_NAMES) expect(nameIssue(name), name).not.toBeNull();
  });

  it("refuses digits in any script, symbols and links", () => {
    expect(nameIssue("John 2")).toBe("Names can't contain numbers");
    expect(nameIssue("محمد ٣")).toBe("Names can't contain numbers");
    expect(nameIssue("john@example.com")).toBe("Use letters only in your name");
    expect(nameIssue("https://spam.example")).not.toBeNull();
    expect(nameIssue("A")).toBe("Enter your full name");
  });

  it("leaves a blank box to the form's own required rule", () => {
    expect(nameIssue("  ")).toBeNull();
  });
});

describe("phoneIssue", () => {
  it("accepts real numbers, picked or typed", () => {
    for (const phone of [
      "+971 50 123 4567",
      "+971 501234567",
      "+971 050 123 4567", // trunk zero after the picked code
      "+971 971501234567", // the code typed again
      "+971 +971 50 123 4567",
      "+971 2 621 2345", // Abu Dhabi landline
      "+966 55 123 4567",
      "+44 7911 123456",
      "+1 (415) 555-2671",
      "+91 98765 43210",
      "+971501234567",
      "00971501234567",
      "050 123 4567", // no code: read as UAE
    ]) {
      expect(phoneIssue(phone), phone).toBeNull();
    }
  });

  it("refuses the bot's foreign number after +971", () => {
    for (const phone of ["+971 +17664744917", "+971 +14387486669", "+971 +12138429525"]) {
      expect(phoneIssue(phone), phone).toMatch(/Pick the country code/);
    }
  });

  it("counts the digits for the country picked", () => {
    expect(phoneIssue("+971 17664744917")).toMatch(/valid \+971 number/);
    expect(phoneIssue("+971 5012345")).toMatch(/valid \+971 number/);
    expect(phoneIssue("+1 555 12")).toMatch(/valid \+1 number/);
    expect(phoneIssue("4730756495")).toMatch(/valid UAE number/);
  });

  it("refuses letters, placeholders and stray plus signs", () => {
    expect(phoneIssue("+971 50 CALL ME")).toBe("Use digits only in the phone number");
    expect(phoneIssue("+971 500000000")).not.toBeNull();
    expect(phoneIssue("050+1234567")).toBe("Use digits only in the phone number");
  });

  it("leaves a blank box to the form's own required rule", () => {
    expect(phoneIssue("")).toBeNull();
  });
});

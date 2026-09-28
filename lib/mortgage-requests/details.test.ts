import { describe, expect, it } from "vitest";
import {
  detailsSchema,
  dobRule,
  emailRule,
  firstInvalidField,
  maskDob,
  maskMobile9,
  mobileDigits,
  mobileRule,
  nameRule,
  normaliseName,
  parseDob,
  toE164,
  validateDetails,
} from "./details";

const NOW = new Date("2026-09-22T06:00:00Z");

describe("full name", () => {
  it("accepts Latin and Arabic names with hyphens and apostrophes", () => {
    expect(nameRule("Priya Raman")).toBeNull();
    expect(nameRule("Ahmed Al-Suwaidi")).toBeNull();
    expect(nameRule("Siobhán O'Connor")).toBeNull();
    expect(nameRule("D’Souza")).toBeNull();
    expect(nameRule("محمد بن راشد")).toBeNull();
  });

  it("trims and collapses spaces", () => {
    expect(normaliseName("  Priya   Raman ")).toBe("Priya Raman");
  });

  it("refuses empty, one letter, over 100, digits and symbols", () => {
    expect(nameRule("   ")).toBe("required");
    expect(nameRule("P")).toBe("too_short");
    expect(nameRule("a".repeat(101))).toBe("too_long");
    expect(nameRule("Priya 2")).toBe("characters");
    expect(nameRule("Priya <b>")).toBe("characters");
    expect(nameRule("李小龍")).toBe("characters");
  });
});

describe("date of birth", () => {
  it("masks digits as they are typed", () => {
    expect(maskDob("1")).toBe("1");
    expect(maskDob("140")).toBe("14 / 0");
    expect(maskDob("14031990")).toBe("14 / 03 / 1990");
    expect(maskDob("14 / 03 / 19901")).toBe("14 / 03 / 1990");
  });

  it("parses the masked form, loose separators and autofill's ISO", () => {
    expect(parseDob("14 / 03 / 1990")).toBe("1990-03-14");
    expect(parseDob("2/11/1986")).toBe("1986-11-02");
    expect(parseDob("14-03-1990")).toBe("1990-03-14");
    expect(parseDob("1990-03-14")).toBe("1990-03-14");
  });

  it("refuses dates that don't exist", () => {
    expect(parseDob("31 / 02 / 1990")).toBeNull();
    expect(parseDob("29 / 02 / 2023")).toBeNull();
    expect(parseDob("29 / 02 / 2024")).toBe("2024-02-29");
    expect(parseDob("14 / 13 / 1990")).toBeNull();
    expect(parseDob("14 / 03")).toBeNull();
  });

  it("wants a past date, in Dubai's today", () => {
    expect(dobRule("", NOW)).toBe("required");
    expect(dobRule("31 / 02 / 1990", NOW)).toBe("not_a_date");
    expect(dobRule("22 / 09 / 2026", NOW)).toBe("not_in_past");
    expect(dobRule("21 / 09 / 2026", NOW)).toBeNull();
    expect(dobRule("01 / 01 / 1899", NOW)).toBe("too_old");
  });
});

describe("mobile", () => {
  it("keeps the nine national digits from anything pasted", () => {
    expect(mobileDigits("50 218 4417")).toBe("502184417");
    expect(mobileDigits("+971502184417")).toBe("502184417");
    expect(mobileDigits("00971 50 218 4417")).toBe("502184417");
    expect(mobileDigits("971502184417")).toBe("502184417");
    expect(mobileDigits("050-218-4417")).toBe("502184417");
    expect(mobileDigits("+971 (0)50 218 4417")).toBe("502184417");
  });

  it("formats as it is typed", () => {
    expect(maskMobile9("5")).toBe("5");
    expect(maskMobile9("5021")).toBe("50 21");
    expect(maskMobile9("502184417")).toBe("50 218 4417");
  });

  it("wants a mobile, and names a landline as one", () => {
    expect(mobileRule("")).toBe("required");
    expect(mobileRule("2 632 2223")).toBe("landline");
    expect(mobileRule("4 123 4567")).toBe("landline");
    expect(mobileRule("50 218 441")).toBe("not_mobile");
    expect(mobileRule("80 218 4417")).toBe("not_mobile");
    expect(mobileRule("50 218 4417")).toBeNull();
  });

  it("stores E.164", () => {
    expect(toE164("50 218 4417")).toBe("+971502184417");
    expect(toE164("2 632 2223")).toBeNull();
  });
});

describe("email", () => {
  it("wants a valid address", () => {
    expect(emailRule("")).toBe("required");
    expect(emailRule("priya@")).toBe("invalid");
    expect(emailRule(" Priya.Raman@Gmail.com ")).toBeNull();
  });
});

describe("the whole form", () => {
  const complete = {
    residency: "uae_resident_expat" as const,
    employmentType: "salaried" as const,
    fullName: " Priya  Raman",
    dateOfBirth: "14 / 03 / 1990",
    mobileNational: "50 218 4417",
    email: "Priya.Raman@Gmail.com",
  };

  it("normalises a complete form into what the API takes", () => {
    expect(validateDetails(complete, NOW)).toEqual({
      ok: true,
      details: {
        residency: "uae_resident_expat",
        employmentType: "salaried",
        fullName: "Priya Raman",
        dateOfBirth: "1990-03-14",
        mobile: "+971502184417",
        email: "priya.raman@gmail.com",
      },
    });
  });

  it("reports every failing field, first in the form's order first", () => {
    const result = validateDetails({ ...complete, residency: undefined, email: "x" }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({ residency: "required", email: "invalid" });
    expect(firstInvalidField(result.errors)).toBe("residency");
  });

  it("agrees with the server's schema", () => {
    const valid = validateDetails(complete, NOW);
    if (!valid.ok) throw new Error("expected valid");
    const schema = detailsSchema(() => NOW);
    expect(schema.safeParse(valid.details).success).toBe(true);

    const bad = schema.safeParse({ ...valid.details, dateOfBirth: "2026-09-22" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(["dateOfBirth"]);
    expect(bad.error?.issues[0]?.message).toBe("not_in_past");

    expect(schema.safeParse({ ...valid.details, mobile: "+97142223333" }).success).toBe(false);
    expect(schema.safeParse({ ...valid.details, fullName: "P" }).success).toBe(false);
  });
});

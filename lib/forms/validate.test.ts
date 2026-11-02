import { describe, expect, it } from "vitest";
import { defaultForm } from "./resolve";
import { buildFormSchema, fieldErrorsFrom, normaliseSubmission } from "./validate";

/** The home page "List your property" card, as the 2 Nov 2026 bot filled it. */
const home = defaultForm("home_list_property")!;

function check(values: Record<string, unknown>) {
  const normalised = normaliseSubmission(home, values);
  const parsed = buildFormSchema(home, {}, normalised).safeParse(normalised);
  return parsed.success ? {} : fieldErrorsFrom(parsed.error);
}

const real = {
  first_name: "Sara",
  last_name: "Al-Mansoori",
  email: "sara@example.com",
  phone: "+971 50 123 4567",
  purpose: "sell",
};

describe("buildFormSchema → contact rules", () => {
  it("takes a real owner's details", () => {
    expect(check(real)).toEqual({});
  });

  it("refuses the bot's submission on every field it faked", () => {
    const errors = check({
      ...real,
      first_name: "lQ9hkvs0wF",
      last_name: "ZbQVUokJcp",
      phone: "+971 +17664744917",
    });
    expect(Object.keys(errors).sort()).toEqual(["first_name", "last_name", "phone"]);
    expect(errors.first_name).toBe("Names can't contain numbers");
    expect(errors.phone).toMatch(/Pick the country code/);
  });

  it("counts the digits for the code picked", () => {
    expect(check({ ...real, phone: "+971 50 123 45" }).phone).toMatch(/valid \+971 number/);
    expect(check({ ...real, phone: "+44 7911 123456" })).toEqual({});
  });
});

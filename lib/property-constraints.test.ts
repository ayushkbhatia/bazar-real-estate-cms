import { describe, it, expect } from "vitest";
import { friendlyPropertyConstraintError } from "./property-constraints";

describe("friendlyPropertyConstraintError", () => {
  it("translates the rent/property-form CHECK violation", () => {
    const res = friendlyPropertyConstraintError({
      code: "23514",
      message:
        'new row for relation "properties" violates check constraint "properties_form_rent_null_ck"',
    });
    expect(res).not.toBeNull();
    expect(res?.message).toMatch(/rent listing/i);
    // Never leak the raw SQLSTATE or the constraint name to an operator.
    expect(res?.message).not.toMatch(/23514|_ck/);
    expect(res?.fieldErrors?.property_form).toBeTruthy();
  });

  it("ignores non-check-violation errors", () => {
    expect(
      friendlyPropertyConstraintError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }),
    ).toBeNull();
  });

  it("ignores check violations it has no wording for", () => {
    expect(
      friendlyPropertyConstraintError({
        code: "23514",
        message: 'violates check constraint "properties_some_other_ck"',
      }),
    ).toBeNull();
  });

  it("is safe on null/undefined and on errors with no message", () => {
    expect(friendlyPropertyConstraintError(null)).toBeNull();
    expect(friendlyPropertyConstraintError(undefined)).toBeNull();
    expect(friendlyPropertyConstraintError({ code: "23514" })).toBeNull();
  });
});

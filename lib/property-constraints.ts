/** Translate the Postgres CHECK constraints on `properties` into something a
 *  non-technical lister can act on.
 *
 *  The zod schemas already block these combinations client- and server-side;
 *  this is the last line of defence for writes that reach the database anyway
 *  (CSV import, bulk edit, a stale tab). A raw `23514` in a toast is not an
 *  acceptable thing to show an operator.
 */

export type PropertyConstraintError = {
  message: string;
  fieldErrors?: Record<string, string>;
};

type PostgrestLike = {
  code?: string | null;
  message?: string | null;
};

const CHECK_VIOLATION = "23514";

export function friendlyPropertyConstraintError(
  error: PostgrestLike | null | undefined,
): PropertyConstraintError | null {
  if (!error || error.code !== CHECK_VIOLATION) return null;
  const text = error.message ?? "";

  if (text.includes("properties_form_rent_null_ck")) {
    return {
      message:
        "A rent listing can't have a property form. Clear the property form, or switch the listing to For sale.",
      fieldErrors: {
        property_form: "Not applicable to rent listings",
      },
    };
  }

  return null;
}

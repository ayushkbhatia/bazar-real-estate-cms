import { z } from "zod";

/**
 * Id validation for this project.
 *
 * Not every id here is an RFC-conformant UUID. The seeded catalogue numbers
 * rows readably — `33333333-0000-0000-0000-000000000008` for a development,
 * `22222222-0000-0000-0000-000000000001` for a developer — and that zero
 * version nibble is exactly what `z.string().uuid()` checks. Postgres `uuid`
 * columns accept them happily; only the validator objects.
 *
 * That mismatch shipped as a real bug: picking any neighbouring project on a
 * development page failed with "Invalid UUID" on every slot, because no
 * development in the catalogue could pass. Six schemas had already worked
 * around it with their own copy of the regex below.
 *
 * So: match the *shape* — 8-4-4-4-12 hex — and let the database enforce the
 * rest. Anything that isn't an id is still rejected, which is what the check
 * is actually for.
 */
export const UUID_SHAPE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidLike(value: unknown): value is string {
  return typeof value === "string" && UUID_SHAPE_RE.test(value);
}

/** Zod string that accepts any id this project actually uses. */
export function uuidLike(message = "Invalid id") {
  return z.string().regex(UUID_SHAPE_RE, message);
}

/**
 * The same, but treating "" and null as "not set" — the shape a form sends
 * when a picker is left empty.
 */
export function uuidLikeOrEmpty(message = "Invalid id") {
  return z
    .union([uuidLike(message), z.literal(""), z.null()])
    .transform((v) => (v ? v : null))
    .nullable()
    .optional();
}

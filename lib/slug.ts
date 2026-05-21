/**
 * Convert arbitrary text into a URL-safe kebab-case slug.
 * - lowercases
 * - decomposes accented characters and drops the diacritics
 * - turns the bullet character (·) and other punctuation into hyphens
 * - collapses runs of hyphens and trims them off the ends
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Generate a fresh property reference, e.g. "BAZ-AD-04891".
 * Schema is BAZ-<emirate>-<5 digit zero-padded number 1000..9999>.
 * Collision odds are ~1 in 9000 — caller should retry on the unique
 * constraint violation if it happens.
 */
export function generatePropertyReference(emirateCode = "AD"): string {
  const n = Math.floor(1000 + Math.random() * 9000); // 1000..9999
  return `BAZ-${emirateCode.toUpperCase()}-0${n}`;
}

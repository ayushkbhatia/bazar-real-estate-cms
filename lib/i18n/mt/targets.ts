/**
 * What may be machine-translated, and what may never be.
 *
 * Two lists rather than one, because they answer different questions and fail
 * differently. `MT_TARGETS` is an allowlist: a field absent from it is simply
 * not translated, which is safe. `PROTECTED_FIELDS` is a denylist that exists
 * to make adding the wrong thing to the allowlist a test failure rather than a
 * judgement call made once, quickly, by whoever is adding a field at the time.
 *
 * The distinction that governs the whole file: some fields are excluded
 * because translating them would be wasted effort, and some because
 * translating them would be wrong. Only the second kind is protected.
 */

export type MtTarget = {
  table: string;
  /** English column. Its Arabic twin is this name + `_ar`. */
  column: string;
  /** Hard cap on the Arabic, where the design or the column imposes one. */
  maxLength?: number;
  /** Prose register, which changes the prompt. */
  kind: "title" | "summary" | "body" | "alt";
};

export const MT_TARGETS: MtTarget[] = [
  // Properties. The only high-volume table, and the reason the pipeline
  // exists at all.
  { table: "properties", column: "title", kind: "title", maxLength: 180 },
  {
    table: "properties",
    column: "short_description",
    kind: "summary",
    maxLength: 400,
  },
  { table: "properties", column: "description", kind: "body" },

  // Alt text. Bulk, low-stakes, and the accessibility win is real: an Arabic
  // page whose images announce themselves in English is worse for a screen
  // reader than one with no alt text at all, because the reader switches
  // voice mid-sentence.
  { table: "media_assets", column: "alt_text", kind: "alt", maxLength: 200 },
];

/**
 * Never machine-translated. Each entry is a decision with a reason, and the
 * reasons are not interchangeable.
 */
export const PROTECTED_FIELDS: { table: string; column: string; why: string }[] =
  [
    // ── Legally operative text. A machine translation of a permit number or a
    // licence reference does not have a "slightly wrong" failure mode.
    {
      table: "properties",
      column: "listing_permit_no",
      why: "regulatory identifier",
    },
    { table: "properties", column: "reference", why: "regulatory identifier" },
    { table: "staff", column: "brn", why: "regulatory identifier" },
    { table: "site_settings", column: "orn", why: "regulatory identifier" },

    // ── Money. Never prose, and never guessed at.
    { table: "properties", column: "price_aed", why: "price" },
    { table: "properties", column: "service_charge_per_ft2", why: "price" },

    // ── Someone else's words. Presenting a machine translation of a
    // customer's review as that customer's words is a misrepresentation, not
    // a quality problem — so reviews are never translated at any confidence.
    { table: "reviews", column: "body", why: "visitor-authored" },
    { table: "reviews", column: "title", why: "visitor-authored" },

    // ── Internal. No public render path, so translating it is pure cost —
    // this alone removes roughly 40% of a naive token budget for properties.
    { table: "properties", column: "advisor_note", why: "internal only" },
  ];

/**
 * Legal and consent copy is protected too, but it cannot be listed above
 * because none of it is a database column: `/legal/*` is JSX under
 * `app/[locale]/(public)/legal/` and the consent strings live in the banner
 * component. There is nothing for a table-and-column denylist to name.
 *
 * Their protection is structural instead — no MT target can reach them, and
 * the Arabic for those surfaces is hand-authored through the message
 * catalogue, where a translator sees them as ordinary strings. Recorded here
 * so the absence reads as a decision rather than an oversight.
 */
export const PROTECTED_NON_COLUMNS = [
  "app/[locale]/(public)/legal/** — lawyer-signed copy",
  "cookie consent banner strings — consent copy",
] as const;

const key = (table: string, column: string) => `${table}.${column}`;

const PROTECTED_KEYS = new Set(
  PROTECTED_FIELDS.map((f) => key(f.table, f.column)),
);

export function isProtected(table: string, column: string): boolean {
  return PROTECTED_KEYS.has(key(table, column));
}

export function targetsFor(table: string): MtTarget[] {
  return MT_TARGETS.filter((t) => t.table === table);
}

/** The Arabic twin column for a target. */
export function arColumn(target: MtTarget): string {
  return `${target.column}_ar`;
}

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
  /**
   * Prose register, which changes the prompt.
   *
   * `ui` joined this union when the navigation became a target. It was already
   * an `MtKind` — `MtKind` is `MtTarget["kind"] | "ui" | "page"` — so the
   * registers existed and only a flat COLUMN could not ask for one. A nav
   * label is chrome, and chrome is what `UI_SYSTEM_PROMPT` was written for.
   */
  kind: "title" | "summary" | "body" | "alt" | "ui";
};

export const MT_TARGETS: MtTarget[] = [
  // Properties. The only high-volume table, and the reason the pipeline
  // exists at all.
  /*
   * The caps mirror the Arabic twins in `propertyEditSchema`
   * (`lib/schemas/property.ts:154,167`): 1.5x the English sibling, per `arMax`
   * in `lib/master-pages/twins.ts`. English is title 160, short_description
   * 320, so Arabic is 240 and 480.
   *
   * They said 180 and 400 until now, written in the PR before the caps were
   * settled and never revisited. Nothing reads `maxLength` at runtime — the
   * only consumers of this file anywhere are its own tests — so the wrong
   * numbers were inert. They stop being inert the moment anyone does the
   * obvious thing and points `_translate-actions.ts` at this registry instead
   * of its own hardcoded pair, at which point a correct Arabic title between
   * 180 and 240 characters is rejected as `too-long` and the field silently
   * stays English.
   */
  { table: "properties", column: "title", kind: "title", maxLength: 240 },
  {
    table: "properties",
    column: "short_description",
    kind: "summary",
    maxLength: 480,
  },
  { table: "properties", column: "description", kind: "body" },

  // Alt text. Bulk, low-stakes, and the accessibility win is real: an Arabic
  // page whose images announce themselves in English is worse for a screen
  // reader than one with no alt text at all, because the reader switches
  // voice mid-sentence.
  /*
   * The navigation. Read on every page, and the most visible English left on
   * an otherwise Arabic site — 126 strings across five tables, none of which
   * had an Arabic value.
   *
   * `kind: "ui"` deliberately: a nav label is chrome, and the failure
   * `UI_SYSTEM_PROMPT` exists for — an ambiguous single word resolving toward
   * property vocabulary — is exactly the risk on "Buy", "Rent", "Areas".
   */
  { table: "megamenu_tabs", column: "label", kind: "ui", maxLength: 90 },
  { table: "megamenu_tabs", column: "panel_title", kind: "ui", maxLength: 120 },
  { table: "megamenu_tabs", column: "right_column_title", kind: "ui", maxLength: 120 },
  { table: "megamenu_columns", column: "heading", kind: "ui", maxLength: 120 },
  { table: "megamenu_items", column: "label", kind: "ui", maxLength: 120 },
  { table: "megamenu_items", column: "badge_label", kind: "ui", maxLength: 60 },
  { table: "megamenu_featured_tiles", column: "headline", kind: "title", maxLength: 180 },
  { table: "megamenu_featured_tiles", column: "badge_label", kind: "ui", maxLength: 60 },
  { table: "megamenu_featured_tiles", column: "cta_label", kind: "ui", maxLength: 90 },

  // 450 = 1.5x the 300 that `mediaUploadSchema` allows
  // (`lib/schemas/media-upload.ts:64`). This said 200, which was below even
  // the English limit.
  { table: "media_assets", column: "alt_text", kind: "alt", maxLength: 450 },
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
    /*
     * These three are `strategy: "never"` in `lib/i18n/domains.ts` and were
     * missing here. `domains.test.ts` already fails the build if a "never"
     * column reaches `MT_TARGETS`, so they were not unguarded — but
     * `docs/I18N.md:256` tells a contributor to "check it is not in
     * PROTECTED_FIELDS", and for a DLD plot number and a RERA escrow account
     * that check returned a clean all-clear. A denylist that answers "no" to
     * the wrong question is worse than one that is merely incomplete.
     */
    {
      table: "properties",
      column: "dld_plot_number",
      why: "regulatory identifier",
    },
    {
      table: "developments",
      column: "escrow_account",
      why: "regulatory identifier",
    },
    {
      table: "development_units",
      column: "plot_number",
      why: "regulatory identifier",
    },

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

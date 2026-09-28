/**
 * Page-builder block model.
 *
 * The third content system in this codebase, and it sits deliberately between
 * the other two:
 *
 *  - `pages.blocks` (lib/schemas/page.ts) is an open list of five generic
 *    primitives that render placeholder art and nothing else.
 *  - Master pages (lib/master-pages) are bespoke, mobile-audited sections whose
 *    *content* is editable but whose *composition* is fixed in code.
 *
 * A campaign landing page needs both halves: the designed sections, arranged
 * freely. So a `BlockDef` is a master-page `SectionDef` with the two properties
 * that only make sense for a fixed list dropped (`locked`, `defaultEnabled`),
 * and four that only make sense for an open catalogue added (`group`, `needs`,
 * `singleton`, `opener`). `fields` and `defaults` are kept verbatim, which is
 * what lets the field editor, the validator and `attachImageUrls` be shared
 * rather than forked.
 */

import type { FieldDef, SectionValues } from "@/lib/master-pages";

/** How the add-block picker files a block. */
export type BlockGroup =
  | "opener"
  | "listings"
  | "project"
  | "content"
  | "conversion"
  | "trust";

export const BLOCK_GROUPS: { key: BlockGroup; label: string; blurb: string }[] =
  [
    {
      key: "opener",
      label: "Openers",
      blurb: "The first thing a visitor sees. Every page wants exactly one.",
    },
    {
      key: "listings",
      label: "Live inventory",
      blurb: "Properties and projects pulled from the catalogue.",
    },
    {
      key: "project",
      label: "Project sections",
      blurb:
        "The sections of a project's own page — payment plan, master plan, floor plans, map. Pick the project and they stay in step with its record.",
    },
    {
      key: "content",
      label: "Content",
      blurb: "Copy, imagery and the sections that explain the offer.",
    },
    {
      key: "conversion",
      label: "Conversion",
      blurb: "Forms and calls to action.",
    },
    {
      key: "trust",
      label: "Trust",
      blurb: "Who Bazar is and why the visitor should believe it.",
    },
  ];

/**
 * Server data a block wants.
 *
 * Declared here and fetched nowhere near here. The resolver unions every
 * enabled block's needs into a fixed number of queries *before* anything
 * renders — a block that fetches for itself is how one page becomes twenty
 * round-trips, and the listing queries in lib/queries/* are not React-cached,
 * so a repeated call really is a repeated round-trip.
 */
export type BlockNeed =
  /** `values.picks[].ref` — curated property references. */
  | "properties_picked"
  /** `values.source` + `values.limit` — a curated-listings query. */
  | "properties_query"
  | "developments"
  | "areas"
  /** `values.form_key` — a form from the Forms Manager. */
  | "form"
  /**
   * The shared client reviews from the section library. No per-block input:
   * the whole point of that section is that there is one list, so two
   * testimonial blocks on one page still collapse to a single fetch.
   */
  | "testimonials"
  /**
   * The shared partner list from the section library — the same logos the
   * home page and /about carry. Same shape as `testimonials`: no per-block
   * input, one fetch however many blocks read it.
   */
  | "partners"
  /**
   * `values.development` — one project's own record: its payment plan, site
   * plan, figures and map pin. Every project section on the page is served by
   * ONE read, whichever projects they name — see lib/queries/landing-projects.
   */
  | "project"
  /**
   * What the payment-plan calculator prices: the project's available units and
   * the unit types an editor has priced — prices only, no layouts.
   */
  | "project_units"
  /** The project's unit types and their floor plans. */
  | "project_unit_types"
  /** `values.agent` — an advisor's public profile, by slug. */
  | "advisor";

/**
 * A fetch several blocks share, charged to the page's query budget ONCE.
 *
 * `queryCost` charges per block, and for list-shaped live inventory that is
 * the point: the cap is on how much of the page is inventory. It is the wrong
 * model for sections that are views of one record. A project launch page
 * wants the payment plan, the master plan, the floor plans and the map —
 * four sections, one read of one row — and charging four would refuse a
 * perfectly cheap page while telling the editor it "would run four catalogue
 * queries", which is not true. So those blocks name the batched fetch they
 * read from, and the gate counts distinct names.
 */
export type SharedQuery = "projects" | "advisors";

export type BlockDef = {
  /**
   * Stored as `BlockInstance.type`. This is data, not a label: renaming one
   * orphans every published page that uses it. Add a new key and mark the old
   * one `deprecated` instead — see `document.ts`.
   */
  key: string;
  label: string;
  /** One line describing what the block is, shown in the picker and the list. */
  description: string;
  group: BlockGroup;
  fields: FieldDef[];
  /** What the underlying component renders today, so nothing changes on add. */
  defaults: SectionValues;
  needs?: BlockNeed[];
  /**
   * Distinct data fetches this block contributes. Summed by the publish gate
   * against LANDING_QUERY_BUDGET. Blocks that share a fetch (two picked-property
   * blocks) still declare 1 each — the gate is a ceiling on ambition, and the
   * resolver is what actually collapses them.
   */
  queryCost?: number;
  /**
   * The batched fetch this block reads from, when it shares one with other
   * blocks. Charged once per page however many blocks name it — see
   * `SharedQuery`. Use this or `queryCost`, not both.
   */
  sharedQuery?: SharedQuery;
  /** At most one per page. Hidden in the picker once the page has one. */
  singleton?: boolean;
  /** May lead the page. The gate requires the first enabled block to be one. */
  opener?: boolean;
  /** Renders the page's `<h1>`. Exactly one enabled block must say true. */
  providesH1?: boolean;
  /** Content the block pulls from live records and an editor cannot type. */
  dataNote?: string;
  /**
   * The list this block cannot render without.
   *
   * Several catalogue components draw nothing at all when their list is empty
   * — a heading over an empty grid reads as a broken page, so `_render.tsx`
   * drops the whole section. That is right on the public side and invisible on
   * the editing side: a marketing manager who adds "How it works", never opens
   * it, and publishes gets a page with the section silently missing. Declaring
   * the list here is what lets the editor say so on the row and the publish
   * gate refuse, both from the same fact.
   *
   * Keep it in step with the `items.length === 0` guards in `_render.tsx` —
   * `render.test.tsx` fails if a declared block still renders while empty.
   */
  rowsRequired?: {
    /** The list field. */
    key: string;
    /** The sub-field that has to carry text for a row to count at all. */
    itemKey: string;
    /** Only when another field holds this value — `source: "picked"`. */
    onlyWhen?: { key: string; value: string };
  };
  /**
   * The record this block is a view of — a project, an advisor.
   *
   * The single-record counterpart of `rowsRequired`: a project section with no
   * project picked has nothing to draw, so it renders nothing, and the editor
   * row and the publish gate both say so from this one declaration. It covers
   * the blank the editor left and nothing else — a picked project that has no
   * payment plan is a catalogue state, reported in the editor (see `requires`)
   * but never a reason to refuse a publish.
   */
  pickRequired?: {
    /** The select field holding the pick. */
    key: string;
    /** What one is called, for the message: "project". */
    noun: string;
    /**
     * What the picked record must carry for this section to draw anything.
     * Advisory only: the editor can say "this project has no master plan
     * yet", but the gate never refuses on it, because the record can gain or
     * lose it after the page is live.
     */
    requires?: ProjectFeature;
  };
  /** Out of the picker, still resolves and renders. The rename escape hatch. */
  deprecated?: boolean;
  /**
   * Field migration for stored documents written against an older shape. Run on
   * read and persisted on the next save, so an unmigrated row renders correctly
   * on the very first request without a backfill.
   */
  version?: number;
  migrate?: (values: SectionValues, fromVersion: number) => SectionValues;
};

/**
 * What a project record may or may not have yet, as the project sections see
 * it. The editor is told which a picked project lacks — before the preview
 * shows an empty space where the section should be.
 */
export type ProjectFeature =
  | "payment_plan"
  | "master_plan"
  | "unit_types"
  | "location";

export const PROJECT_FEATURE_LABELS: Record<ProjectFeature, string> = {
  payment_plan: "payment plan",
  master_plan: "master plan image",
  unit_types: "floor plans",
  location: "map location",
};

/**
 * One block as stored.
 *
 * `id` is a stable per-instance uuid — not the array index and not the type. A
 * page may hold three FAQ blocks; React must key on something that survives a
 * reorder, and a validation issue must be able to point at one of them.
 */
export type BlockInstance = {
  id: string;
  type: string;
  /** Schema version of `values`, for the per-block `migrate` hook. */
  v: number;
  enabled: boolean;
  values: SectionValues;
};

/**
 * A block resolved for rendering.
 *
 * `def: null` means the stored type is not in the catalogue. Unlike master
 * pages, that block is *kept* — see the note on data loss in `document.ts`.
 */
export type ResolvedBlock = {
  id: string;
  type: string;
  def: BlockDef | null;
  enabled: boolean;
  values: SectionValues;
};

export type LandingDocument = {
  blocks: BlockInstance[];
  /** Items too malformed to keep, so the editor can say how many were lost. */
  dropped: number;
};

/**
 * Ceiling on distinct catalogue fetches per page, enforced before publish.
 *
 * Six leaves room for a properties fetch, a developments fetch, an areas fetch
 * and a couple of curated-listing queries — a genuinely rich campaign page —
 * while stopping the "twelve featured rails" page that would otherwise bill a
 * dozen joined catalogue queries on every revalidation.
 */
export const LANDING_QUERY_BUDGET = 6;

/** Slugs the /lp/ route reserves for itself. */
export const RESERVED_LANDING_SLUGS = new Set(["new", "preview", "api"]);

export function isReservedLandingSlug(slug: string): boolean {
  return RESERVED_LANDING_SLUGS.has(slug.toLowerCase());
}

/** Shape of a landing slug. Deliberately excludes '/' — see migration 0099. */
export const LANDING_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,138}[a-z0-9]$/;

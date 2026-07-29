/**
 * Pure model for "where is this media asset used, and is it live?".
 *
 * The query side lives in `lib/queries/media-usage.ts`; everything here is
 * dependency-free so the rules that decide whether a file can be thrown away
 * are unit-testable and shared by the UI and the delete action.
 */

export type MediaUsageKind =
  | "property"
  | "development"
  | "floor_plan"
  | "article"
  | "page"
  | "area"
  | "area_guide"
  | "developer"
  | "developer_profile"
  | "megamenu"
  | "advisor"
  | "document"
  | "license";

export type MediaUsage = {
  kind: MediaUsageKind;
  /** Row id of the thing using the asset. */
  id: string;
  /** Human label for that row — listing title, article headline, page name. */
  label: string;
  /** How it's used there: "Hero", "Gallery", "Masterplan", "In body"… */
  role: string;
  /** Admin link to the owning record, when there is one. */
  href: string | null;
  /** Visible on the public site right now. */
  live: boolean;
  /** Internal-only surface (deal documents, licence files) — never public,
   *  but still very much in use. */
  internal: boolean;
};

/**
 * - `live`     — on at least one published public surface
 * - `attached` — used, but only by drafts / archived / off-market records
 * - `internal` — used only by internal surfaces (deal docs, licences)
 * - `unused`   — nothing references it
 */
export type MediaState = "live" | "attached" | "internal" | "unused";

export const MEDIA_STATE_LABELS: Record<MediaState, string> = {
  live: "Live",
  attached: "Not live",
  internal: "Internal",
  unused: "Unused",
};

export const USAGE_KIND_LABELS: Record<MediaUsageKind, string> = {
  property: "Listing",
  development: "Development",
  floor_plan: "Floor plan",
  article: "Article",
  page: "Page",
  area: "Area",
  area_guide: "Area guide",
  developer: "Developer",
  developer_profile: "Developer profile",
  megamenu: "Navigation",
  advisor: "Advisor",
  document: "Deal document",
  license: "Licence",
};

export function deriveMediaState(usages: MediaUsage[]): MediaState {
  if (usages.length === 0) return "unused";
  if (usages.some((u) => u.live)) return "live";
  if (usages.every((u) => u.internal)) return "internal";
  return "attached";
}

/**
 * Whether the trash button is offered.
 *
 * Two hard rules:
 *  - only unused assets can be trashed — anything attached to a record, even a
 *    draft or an archived listing, keeps its file;
 *  - if any usage source failed to load, nothing is trashable. A partial index
 *    reads as "unused" for assets we simply couldn't check, and deleting on
 *    incomplete knowledge is how you punch holes in a live page.
 */
export function canTrash(opts: {
  state: MediaState;
  indexPartial: boolean;
}): { allowed: boolean; reason: string | null } {
  if (opts.indexPartial) {
    return {
      allowed: false,
      reason:
        "Usage couldn't be checked in full — refresh before deleting anything.",
    };
  }
  if (opts.state !== "unused") {
    return { allowed: false, reason: "In use — detach it first." };
  }
  return { allowed: true, reason: null };
}

/** "2 listings · 1 page" — the one-line summary under a tile. */
export function summariseUsage(usages: MediaUsage[]): string {
  if (usages.length === 0) return "Not used anywhere";
  const counts = new Map<MediaUsageKind, number>();
  for (const u of usages) counts.set(u.kind, (counts.get(u.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, n]) => {
      const label = USAGE_KIND_LABELS[kind].toLowerCase();
      return `${n} ${n === 1 ? label : pluralise(label)}`;
    })
    .join(" · ");
}

function pluralise(label: string): string {
  if (label.endsWith("y")) return `${label.slice(0, -1)}ies`;
  if (label.endsWith("s")) return `${label}es`;
  return `${label}s`;
}

/** Usage list ordered the way a human scans it: live first, then by kind. */
export function sortUsages(usages: MediaUsage[]): MediaUsage[] {
  const kinds = Object.keys(USAGE_KIND_LABELS) as MediaUsageKind[];
  return [...usages].sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    const byKind = kinds.indexOf(a.kind) - kinds.indexOf(b.kind);
    if (byKind !== 0) return byKind;
    return a.label.localeCompare(b.label);
  });
}

/** Filter values the media library exposes as tabs. */
export const MEDIA_STATE_FILTERS = [
  "all",
  "live",
  "attached",
  "internal",
  "unused",
] as const;
export type MediaStateFilter = (typeof MEDIA_STATE_FILTERS)[number];

export function matchesStateFilter(
  state: MediaState,
  filter: MediaStateFilter,
): boolean {
  return filter === "all" || filter === state;
}

/**
 * Bulk-selection state for the /admin/properties table.
 *
 * Selection lives in the URL (?selected=id1,id2,…) so it survives Back/Forward
 * navigation and the user can copy-share the link. The on-screen state is just
 * a derived Set<string>; this module owns the URL ↔ Set parsing and the 200-id
 * cap that keeps action payloads small.
 */

export const BULK_SELECTION_CAP = 200;
export const BULK_SELECTION_PARAM = "selected";

/** Parse the `?selected=` query string value into an ordered, deduped,
 *  validated list. Capped at BULK_SELECTION_CAP. */
export function parseSelectedParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(",")) {
    const id = piece.trim();
    if (!id) continue;
    if (!isLikelyId(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= BULK_SELECTION_CAP) break;
  }
  return out;
}

/** Serialize a selection back to the URL form. Empty selection → null so the
 *  param is dropped instead of left as `?selected=`. */
export function serializeSelection(
  ids: Iterable<string>,
): string | null {
  const list = enforceCap(toUniqueArray(ids));
  if (list.length === 0) return null;
  return list.join(",");
}

/** Build a Set<string> from an iterable, capping at BULK_SELECTION_CAP. The
 *  insertion order of the iterable determines which ids win when the cap
 *  is hit. */
export function selectionFromIterable(ids: Iterable<string>): Set<string> {
  return new Set(enforceCap(toUniqueArray(ids)));
}

/** Toggle a single id in a selection. Returns the *new* Set so callers can
 *  feed it straight into setState. Hitting the cap silently no-ops on add. */
export function toggleId(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  if (next.size >= BULK_SELECTION_CAP) return current;
  next.add(id);
  return next;
}

/** Add every id in `visible` that is not already selected, up to the cap. */
export function selectAllVisible(
  current: Set<string>,
  visible: Iterable<string>,
): Set<string> {
  const next = new Set(current);
  for (const id of visible) {
    if (next.size >= BULK_SELECTION_CAP) break;
    if (!isLikelyId(id)) continue;
    next.add(id);
  }
  return next;
}

/** Remove every id in `visible` from the current selection. */
export function deselectVisible(
  current: Set<string>,
  visible: Iterable<string>,
): Set<string> {
  const next = new Set(current);
  for (const id of visible) next.delete(id);
  return next;
}

/** Tri-state for the header checkbox.
 *   - "none"   : no visible rows are selected
 *   - "all"    : every visible row is selected
 *   - "some"   : at least one but not all visible rows are selected
 *  An empty visible list always returns "none". */
export function headerCheckboxState(
  current: Set<string>,
  visible: Iterable<string>,
): "none" | "all" | "some" {
  let total = 0;
  let hit = 0;
  for (const id of visible) {
    total += 1;
    if (current.has(id)) hit += 1;
  }
  if (total === 0 || hit === 0) return "none";
  if (hit >= total) return "all";
  return "some";
}

/** Returns true when adding `count` new ids would exceed the cap. Used by
 *  the UI to prompt before pre-filter "select all" actions. */
export function wouldExceedCap(
  current: Set<string>,
  addCount: number,
): boolean {
  return current.size + addCount > BULK_SELECTION_CAP;
}

function toUniqueArray(ids: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id) continue;
    if (!isLikelyId(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function enforceCap(ids: string[]): string[] {
  if (ids.length <= BULK_SELECTION_CAP) return ids;
  return ids.slice(0, BULK_SELECTION_CAP);
}

/** Lenient id shape — we don't want to reject a real UUID over a typo in the
 *  regex, but we do want to drop obvious garbage from the URL. Allows UUIDs
 *  and any reasonable opaque string id (24+ alphanumerics, dashes, or
 *  underscores, no longer than 64 chars). */
function isLikelyId(id: string): boolean {
  if (id.length < 8 || id.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(id);
}

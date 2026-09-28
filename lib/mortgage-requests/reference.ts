/**
 * Request references: BZM-{YY}-{NNNN}, e.g. BZM-26-0412 (docs/mortgage/SPEC.md
 * §2.6). One series shared by both services, allocated at submit and never
 * reused. Allocation happens in the database (`mortgage_allocate_reference()`,
 * migration 0139), where concurrent submits queue on the counter row; this
 * module formats, parses and normalises what people type into C1's search.
 */

import { dubaiParts } from "./dubai-time";

const REFERENCE = /^BZM-(\d{2})-(\d{4,})$/;

/** "BZM-26-0412" from year 26 and number 412. */
export function formatReference(yy: number, n: number): string {
  return `BZM-${String(yy % 100).padStart(2, "0")}-${String(n).padStart(4, "0")}`;
}

export function parseReference(value: string): { yy: number; n: number } | null {
  const match = value.match(REFERENCE);
  return match ? { yy: Number(match[1]), n: Number(match[2]) } : null;
}

export function isReference(value: string): boolean {
  return REFERENCE.test(value);
}

/** The YY a request submitted at `at` gets: the year in Dubai. */
export function referenceYear(at: Date): number {
  return dubaiParts(at).year % 100;
}

/**
 * What C1's search box should match when someone types a reference, "with or
 * without BZM-" (C1 README): "bzm-26-0412", "BZM 26 0412" and "26-0412" all
 * become "BZM-26-0412"; a bare number of three or more digits ("0412") stays a
 * fragment to match inside references. Anything else isn't a reference: null.
 */
export function normaliseReferenceQuery(query: string): string | null {
  const compact = query.trim().toUpperCase().replace(/\s+/g, "-");
  const full = compact.match(/^(?:BZM-?)?(\d{2})-(\d{4,})$/);
  if (full) return `BZM-${full[1]}-${full[2]}`;
  if (/^\d{3,}$/.test(compact)) return compact;
  return null;
}
